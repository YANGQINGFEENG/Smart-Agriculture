#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""风扇驱动 (L293D + lgpio)

通过 L293D 电机驱动模块控制直流电机风扇，
使用 lgpio 库进行控制（树莓派5兼容）。

硬件接线：
- L293D ENA (使能/PWM) -> GPIO20
- L293D IN1 (方向1) -> GPIO21
- L293D IN2 (方向2) -> GPIO22
- L293D MOTOR A -> 风扇电机
"""

import logging
from typing import Any, Dict

from drivers.actuators.base import BaseActuator, ActuatorState

logger = logging.getLogger(__name__)

try:
    import lgpio
    HAS_LGPIO = True
except ImportError:
    HAS_LGPIO = False


class FanActuator(BaseActuator):
    """风扇执行器
    
    支持风扇的开关控制、方向控制和速度调节。
    """
    
    DIR_FORWARD = "forward"
    DIR_BACKWARD = "backward"
    DIR_STOP = "stop"
    
    def __init__(self, actuator_id: str = "fan", name: str = "风扇",
                 enable_pin: int = 20, forward_pin: int = 21, 
                 backward_pin: int = 22, config: Dict = None, **kwargs):
        """初始化风扇执行器"""
        if not config:
            config = {}
        for key, value in kwargs.items():
            if value is not None:
                config[key] = value
                
        super().__init__(actuator_id, name, "fan", config)
        self.enable_pin = enable_pin or config.get("enable_pin", 20)
        self.forward_pin = forward_pin or config.get("forward_pin", 21)
        self.backward_pin = backward_pin or config.get("backward_pin", 22)
        self._lgpio_handle = None
        self._speed = 0
        self._direction = self.DIR_STOP
    
    def initialize(self) -> bool:
        """初始化风扇执行器"""
        if not HAS_LGPIO:
            logger.warning("lgpio 库未安装，风扇驱动不可用")
            self._initialized = False
            return False
        
        try:
            # 打开 GPIO 芯片
            self._lgpio_handle = lgpio.gpiochip_open(0)
            if self._lgpio_handle < 0:
                logger.error("GPIO 芯片打开失败")
                self._initialized = False
                return False
            
            # 初始化引脚为输出
            lgpio.gpio_claim_output(self._lgpio_handle, self.enable_pin)
            lgpio.gpio_claim_output(self._lgpio_handle, self.forward_pin)
            lgpio.gpio_claim_output(self._lgpio_handle, self.backward_pin)
            # 初始为低电平
            lgpio.gpio_write(self._lgpio_handle, self.enable_pin, 0)
            lgpio.gpio_write(self._lgpio_handle, self.forward_pin, 0)
            lgpio.gpio_write(self._lgpio_handle, self.backward_pin, 0)
            
            self._state = ActuatorState.OFF
            self._direction = self.DIR_STOP
            self._speed = 0
            self._initialized = True
            logger.info(f"风扇初始化成功: ENA={self.enable_pin}, IN1={self.forward_pin}, IN2={self.backward_pin}")
            return True
        except Exception as e:
            logger.error(f"风扇初始化错误: {e}")
            self._initialized = False
            return False
    
    def turn_on(self) -> bool:
        """打开风扇"""
        return self.set_speed(1.0, self.DIR_FORWARD)
    
    def turn_off(self) -> bool:
        """关闭风扇"""
        return self.set_speed(0, self.DIR_STOP)
    
    def set_speed(self, speed: float, direction: str = DIR_FORWARD) -> bool:
        """设置风扇速度和方向"""
        if not self._initialized or not self._lgpio_handle:
            return False
        
        try:
            speed = max(0.0, min(1.0, speed))
            
            if direction == self.DIR_FORWARD and speed > 0:
                lgpio.gpio_write(self._lgpio_handle, self.forward_pin, 1)
                lgpio.gpio_write(self._lgpio_handle, self.backward_pin, 0)
                lgpio.gpio_write(self._lgpio_handle, self.enable_pin, int(speed * 255))
            elif direction == self.DIR_BACKWARD and speed > 0:
                lgpio.gpio_write(self._lgpio_handle, self.forward_pin, 0)
                lgpio.gpio_write(self._lgpio_handle, self.backward_pin, 1)
                lgpio.gpio_write(self._lgpio_handle, self.enable_pin, int(speed * 255))
            else:  # STOP 或 speed == 0
                lgpio.gpio_write(self._lgpio_handle, self.forward_pin, 0)
                lgpio.gpio_write(self._lgpio_handle, self.backward_pin, 0)
                lgpio.gpio_write(self._lgpio_handle, self.enable_pin, 0)
            
            self._speed = speed
            self._direction = direction
            self._state = ActuatorState.ON if speed > 0 else ActuatorState.OFF
            logger.info(f"风扇设置: 速度={speed}, 方向={direction}")
            return True
        except Exception as e:
            logger.error(f"风扇控制失败: {e}")
            return False
    
    def set_value(self, value: Any) -> bool:
        """通过值控制风扇"""
        if isinstance(value, (int, float)):
            speed = float(value)
            if speed > 100:
                speed = 1.0
            elif speed > 1:
                speed = speed / 100.0
            elif speed < 0:
                speed = 0
            return self.set_speed(speed, self.DIR_FORWARD if speed > 0 else self.DIR_STOP)
        elif isinstance(value, str):
            v = value.lower().strip()
            if v == "on":
                return self.turn_on()
            elif v == "off":
                return self.turn_off()
            elif v == "forward":
                return self.set_speed(self._speed or 1.0, self.DIR_FORWARD)
            elif v == "backward":
                return self.set_speed(self._speed or 1.0, self.DIR_BACKWARD)
        return False
    
    def cleanup(self):
        """释放资源"""
        if self._lgpio_handle:
            try:
                lgpio.gpio_write(self._lgpio_handle, self.enable_pin, 0)
                lgpio.gpio_write(self._lgpio_handle, self.forward_pin, 0)
                lgpio.gpio_write(self._lgpio_handle, self.backward_pin, 0)
                lgpio.gpio_free(self._lgpio_handle, self.enable_pin)
                lgpio.gpio_free(self._lgpio_handle, self.forward_pin)
                lgpio.gpio_free(self._lgpio_handle, self.backward_pin)
                lgpio.gpiochip_close(self._lgpio_handle)
            except Exception:
                pass
            self._lgpio_handle = None
        self._initialized = False
        self._state = ActuatorState.OFF
        logger.info("风扇资源已释放")
    
    def get_status(self) -> Dict[str, Any]:
        """获取风扇完整状态（回馈信号）
        
        Returns:
            包含完整控制回馈信息的字典：
            - state: 当前状态 (on/off/error)
            - control_value: 控制值 (0-100%)
            - direction: 旋转方向
            - speed: 当前速度 (0.0-1.0)
            - pins: GPIO 引脚状态
            - initialized: 是否初始化成功
        """
        return {
            "id": self.actuator_id,
            "name": self.name,
            "type": self.actuator_type,
            "state": self._state.value,
            "control_value": round(self._speed * 100),
            "direction": self._direction,
            "speed": round(self._speed, 2),
            "pins": {
                "enable": self.enable_pin,
                "forward": self.forward_pin,
                "backward": self.backward_pin,
            },
            "initialized": self._initialized,
            "feedback_required": True,
            "feedback_fields": [
                "state",
                "control_value",
                "direction",
                "speed",
                "pins"
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
            "control_value": round(self._speed * 100),
            "direction": self._direction,
            "executed_at": self._last_command_time if hasattr(self, '_last_command_time') else None,
            "status": "executed" if self._initialized else "error",
        }
