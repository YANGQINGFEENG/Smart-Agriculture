import re
from pathlib import Path

import ollama


# ==================================================
# 项目根目录
# ==================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent


# ==================================================
# DeepSeek模型名称
# ==================================================

MODEL_NAME = "deepseek-r1:1.5b"


# ==================================================
# 读取 system prompt
# ==================================================

def load_system_prompt():

    prompt_path = (
        PROJECT_ROOT
        / "prompts"
        / "system_prompt.txt"
    )

    if not prompt_path.exists():

        return (
            "你是天工慧眼川派盆景智能诊疗Agent。"
            "回答应专业、谨慎，不得把视觉识别结果"
            "表述为百分之百确诊。"
        )

    return prompt_path.read_text(
        encoding="utf-8"
    )


# ==================================================
# 清理模型输出
# ==================================================

def clean_model_output(text):

    if text is None:
        return ""

    text = str(text).strip()

    text = re.sub(
        r"<think>.*?</think>",
        "",
        text,
        flags=re.DOTALL
    )

    text = text.replace("```text", "")
    text = text.replace("```json", "")
    text = text.replace("```", "")
    text = text.replace("**", "")

    return text.strip()


# ==================================================
# 调用本地 DeepSeek
# ==================================================

def ask_deepseek(
    prompt,
    num_predict=500
):

    system_prompt = load_system_prompt()

    full_prompt = f"""
【系统要求】

{system_prompt}


【当前任务】

{prompt}


请直接给最终答案。
不要展示思考过程。
"""

    response = ollama.generate(

        model=MODEL_NAME,

        prompt=full_prompt,

        options={
            "temperature": 0.2,
            "num_predict": num_predict
        }
    )

    try:

        raw_text = response.response

    except AttributeError:

        raw_text = response.get(
            "response",
            ""
        )

    return clean_model_output(
        raw_text
    )


# ==================================================
# 情况1：
# 专家数据库命中
# ==================================================

def call_llm_with_expert(
    yolo_result,
    expert_info
):

    detected_name = yolo_result.get(
        "name",
        "未知病虫害"
    )

    confidence = yolo_result.get(
        "confidence",
        0
    )

    standard_name = expert_info.get(
        "问题标准名称",
        detected_name
    )

    judgment = expert_info.get(
        "判断依据",
        ""
    )

    symptoms = expert_info.get(
        "典型症状",
        ""
    )

    remark = expert_info.get(
        "备注",
        ""
    )


    diagnosis_prompt = f"""
YOLO视觉模型检测到：

病虫害：
{detected_name}

置信度：
{confidence * 100:.1f}%

本地专家数据库标准名称：
{standard_name}

专家判断依据：
{judgment}


请生成一句简洁的初步诊断。

要求：

1. 必须使用“疑似”或“初步判断”等谨慎表述。
2. 不得说已经百分之百确诊。
3. 不得增加专家数据库中不存在的事实。
4. 不要输出治疗方案。
5. 控制在80个汉字以内。
"""

    try:

        diagnosis = ask_deepseek(
            diagnosis_prompt,
            num_predict=300
        )

    except Exception as e:

        print(
            "DeepSeek辅助诊断失败：",
            e
        )

        diagnosis = ""


    if not diagnosis:

        diagnosis = (
            f"YOLO检测到疑似{standard_name}，"
            "建议结合专家数据库中的典型特征进一步确认。"
        )


    warning_prompt = f"""
当前疑似问题：

{standard_name}

专家数据库典型症状：

{symptoms}

专家数据库备注：

{remark}


请生成一句人工复核提示。

要求：

1. 告诉用户还需要检查什么。
2. 必须依据上述专家数据库内容。
3. 不得增加数据库没有的信息。
4. 不输出治疗方案。
5. 控制在80个汉字以内。
"""

    try:

        warning = ask_deepseek(
            warning_prompt,
            num_predict=300
        )

    except Exception as e:

        print(
            "DeepSeek复核提示失败：",
            e
        )

        warning = ""


    if not warning:

        warning = (
            "建议结合专家数据库中的典型症状、"
            "发生部位及现场情况进一步人工复核。"
        )


    return {
        "diagnosis": diagnosis,
        "warning": warning,
        "knowledge_source": "expert_database"
    }


# ==================================================
# 情况2：
# 专家数据库未命中
# DeepSeek负责兜底
# ==================================================

def call_llm_without_expert(
    yolo_result
):

    detected_name = yolo_result.get(
        "name",
        "未知病虫害"
    )

    confidence = yolo_result.get(
        "confidence",
        0
    )


    diagnosis_prompt = f"""
YOLO视觉模型检测到疑似病虫害：

名称：
{detected_name}

置信度：
{confidence * 100:.1f}%

但是本地专家数据库没有找到对应知识条目。


请根据你的通用植物病虫害知识，
生成简短的初步判断。

要求：

1. 必须明确这是AI通用判断。
2. 使用“疑似”“可能”等谨慎表述。
3. 不得表述为百分之百确诊。
4. 控制在100个汉字以内。
"""

    try:

        diagnosis = ask_deepseek(
            diagnosis_prompt,
            num_predict=350
        )

    except Exception as e:

        print(
            "DeepSeek通用诊断失败：",
            e
        )

        diagnosis = ""


    if not diagnosis:

        diagnosis = (
            f"YOLO检测到疑似{detected_name}，"
            "但本地专家数据库暂无对应条目，"
            "建议人工复核。"
        )


    advice_prompt = f"""
当前YOLO检测到疑似：

{detected_name}

本地专家数据库没有对应条目。


请根据通用植物病虫害知识，
给出安全、保守的初步处理建议。

要求：

1. 可以建议隔离观察、检查病叶、改善通风、
   清理受害组织、记录病情变化等一般措施。

2. 不得给出具体农药浓度。

3. 不得给出具体稀释倍数。

4. 不得给出具体药剂混配方案。

5. 不得声称已经确诊。

6. 如果涉及专业用药，
   必须建议咨询当地农技或植保专业人员。

7. 控制在200个汉字以内。
"""

    try:

        general_advice = ask_deepseek(
            advice_prompt,
            num_predict=500
        )

    except Exception as e:

        print(
            "DeepSeek通用建议失败：",
            e
        )

        general_advice = ""


    if not general_advice:

        general_advice = (
            "建议先隔离观察受影响植株，"
            "检查叶片正反面及受害部位，"
            "保持适当通风并记录病情变化。"
            "如症状持续或加重，"
            "建议咨询专业植保人员。"
        )


    warning = (
        "当前病虫害未命中本地专家数据库，"
        "以下内容属于DeepSeek通用AI建议，"
        "未经本地专家知识库验证，"
        "请人工复核后再采取处置措施。"
    )


    return {
        "diagnosis": diagnosis,
        "general_advice": general_advice,
        "warning": warning,
        "knowledge_source": "deepseek_general"
    }