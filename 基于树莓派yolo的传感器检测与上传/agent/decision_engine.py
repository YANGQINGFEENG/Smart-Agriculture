#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""养护规则决策引擎 - 从 bonsai_agent 迁移并配置化

根据传感器数据做确定性规则判断，输出设备动作列表。
阈值与持续时间来自 config/settings.yaml 的 agent.thresholds / agent.actuator_duration 配置段。

规则（与 bonsai_agent 保持一致）：
    土壤湿度 < 阈值 → 水泵
    温度 > 阈值     → 风扇
    光照 < 阈值     → 补光灯
"""

import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

# 默认阈值
DEFAULT_THRESHOLDS = {
    "soil_moisture_min": 25,   # 土壤湿度下限（%）
    "temperature_max": 35,     # 空气温度上限（℃）
    "light_min": 10000,        # 光照下限（lux）
}

# 默认动作持续时间（秒）
DEFAULT_DURATIONS = {
    "water_pump": 5,
    "fan": 60,
    "light": 60,
}


def make_control_decision(
    sensor_data: Dict[str, Any],
    thresholds: Dict = None,
    durations: Dict = None,
) -> List[Dict]:
    """根据传感器数据生成自动控制动作

    Args:
        sensor_data: 传感器数据 {temperature, humidity, soil_moisture, light}
        thresholds: 阈值配置（缺省使用默认值）
        durations: 动作持续时间配置（秒，缺省使用默认值）

    Returns:
        动作列表: [{device, duration, reason}]
    """
    t = {**DEFAULT_THRESHOLDS, **(thresholds or {})}
    d = {**DEFAULT_DURATIONS, **(durations or {})}
    actions = []

    soil = sensor_data.get("soil_moisture")
    if soil is not None and soil < t["soil_moisture_min"]:
        actions.append({
            "device": "water_pump",
            "duration": d["water_pump"],
            "reason": f"土壤湿度 {soil}% 低于阈值 {t['soil_moisture_min']}%",
        })

    temperature = sensor_data.get("temperature")
    if temperature is not None and temperature > t["temperature_max"]:
        actions.append({
            "device": "fan",
            "duration": d["fan"],
            "reason": f"温度 {temperature}℃ 超过阈值 {t['temperature_max']}℃",
        })

    light = sensor_data.get("light")
    if light is not None and light < t["light_min"]:
        actions.append({
            "device": "light",
            "duration": d["light"],
            "reason": f"光照 {light}lux 低于阈值 {t['light_min']}lux",
        })

    return actions
