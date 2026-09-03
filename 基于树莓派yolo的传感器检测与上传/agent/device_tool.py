#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Agent 自动控制执行工具 - 对接真实执行器驱动

替换 bonsai_agent 的模拟 device_tool：
    water_pump → 继电器（水泵接继电器）
    fan        → 风扇
    light      → RGB-LED（补光）

安全机制：
1. 手动命令优先：执行器处于非 Agent 开启的 ON 状态时跳过自动控制
2. 自动关闭：动作按 duration 定时自动关闭（threading.Timer）
3. 状态变化回调：供 AgentService 上报自动控制状态（mode=auto）到云端
"""

import logging
import threading
from typing import Callable, Dict, Optional

logger = logging.getLogger(__name__)

# 默认设备 -> 执行器ID 映射（可被 agent.actuator_mapping 配置覆盖）
DEFAULT_ACTUATOR_MAPPING = {
    "water_pump": "relay",   # 水泵接继电器 (VL-1-001)
    "fan": "fan",            # 风扇 (FN-1-001)
    "light": "rgb_led",      # 补光灯 (LT-1-002)
}


class DeviceTool:
    """Agent 自动控制执行器"""

    def __init__(
        self,
        system,
        actuator_mapping: Dict = None,
        on_state_change: Optional[Callable] = None,
    ):
        """初始化

        Args:
            system: app.system.System 实例（使用 system.actuators 设备注册表）
            actuator_mapping: 设备名 -> 执行器ID 映射
            on_state_change: 状态变化回调 on_state_change(actuator_id, state, device)
        """
        self.system = system
        self.mapping = {**DEFAULT_ACTUATOR_MAPPING, **(actuator_mapping or {})}
        self._on_state_change = on_state_change

        self._agent_started = set()    # 由 Agent 开启的执行器（用于手动命令冲突保护）
        self._off_timers: Dict[str, threading.Timer] = {}  # 执行器ID -> 自动关闭定时器

    def execute_action(self, action: Dict) -> bool:
        """执行自动控制动作

        Args:
            action: {device, duration, reason}

        Returns:
            是否执行成功
        """
        device = action.get("device", "")
        actuator_id = self.mapping.get(device)
        if not actuator_id:
            logger.warning(f"[Agent] 设备 {device} 无映射的执行器，跳过")
            return False

        actuator = self.system.actuators.get(actuator_id)
        if not actuator:
            logger.warning(f"[Agent] 执行器未初始化: {actuator_id}（设备 {device}），跳过")
            return False

        # 手动命令冲突保护：非 Agent 开启且当前为 ON 时跳过
        state = getattr(getattr(actuator, "_state", None), "value", "unknown")
        if state == "on" and actuator_id not in self._agent_started:
            logger.info(f"[Agent] 执行器 {actuator_id} 处于手动开启状态，跳过自动控制")
            return False

        reason = action.get("reason", "")
        logger.info(f"[Agent] 自动控制触发: {device}({actuator_id}) 开启 - {reason}")

        try:
            ok = actuator.turn_on()
        except Exception as e:
            logger.error(f"[Agent] 执行器 {actuator_id} 开启异常: {e}")
            return False

        if not ok:
            logger.error(f"[Agent] 执行器 {actuator_id} 开启失败")
            return False

        self._agent_started.add(actuator_id)
        if self._on_state_change:
            try:
                self._on_state_change(actuator_id, "on", device)
            except Exception as e:
                logger.error(f"[Agent] 状态回调异常: {e}")

        # 按持续时间调度自动关闭
        duration = action.get("duration") or 0
        if duration > 0:
            self._schedule_auto_off(actuator_id, device, duration)

        return True

    def _schedule_auto_off(self, actuator_id: str, device: str, duration: float):
        """调度自动关闭（重复触发时重新计时）"""
        old = self._off_timers.pop(actuator_id, None)
        if old:
            old.cancel()

        timer = threading.Timer(duration, self._auto_off, args=(actuator_id, device))
        timer.daemon = True
        timer.start()
        self._off_timers[actuator_id] = timer
        logger.info(f"[Agent] {device}({actuator_id}) 将在 {duration} 秒后自动关闭")

    def _auto_off(self, actuator_id: str, device: str):
        """定时自动关闭"""
        self._off_timers.pop(actuator_id, None)
        actuator = self.system.actuators.get(actuator_id)
        if not actuator:
            return
        try:
            if actuator.turn_off():
                logger.info(f"[Agent] {device}({actuator_id}) 已自动关闭")
            else:
                logger.error(f"[Agent] {device}({actuator_id}) 自动关闭失败")
        except Exception as e:
            logger.error(f"[Agent] {device} 自动关闭异常: {e}")
        finally:
            self._agent_started.discard(actuator_id)
            if self._on_state_change:
                try:
                    self._on_state_change(actuator_id, "off", device)
                except Exception as e:
                    logger.error(f"[Agent] 状态回调异常: {e}")

    def cancel_all(self):
        """取消全部自动关闭定时器（服务停止时调用）"""
        for timer in self._off_timers.values():
            timer.cancel()
        self._off_timers.clear()
