import time

from utils.logger import get_logger
logger = get_logger("main")

from tools.sensor_tool import get_sensor_data
from tools.yolo_tool import get_yolo_result

from tools.knowledge_tool import search_expert

from tools.llm_tool import (
    call_llm_with_expert,
    call_llm_without_expert
)

from tools.device_tool import execute_action

from control.decision_engine import (
    make_control_decision
)

from database.repository import (
    save_sensor_record,
    save_detection_record,
    save_diagnosis_record,
    save_device_log
)


# ==================================================
# 系统配置
# ==================================================

# 主循环执行间隔
LOOP_INTERVAL = 5


# YOLO识别结果多久保存一次
DETECTION_LOG_INTERVAL = 60


# 同一种病虫害多久允许重新调用一次DeepSeek
#
# 防止摄像头每一帧都调用大模型
DIAGNOSIS_INTERVAL = 600


# ==================================================
# 设备安全冷却时间
# ==================================================
#
# 防止传感器一直低于阈值时，
# 水泵被连续启动。
#
# 单位：秒
# ==================================================

DEVICE_COOLDOWN = {

    # 水泵10分钟内最多自动启动一次
    "water_pump": 600,

    # 风扇60秒
    "fan": 60,

    # 补光灯60秒
    "light": 60
}


# 保存各设备上一次运行时间
last_device_run = {}


# ==================================================
# YOLO状态
# ==================================================

last_detection_name = None

last_detection_time = 0


# ==================================================
# 诊疗状态
# ==================================================

last_diagnosis_name = None

last_diagnosis_time = 0


# ==================================================
# 清洗Excel上的文本
# ==================================================

def clean_text(value, default=""):

    if value is None:
        return default

    text = str(value).strip()

    if text.lower() == "nan":
        return default

    return text


# ==================================================
# 组合专家建议
# ==================================================

def build_expert_advice(expert_info):

    advice_parts = []


    immediate = clean_text(
        expert_info.get("立即措施")
    )


    care = clean_text(
        expert_info.get("农业/养护措施")
    )


    if immediate:

        advice_parts.append(
            "立即措施：" + immediate
        )


    if care:

        advice_parts.append(
            "养护措施：" + care
        )


    if not advice_parts:

        return "请根据专家知识库内容进行人工复核后处置。"


    return "\n".join(
        advice_parts
    )


# ==================================================
# 环境监测 + 自动控制
# ==================================================

def process_environment():

    logger.info("-------- 环境监测 --------")


    # --------------------------------------------------
    # 1. 获取传感器数据
    # --------------------------------------------------

    sensor_data = get_sensor_data()


    logger.info(
        "温度：%.1f ℃ | 空气湿度：%.1f %% | 土壤湿度：%.1f %% | 光照：%.0f lux",
        sensor_data.get('temperature', 0),
        sensor_data.get('humidity', 0),
        sensor_data.get('soil_moisture', 0),
        sensor_data.get('light', 0)
    )


    # --------------------------------------------------
    # 2. 保存到SQLite
    # --------------------------------------------------

    save_sensor_record(
        sensor_data
    )


    logger.info("传感器数据已保存到SQLite")


    # --------------------------------------------------
    # 3. 规则引擎判断
    # --------------------------------------------------

    actions = make_control_decision(
        sensor_data
    )


    if not actions:

        logger.info("自动控制：当前环境正常，无需执行设备")

        return


    # --------------------------------------------------
    # 4. 执行控制
    # --------------------------------------------------

    for action in actions:

        device = action.get(
            "device"
        )


        if not device:

            continue


        current_time = time.time()


        last_time = last_device_run.get(
            device,
            0
        )


        cooldown = DEVICE_COOLDOWN.get(
            device,
            60
        )


        # --------------------------------------------------
        # 防止设备重复执行
        # --------------------------------------------------

        if (
            current_time
            -
            last_time
            <
            cooldown
        ):

            remaining = int(
                cooldown
                -
                (
                    current_time
                    -
                    last_time
                )
            )


            logger.info(
                "%s 处于安全冷却期，剩余约 %d 秒",
                device, remaining
            )

            continue


        logger.info("自动控制触发：设备=%s, 原因=%s", device, action.get('reason'))


        # --------------------------------------------------
        # 真正执行设备
        # --------------------------------------------------

        execute_action(
            action
        )


        # --------------------------------------------------
        # 保存设备运行时间
        # --------------------------------------------------

        last_device_run[
            device
        ] = current_time


        # --------------------------------------------------
        # 保存SQLite设备日志
        # --------------------------------------------------

        device_log = {

            "device":
                device,

            "action":
                "ON",

            "duration":
                action.get(
                    "duration"
                ),

            "reason":
                action.get(
                    "reason"
                )
        }


        save_device_log(
            device_log
        )


        logger.info("设备执行记录已保存到SQLite")


# ==================================================
# YOLO + 专家库 + DeepSeek
# ==================================================

def process_vision():

    global last_detection_name
    global last_detection_time

    global last_diagnosis_name
    global last_diagnosis_time


    # --------------------------------------------------
    # 1. 获取YOLO结果
    # --------------------------------------------------

    yolo_result = get_yolo_result()


    if not yolo_result:

        logger.info("YOLO：当前未检测到病虫害")

        return


    pest_name = yolo_result.get(
        "name"
    )


    confidence = yolo_result.get(
        "confidence",
        0
    )


    if not pest_name:

        return


    current_time = time.time()


    logger.info("-------- AI视觉监测 --------")


    logger.info("YOLO检测：%s，置信度：%.1f%%", pest_name, confidence * 100)


    # ==================================================
    # 2. 判断是否保存YOLO记录
    # ==================================================

    should_save_detection = False


    # 病虫害发生变化
    if pest_name != last_detection_name:

        should_save_detection = True


    # 或者距离上一次保存超过60秒
    elif (
        current_time
        -
        last_detection_time
        >=
        DETECTION_LOG_INTERVAL
    ):

        should_save_detection = True


    if should_save_detection:

        save_detection_record(
            yolo_result
        )


        last_detection_name = (
            pest_name
        )


        last_detection_time = (
            current_time
        )


        logger.info("YOLO识别结果已保存到SQLite")


    # ==================================================
    # 3. 判断是否需要重新诊疗
    # ==================================================

    should_diagnose = False


    # 检测到了新的病虫害
    if pest_name != last_diagnosis_name:

        should_diagnose = True


    # 同一种病害超过10分钟重新分析一次
    elif (
        current_time
        -
        last_diagnosis_time
        >=
        DIAGNOSIS_INTERVAL
    ):

        should_diagnose = True


    if not should_diagnose:

        logger.info("DeepSeek：已有近期诊疗结果，本轮不重复调用")

        return


    logger.info("正在查询专家知识库...")


    # ==================================================
    # 4. 查询专家库
    # ==================================================

    expert_info = search_expert(
        pest_name
    )


    # ==================================================
    # 5. 专家数据库命中
    # ==================================================

    if expert_info:

        expert_id = clean_text(
            expert_info.get(
                "专家条目ID"
            )
        )


        logger.info("专家数据库匹配成功：%s", expert_id)


        logger.info("正在调用DeepSeek辅助分析...")


        ai_result = (
            call_llm_with_expert(
                yolo_result,
                expert_info
            )
        )


        diagnosis = ai_result.get(
            "diagnosis",
            "暂无AI诊断"
        )


        advice = build_expert_advice(
            expert_info
        )


        diagnosis_data = {

            "pest_name":
                clean_text(
                    expert_info.get(
                        "问题标准名称"
                    ),
                    pest_name
                ),

            "expert_id":
                expert_id,

            "risk_level":
                clean_text(
                    expert_info.get(
                        "风险等级"
                    ),
                    "待评估"
                ),

            "diagnosis":
                diagnosis,

            "advice":
                advice,

            "knowledge_source":
                "expert_database"
        }


    # ==================================================
    # 6. 专家数据库未命中
    # ==================================================

    else:

        logger.warning("专家数据库未找到匹配条目")


        logger.info("正在调用DeepSeek通用知识...")


        ai_result = (
            call_llm_without_expert(
                yolo_result
            )
        )


        diagnosis_data = {

            "pest_name":
                pest_name,

            "expert_id":
                None,

            "risk_level":
                "待人工评估",

            "diagnosis":
                ai_result.get(
                    "diagnosis",
                    "暂无诊断"
                ),

            "advice":
                ai_result.get(
                    "general_advice",
                    "建议人工进一步检查。"
                ),

            "knowledge_source":
                "deepseek_general"
        }


    # ==================================================
    # 7. 保存诊疗记录
    # ==================================================

    save_diagnosis_record(
        diagnosis_data
    )


    last_diagnosis_name = (
        pest_name
    )


    last_diagnosis_time = (
        current_time
    )


    logger.info("Agent诊疗结果已保存到SQLite")


    logger.info("诊断：%s", diagnosis_data['diagnosis'])


# ==================================================
# 系统主循环
# ==================================================

def run_system():

    logger.info("========================================")
    logger.info("  天工慧眼智能养护系统")
    logger.info("========================================")
    logger.info("系统已进入自动运行模式")
    logger.info("主循环间隔：%d 秒", LOOP_INTERVAL)
    logger.info("按 Ctrl + C 可停止系统")


    while True:

        try:

            # ------------------------------------------
            # 环境感知 + 自动控制
            # ------------------------------------------

            process_environment()


            # ------------------------------------------
            # YOLO + Agent
            # ------------------------------------------

            process_vision()


            logger.debug("等待下一轮监测...")


            time.sleep(
                LOOP_INTERVAL
            )


        except KeyboardInterrupt:

            logger.info("========================================")
            logger.info("天工慧眼系统已停止")
            logger.info("========================================")

            break


        except Exception as error:

            logger.warning("本轮运行发生异常：%s", error)
            logger.info("系统将在5秒后继续运行...")


            time.sleep(
                LOOP_INTERVAL
            )


# ==================================================
# 程序入口
# ==================================================

if __name__ == "__main__":

    run_system()
