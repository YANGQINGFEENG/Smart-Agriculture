#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""蜂鸣器驱动 (无源, GPIO18 + lgpio)

无源蜂鸣器使用 GPIO 控制，低电平触发。
使用 lgpio 库进行控制（树莓派5兼容）。

硬件接线：
- 蜂鸣器 VCC -> 3.3V (或 5V)
- 蜂鸣器 GND -> GND
- 蜂鸣器 I/O -> GPIO18 (低电平触发)
"""

import logging
import threading
import time
from typing import Any, Dict

from drivers.actuators.base import BaseActuator, ActuatorState

logger = logging.getLogger(__name__)

try:
    import lgpio
    HAS_LGPIO = True
except ImportError:
    HAS_LGPIO = False


class BuzzerActuator(BaseActuator):
    """蜂鸣器执行器
    
    支持蜂鸣器开关控制、蜂鸣时长控制。
    """
    
    def __init__(self, actuator_id: str = "buzzer", name: str = "蜂鸣器",
                 pin: int = 18, config: Dict = None, **kwargs):
        """初始化蜂鸣器执行器"""
        if not config:
            config = {}
        for key, value in kwargs.items():
            if value is not None:
                config[key] = value
                
        super().__init__(actuator_id, name, "buzzer", config)
        self.pin = pin or config.get("pin", 18)
        self._lgpio_handle = None
        self._buzz_thread = None
        self._buzz_stop_event = threading.Event()
        
        # 蜂鸣器回馈信息
        self._last_duration = 0  # 上次蜂鸣时长
        self._last_pattern = None  # 蜂鸣模式
        self._command_count = 0  # 命令计数
    
    def initialize(self) -> bool:
        """初始化蜂鸣器"""
        if not HAS_LGPIO:
            logger.warning("lgpio 库未安装，蜂鸣器驱动不可用")
            self._initialized = False
            return False
        
        try:
            # 打开 GPIO 芯片
            self._lgpio_handle = lgpio.gpiochip_open(0)
            if self._lgpio_handle < 0:
                logger.error("GPIO 芯片打开失败")
                self._initialized = False
                return False
            
            # 初始为高电平（关闭状态）
            lgpio.gpio_claim_output(self._lgpio_handle, self.pin)
            lgpio.gpio_write(self._lgpio_handle, self.pin, 1)
            self._state = ActuatorState.OFF
            self._initialized = True
            logger.info(f"蜂鸣器初始化成功: GPIO={self.pin}")
            return True
        except Exception as e:
            logger.error(f"蜂鸣器初始化错误: {e}")
            self._initialized = False
            return False
    
    def turn_on(self) -> bool:
        """打开蜂鸣器（低电平触发）"""
        if not self._initialized or not self._lgpio_handle:
            return False
        
        try:
            lgpio.gpio_write(self._lgpio_handle, self.pin, 0)  # 低电平触发
            self._state = ActuatorState.ON
            logger.info("蜂鸣器已打开")
            return True
        except Exception as e:
            logger.error(f"蜂鸣器打开失败: {e}")
            return False
    
    def turn_off(self) -> bool:
        """关闭蜂鸣器"""
        if not self._initialized or not self._lgpio_handle:
            return False
        
        try:
            self._buzz_stop_event.set()
            lgpio.gpio_write(self._lgpio_handle, self.pin, 1)  # 高电平关闭
            self._state = ActuatorState.OFF
            logger.info("蜂鸣器已关闭")
            return True
        except Exception as e:
            logger.error(f"蜂鸣器关闭失败: {e}")
            return False
    
    def beep(self, duration: float = 0.5) -> bool:
        """蜂鸣指定时长"""
        if not self._initialized or not self._lgpio_handle:
            return False
        
        try:
            self._command_count += 1
            self._last_duration = duration
            self._last_pattern = "single_beep"
            
            lgpio.gpio_write(self._lgpio_handle, self.pin, 0)  # 低电平触发
            self._state = ActuatorState.ON
            time.sleep(duration)
            lgpio.gpio_write(self._lgpio_handle, self.pin, 1)  # 高电平关闭
            self._state = ActuatorState.OFF
            logger.info(f"蜂鸣 {duration} 秒完成 (命令#{self._command_count})")
            return True
        except Exception as e:
            logger.error(f"蜂鸣失败: {e}")
            if self._lgpio_handle:
                lgpio.gpio_write(self._lgpio_handle, self.pin, 1)
            self._state = ActuatorState.OFF
            return False
    
    def beep_pattern(self, pattern: str = "alarm") -> bool:
        """执行蜂鸣模式
        
        Args:
            pattern: 蜂鸣模式
                - "alarm": 连续长响 (1秒)
                - "success": 短响3次
                - "warning": 长短交替
                - "click": 单次短响 (0.1秒)
        """
        if not self._initialized or not self._lgpio_handle:
            return False
        
        patterns = {
            "alarm": [(1.0, 0.1)],  # (响, 停)
            "success": [(0.1, 0.1), (0.1, 0.1), (0.2, 0.1)],
            "warning": [(0.5, 0.2), (0.2, 0.1), (0.5, 0.2)],
            "click": [(0.1, 0)],
        }
        
        if pattern not in patterns:
            logger.warning(f"未知蜂鸣模式: {pattern}")
            return False
        
        try:
            self._command_count += 1
            self._last_pattern = pattern
            
            for beep_time, wait_time in patterns[pattern]:
                if self._buzz_stop_event.is_set():
                    break
                lgpio.gpio_write(self._lgpio_handle, self.pin, 0)
                self._state = ActuatorState.ON
                time.sleep(beep_time)
                lgpio.gpio_write(self._lgpio_handle, self.pin, 1)
                self._state = ActuatorState.OFF
                if wait_time > 0:
                    time.sleep(wait_time)
            
            logger.info(f"蜂鸣模式 {pattern} 完成 (命令#{self._command_count})")
            return True
        except Exception as e:
            logger.error(f"蜂鸣模式执行失败: {e}")
            self._state = ActuatorState.OFF
            return False
    
    def set_value(self, value: Any) -> bool:
        """通过值控制蜂鸣器"""
        if isinstance(value, (int, float)):
            return self.beep(float(value))
        elif isinstance(value, str):
            v = value.lower().strip()
            if v == "on":
                return self.turn_on()
            elif v == "off":
                return self.turn_off()
            else:
                logger.warning(f"未知控制值: {value}")
                return False
        return False
    
    def cleanup(self):
        """释放资源"""
        self._buzz_stop_event.set()
        if self._buzz_thread and self._buzz_thread.is_alive():
            self._buzz_thread.join(timeout=1)
        
        if self._lgpio_handle:
            try:
                lgpio.gpio_write(self._lgpio_handle, self.pin, 1)
                lgpio.gpio_free(self._lgpio_handle, self.pin)
                lgpio.gpiochip_close(self._lgpio_handle)
            except Exception:
                pass
            self._lgpio_handle = None
        
        self._initialized = False
        self._state = ActuatorState.OFF
        logger.info("蜂鸣器资源已释放")
    
    def get_status(self) -> Dict[str, Any]:
        """获取蜂鸣器完整状态（回馈信号）
        
        Returns:
            包含完整控制回馈信息的字典：
            - state: 当前状态 (on/off/error)
            - control_value: 上次蜂鸣时长 (秒)
            - pattern: 蜂鸣模式
            - command_count: 命令计数
            - pin: GPIO 引脚
            - initialized: 是否初始化成功
        """
        return {
            "id": self.actuator_id,
            "name": self.name,
            "type": self.actuator_type,
            "state": self._state.value,
            "control_value": self._last_duration,
            "pattern": self._last_pattern,
            "command_count": self._command_count,
            "pin": self.pin,
            "initialized": self._initialized,
            "feedback_required": True,
            "feedback_fields": [
                "state",
                "control_value",
                "pattern",
                "command_count",
                "pin"
            ]
        }
    
    def get_feedback(self) -> Dict[str, Any]:
        """获取控制回馈信号（用于命令回执）
        
        Returns:
            命令回执数据
        """
        return {
            "node_id": self.actuator_id,
            "type": self.actuator_type,
            "state": self._state.value,
            "control_value": self._last_duration,
            "pattern": self._last_pattern,
            "command_count": self._command_count,
            "status": "executed" if self._initialized else "error",
        }
