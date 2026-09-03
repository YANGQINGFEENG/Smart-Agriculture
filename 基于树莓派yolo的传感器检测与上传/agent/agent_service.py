#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""智能养护 Agent 服务 - 从 bonsai_agent 迁移集成

两条独立后台流水线：
1. 环境监测流：读取真实传感器 → 规则决策(agent/decision_engine) → 驱动真实执行器
   (agent/device_tool) → 上报自动控制状态(mode=auto)
2. 视觉诊疗流：YOLO 检测结果(drivers/yolo_detector) → 专家知识库(agent/knowledge_tool)
   → DeepSeek 辅助诊疗(agent/llm_tool) → 上报云端(/api/device/agent-diagnosis)

节流机制（防重复，沿用 bonsai_agent）：
- 同名病虫害 detection_log_interval 秒内不重复记录，diagnosis_interval 秒内不重复诊疗
- 设备冷却：同一设备 cooldown 秒内不重复自动启动

离线降级：
- 诊疗结果上传失败时进入内存重传队列，随周期自动重试
- LLM/Ollama 异常时输出固定兜底文案，不阻塞主循环
"""

import logging
import threading
import time
from typing import Any, Dict, List, Optional

from agent.decision_engine import make_control_decision
from agent.device_tool import DeviceTool
from agent.knowledge_tool import KnowledgeTool
from agent.llm_tool import call_llm_with_expert, call_llm_without_expert

logger = logging.getLogger(__name__)

# 默认配置（可被 settings.yaml 的 agent 配置段覆盖）
DEFAULT_CONFIG = {
    "loop_interval": 5,          # 环境监测轮询间隔（秒）
    "vision_interval": 10,       # 视觉检查轮询间隔（秒）
    "detection_log_interval": 60,   # 同名病虫害检测记录最小间隔（秒）
    "diagnosis_interval": 600,      # 同名病虫害重复诊疗最小间隔（秒）
    "device_cooldown": {            # 设备自动启动冷却（秒）
        "water_pump": 600,
        "fan": 60,
        "light": 60,
    },
    "thresholds": {},               # decision_engine 阈值（缺省用引擎默认）
    "actuator_duration": {},        # 动作持续时间（缺省用引擎默认）
    "actuator_mapping": {},         # 设备 -> 执行器ID 映射（缺省用 device_tool 默认）
    "knowledge": {
        "data_paths": [
            "agent/data/pest_database.json",
            "agent/data/专家数据库.xlsx",
        ],
    },
    "llm": {
        "enabled": True,
        "host": "http://127.0.0.1:11434",
        "model": "deepseek-r1:1.5b",
    },
    "upload_diagnosis": True,       # 诊疗结果是否上传云端
}

# Agent 关注的传感器 API 类型 -> 内部字段名
SENSOR_TYPE_TO_FIELD = {
    "temperature": "temperature",
    "humidity": "humidity",
    "soil_moisture": "soil_moisture",
    "light_sensor": "light",
    "light": "light",
}


class AgentService:
    """智能养护 Agent 服务"""

    def __init__(self, system, config: Dict = None):
        """初始化 Agent 服务

        Args:
            system: app.system.System 实例
            config: agent 配置段（settings.yaml 的 agent: 节点）
        """
        self.system = system
        self.config: Dict = {**DEFAULT_CONFIG, **(config or {})}

        self._running = False
        self._stop_event = threading.Event()
        self._threads: List[threading.Thread] = []
        self._lock = threading.Lock()
        self._started_at: Optional[float] = None

        # 知识库（JSON 优先，Excel 回退）
        knowledge_cfg = self.config.get("knowledge", {}) or {}
        self.knowledge = KnowledgeTool(knowledge_cfg.get("data_paths", []))

        # LLM 配置
        self.llm_config: Dict = self.config.get("llm", {}) or {}

        # 自动控制执行器（状态变化时上报 mode=auto）
        self.device_tool = DeviceTool(
            system,
            actuator_mapping=self.config.get("actuator_mapping", {}),
            on_state_change=self._on_actuator_state_change,
        )

        # 运行时状态
        self._last_device_run: Dict[str, float] = {}    # 设备 -> 上次自动启动时间
        self._last_detection_name: Optional[str] = None
        self._last_detection_time: float = 0.0
        self._last_diagnosis_name: Optional[str] = None
        self._last_diagnosis_time: float = 0.0
        self._diagnosis_count = 0
        self._last_diagnosis_record: Optional[Dict] = None
        self._pending_diagnosis: List[Dict] = []        # 上传失败的重传队列

    # ==================================================
    # 生命周期
    # ==================================================

    def start(self):
        """启动 Agent 服务（环境监测 + 视觉诊疗双线程）"""
        if self._running:
            logger.warning("[Agent] 服务已在运行")
            return
        self._running = True
        self._started_at = time.time()
        self._stop_event.clear()

        env_thread = threading.Thread(
            target=self._environment_loop, daemon=True, name="agent-environment"
        )
        vision_thread = threading.Thread(
            target=self._vision_loop, daemon=True, name="agent-vision"
        )
        env_thread.start()
        vision_thread.start()
        self._threads = [env_thread, vision_thread]

        logger.info(
            f"[Agent] 服务已启动: 环境间隔 {self.config['loop_interval']}s, "
            f"视觉间隔 {self.config['vision_interval']}s, "
            f"诊疗间隔 {self.config['diagnosis_interval']}s, "
            f"LLM={'启用' if self.llm_config.get('enabled', True) else '禁用'}"
        )

    def stop(self):
        """停止 Agent 服务"""
        if not self._running:
            return
        logger.info("[Agent] 服务停止中...")
        self._running = False
        self._stop_event.set()
        self.device_tool.cancel_all()
        for thread in self._threads:
            try:
                if thread.is_alive():
                    thread.join(timeout=5)
            except Exception:
                pass
        self._threads = []
        logger.info("[Agent] 服务已停止")

    def get_status(self) -> Dict[str, Any]:
        """获取 Agent 服务状态"""
        return {
            "running": self._running,
            "uptime_seconds": int(time.time() - self._started_at) if self._started_at else 0,
            "loop_interval": self.config["loop_interval"],
            "vision_interval": self.config["vision_interval"],
            "diagnosis_interval": self.config["diagnosis_interval"],
            "llm_enabled": self.llm_config.get("enabled", True),
            "llm_model": self.llm_config.get("model", ""),
            "knowledge_source": self.knowledge.get_source(),
            "diagnosis_count": self._diagnosis_count,
            "pending_upload": len(self._pending_diagnosis),
            "last_diagnosis": self._last_diagnosis_record,
            "actuator_mapping": self.device_tool.mapping,
        }

    # ==================================================
    # 流水线 1：环境监测 + 自动控制
    # ==================================================

    def _environment_loop(self):
        """环境监测流水线主循环"""
        logger.info("[Agent] 环境监测流水线启动")
        while self._running:
            try:
                self._process_environment()
            except Exception as e:
                logger.error(f"[Agent] 环境监测异常: {e}")
            self._stop_event.wait(timeout=self.config["loop_interval"])

    def _collect_sensor_data(self) -> Dict[str, Any]:
        """从真实传感器采集 Agent 关注的环境数据

        复用 System 的传感器注册表与设备映射（device_mapping.sensors），
        传感器内部自带缓存与超时保护，可与其他采集线程安全并存。

        Returns:
            {temperature, humidity, soil_moisture, light}（缺失项不带 key）
        """
        sensor_data: Dict[str, Any] = {}
        sensors_mapping = self.system.device_mapping.get("sensors", {})

        for sensor_id, sensor in list(self.system.sensors.items()):
            try:
                data = sensor.read()
                if not data or data.get("value") is None:
                    continue

                value = data.get("value")
                quality = data.get("quality", "unknown")
                if quality not in ["good", "GOOD", "warning", "WARNING"]:
                    continue

                # 多值传感器（如 DHT11 同时返回温度/湿度）
                items = value.items() if isinstance(value, dict) else [(None, value)]
                for key, val in items:
                    map_key = f"{sensor_id}_{key}" if key else sensor_id
                    mapping = sensors_mapping.get(map_key, {})
                    api_type = str(mapping.get("type", "")).lower()
                    field = SENSOR_TYPE_TO_FIELD.get(api_type)
                    if field and isinstance(val, (int, float)):
                        sensor_data[field] = val
            except Exception as e:
                logger.debug(f"[Agent] 传感器 {sensor_id} 读取失败: {e}")

        return sensor_data

    def _process_environment(self):
        """单轮环境监测：采集 → 决策 → 执行（冷却保护）"""
        sensor_data = self._collect_sensor_data()
        if not sensor_data:
            logger.debug("[Agent] 未采集到有效传感器数据，本轮跳过")
            return

        logger.info(
            "[Agent] 环境数据: "
            + ", ".join(f"{k}={v}" for k, v in sorted(sensor_data.items()))
        )

        actions = make_control_decision(
            sensor_data,
            thresholds=self.config.get("thresholds", {}),
            durations=self.config.get("actuator_duration", {}),
        )

        if not actions:
            logger.info("[Agent] 自动控制: 当前环境正常，无需执行设备")
            return

        current_time = time.time()
        cooldown_cfg = self.config.get("device_cooldown", {})

        for action in actions:
            device = action.get("device", "")
            if not device:
                continue

            # 设备冷却保护
            cooldown = cooldown_cfg.get(device, 60)
            last_time = self._last_device_run.get(device, 0)
            if current_time - last_time < cooldown:
                remaining = int(cooldown - (current_time - last_time))
                logger.info(f"[Agent] {device} 处于安全冷却期，剩余约 {remaining} 秒")
                continue

            # 执行自动控制
            if self.device_tool.execute_action(action):
                self._last_device_run[device] = current_time

    def _on_actuator_state_change(self, actuator_id: str, state: str, device: str):
        """执行器状态变化回调：上报自动控制状态（mode=auto）"""
        try:
            self._upload_actuator_state(actuator_id, state)
        except Exception as e:
            logger.error(f"[Agent] 自动控制状态上报异常: {e}")

    def _upload_actuator_state(self, actuator_id: str, state: str):
        """上报执行器自动控制状态到云端"""
        upload = getattr(self.system, "upload", None)
        if not upload:
            return

        mapping = self.system.device_mapping.get("actuators", {}).get(actuator_id, {})
        node_id = mapping.get("node_id", actuator_id)
        api_type = mapping.get("type", "")

        ok = upload.upload_actuator_state(node_id, api_type, state, mode="auto")
        logger.info(
            f"[Agent] 自动控制状态上报: {node_id}({api_type}) state={state} "
            f"{'成功' if ok else '失败'}"
        )

    # ==================================================
    # 流水线 2：YOLO + 专家库 + DeepSeek 诊疗
    # ==================================================

    def _vision_loop(self):
        """视觉诊疗流水线主循环"""
        logger.info("[Agent] 视觉诊疗流水线启动")
        while self._running:
            try:
                self._process_vision()
            except Exception as e:
                logger.error(f"[Agent] 视觉诊疗异常: {e}")
            self._stop_event.wait(timeout=self.config["vision_interval"])

    def _get_yolo_result(self) -> Optional[Dict]:
        """从 YOLO 检测器获取最高置信度的检测结果"""
        detector = getattr(self.system, "_yolo_detector", None)
        if not detector:
            return None

        try:
            detections = detector.get_detections()
        except Exception as e:
            logger.debug(f"[Agent] YOLO 取数失败: {e}")
            return None

        if not detections:
            return None

        best = max(detections, key=lambda d: d.get("confidence", 0))
        name = best.get("class_name")
        if not name:
            return None

        return {
            "name": name,
            "confidence": best.get("confidence", 0),
            "bbox": best.get("bbox"),
        }

    def _process_vision(self):
        """单轮视觉诊疗：YOLO → 专家库 → DeepSeek → 上传"""
        # 1. 获取 YOLO 结果
        yolo_result = self._get_yolo_result()
        if not yolo_result:
            return

        pest_name = yolo_result.get("name")
        confidence = yolo_result.get("confidence", 0)
        if not pest_name:
            return

        current_time = time.time()
        logger.info(
            f"[Agent] YOLO检测: {pest_name} 置信度 {confidence * 100:.1f}%"
        )

        # 2. 节流：同名病虫害 diagnosis_interval 秒内不重复诊疗
        if (
            pest_name == self._last_diagnosis_name
            and current_time - self._last_diagnosis_time < self.config["diagnosis_interval"]
        ):
            logger.info("[Agent] 已有近期诊疗结果，本轮不重复调用")
            return

        # 3. 查询专家知识库
        expert_info = self.knowledge.search_expert(pest_name)

        if expert_info:
            expert_id = str(expert_info.get("专家条目ID", "") or "") or None
            logger.info(f"[Agent] 专家数据库匹配成功: {expert_id or expert_info.get('问题标准名称')}")
            ai_result = call_llm_with_expert(yolo_result, expert_info, self.llm_config)
            diagnosis_data = {
                "pest_name": str(expert_info.get("问题标准名称", "") or "") or pest_name,
                "confidence": confidence,
                "expert_id": expert_id,
                "risk_level": str(expert_info.get("风险等级", "") or "") or "待评估",
                "diagnosis": ai_result.get("diagnosis", "暂无AI诊断"),
                "advice": self._build_expert_advice(expert_info),
                "knowledge_source": "expert_database",
            }
        else:
            logger.info("[Agent] 专家数据库未找到匹配条目，使用 DeepSeek 通用知识")
            ai_result = call_llm_without_expert(yolo_result, self.llm_config)
            diagnosis_data = {
                "pest_name": pest_name,
                "confidence": confidence,
                "expert_id": None,
                "risk_level": "待人工评估",
                "diagnosis": ai_result.get("diagnosis", "暂无诊断"),
                "advice": ai_result.get("general_advice", "建议人工进一步检查。"),
                "knowledge_source": "deepseek_general",
            }

        # 4. 更新诊疗状态
        with self._lock:
            self._last_diagnosis_name = pest_name
            self._last_diagnosis_time = current_time
            self._diagnosis_count += 1
            self._last_diagnosis_record = diagnosis_data

        logger.info(f"[Agent] 诊疗完成: {diagnosis_data['diagnosis']}")

        # 5. 上传云端（失败进入重传队列）
        self._upload_diagnosis_with_retry(diagnosis_data)

    @staticmethod
    def _build_expert_advice(expert_info: Dict) -> str:
        """组合专家建议（沿用 bonsai_agent 的格式）"""
        def clean(value, default=""):
            if value is None:
                return default
            text = str(value).strip()
            return default if text.lower() == "nan" else text

        parts = []
        immediate = clean(expert_info.get("立即措施"))
        care = clean(expert_info.get("农业/养护措施"))
        if immediate:
            parts.append("立即措施：" + immediate)
        if care:
            parts.append("养护措施：" + care)
        if not parts:
            return "请根据专家知识库内容进行人工复核后处置。"
        return "\n".join(parts)

    # ==================================================
    # 诊疗结果上传（含离线重传）
    # ==================================================

    def _upload_diagnosis_with_retry(self, record: Dict):
        """上传诊疗结果，失败进入重传队列"""
        if not self.config.get("upload_diagnosis", True):
            return

        records = [record]
        # 合并历史失败记录一起重传
        with self._lock:
            if self._pending_diagnosis:
                records = self._pending_diagnosis + records

        upload = getattr(self.system, "upload", None)
        ok = False
        if upload:
            try:
                ok = upload.upload_agent_diagnosis(records)
            except Exception as e:
                logger.error(f"[Agent] 诊疗结果上传异常: {e}")

        with self._lock:
            if ok:
                if self._pending_diagnosis:
                    logger.info(f"[Agent] 重传成功 {len(self._pending_diagnosis)} 条历史诊疗记录")
                self._pending_diagnosis = []
            else:
                # 保留未成功的记录（队列上限 50 条，防止内存膨胀）
                self._pending_diagnosis = records[-50:]
                logger.warning(
                    f"[Agent] 诊疗结果上传失败，已加入重传队列（{len(self._pending_diagnosis)} 条）"
                )
