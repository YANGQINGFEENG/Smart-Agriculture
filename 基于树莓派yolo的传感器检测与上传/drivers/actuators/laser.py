#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""激光执行器 - 使用统一 GPIO 管理器"""

from typing import Dict
from drivers.actuators.base import BaseActuator, ActuatorState
from drivers.gpio_manager import gpio_manager


class LaserActuator(BaseActuator):
    """激光执行器"""

    def __init__(self, actuator_id: str = "laser", name: str = "激光",
                 pin: int = 13, config: Dict = None):
        super().__init__(actuator_id, name, "laser", config)
        self.pin = pin
        self._initialized = False
        self._state = ActuatorState.OFF

    def initialize(self) -> bool:
        """初始化激光 - 使用 GPIO 管理器申请引脚"""
        if not gpio_manager.is_initialized():
            gpio_manager.initialize()
        
        if gpio_manager.claim_output(self.pin, self.actuator_id, initial_value=0):
            self._initialized = True
            self._state = ActuatorState.OFF
            self.logger.info(f"Laser initialized: pin={self.pin}")
            return True
        else:
            self.logger.error(f"Laser init failed: cannot claim pin {self.pin}")
            return False

    def turn_on(self) -> bool:
        """打开激光"""
        if not self._initialized:
            return False
            
        try:
            if gpio_manager.write(self.pin, 1):
                self._state = ActuatorState.ON
                self.logger.info("Laser ON")
                return True
            else:
                self._state = ActuatorState.ERROR
                return False
        except Exception as e:
            self.logger.error(f"Laser turn on error: {e}")
            self._state = ActuatorState.ERROR
            return False

    def turn_off(self) -> bool:
        """关闭激光"""
        if not self._initialized:
            return False
            
        try:
            if gpio_manager.write(self.pin, 0):
                self._state = ActuatorState.OFF
                self.logger.info("Laser OFF")
                return True
            else:
                self._state = ActuatorState.ERROR
                return False
        except Exception as e:
            self.logger.error(f"Laser turn off error: {e}")
            self._state = ActuatorState.ERROR
            return False

    def set_value(self, value: int) -> bool:
        """设置控制值（将数值控制转换为开关控制）
        
        Args:
            value: 控制值（0-100），大于0开启，等于0关闭
        
        Returns:
            是否成功
        """
        if value > 0:
            return self.turn_on()
        else:
            return self.turn_off()

    def get_hardware_state(self) -> bool:
        """读取硬件实际状态"""
        if not self._initialized:
            return False
        try:
            value = gpio_manager.read(self.pin)
            return value == 1
        except Exception as e:
            self.logger.error(f"Laser read state error: {e}")
            return False

    def cleanup(self):
        """释放引脚资源"""
        gpio_manager.release(self.pin, self.actuator_id)
        self._initialized = False
        self._state = ActuatorState.UNKNOWN
