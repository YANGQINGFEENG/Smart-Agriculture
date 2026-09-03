#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""继电器执行器 - 使用统一 GPIO 管理器"""

from typing import Dict
from drivers.actuators.base import BaseActuator, ActuatorState
from drivers.gpio_manager import gpio_manager


class RelayActuator(BaseActuator):
    """继电器执行器"""

    def __init__(self, actuator_id: str = "relay", name: str = "继电器",
                 pin: int = 16, config: Dict = None):
        super().__init__(actuator_id, name, "relay", config)
        self.pin = pin
        self._initialized = False
        self._state = ActuatorState.OFF

    def initialize(self) -> bool:
        """初始化继电器 - 使用 GPIO 管理器申请引脚"""
        # 确保 GPIO 管理器已初始化
        if not gpio_manager.is_initialized():
            gpio_manager.initialize()
        
        # 申请输出引脚（默认关闭）
        if gpio_manager.claim_output(self.pin, self.actuator_id, initial_value=0):
            self._initialized = True
            self._state = ActuatorState.OFF
            self.logger.info(f"Relay initialized: pin={self.pin}")
            return True
        else:
            self.logger.error(f"Relay init failed: cannot claim pin {self.pin}")
            return False

    def turn_on(self) -> bool:
        """打开继电器"""
        if not self._initialized:
            return False
            
        try:
            if gpio_manager.write(self.pin, 1):
                self._state = ActuatorState.ON
                self.logger.info("Relay ON")
                return True
            else:
                self._state = ActuatorState.ERROR
                return False
        except Exception as e:
            self.logger.error(f"Relay turn on error: {e}")
            self._state = ActuatorState.ERROR
            return False

    def turn_off(self) -> bool:
        """关闭继电器"""
        if not self._initialized:
            return False
            
        try:
            if gpio_manager.write(self.pin, 0):
                self._state = ActuatorState.OFF
                self.logger.info("Relay OFF")
                return True
            else:
                self._state = ActuatorState.ERROR
                return False
        except Exception as e:
            self.logger.error(f"Relay turn off error: {e}")
            self._state = ActuatorState.ERROR
            return False

    def get_hardware_state(self) -> bool:
        """读取硬件实际状态"""
        if not self._initialized:
            return False
        try:
            value = gpio_manager.read(self.pin)
            return value == 1
        except Exception as e:
            self.logger.error(f"Relay read state error: {e}")
            return False

    def cleanup(self):
        """释放引脚资源"""
        gpio_manager.release(self.pin, self.actuator_id)
        self._initialized = False
        self._state = ActuatorState.UNKNOWN
