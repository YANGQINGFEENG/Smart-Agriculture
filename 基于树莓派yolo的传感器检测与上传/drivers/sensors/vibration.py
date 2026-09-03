#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""振动传感器 - 使用统一 GPIO 管理器，参考程序案例逻辑"""

from datetime import datetime
from typing import Any, Dict
from drivers.sensors.base import BaseSensor, DataQuality
from drivers.gpio_manager import gpio_manager


class VibrationSensor(BaseSensor):
    """振动传感器 - 使用统一 GPIO 管理器"""

    def __init__(self, sensor_id: str = "vibration", name: str = "振动传感器",
                 pin: int = 12, config: Dict = None):
        super().__init__(sensor_id, name, "vibration", config)
        self.pin = pin
        self._initialized = False

    def initialize(self) -> bool:
        """初始化传感器（使用 GPIO 管理器，参考程序案例：使用上拉电阻）"""
        # 确保 GPIO 管理器已初始化
        if not gpio_manager.is_initialized():
            gpio_manager.initialize()
        
        # 使用上拉电阻，振动时引脚变低
        # pull_up_down: 0=无, 1=上拉, 2=下拉
        if gpio_manager.claim_input(self.pin, self.sensor_id, pull_up_down=1):
            self._initialized = True
            self.logger.info(f"Vibration sensor initialized: pin={self.pin}")
            return True
        else:
            self.logger.error(f"Vibration init failed: cannot claim pin {self.pin}")
            return False

    def read(self) -> Dict[str, Any]:
        """读取振动状态（参考程序案例：振动时引脚变低）
        
        Returns:
            Dict: value=1表示有振动, 0表示无振动
        """
        if not self._initialized:
            return {"value": None, "unit": "", "quality": DataQuality.UNAVAILABLE}

        try:
            # 振动传感器触发时，引脚变低（上拉电阻模式）
            value = gpio_manager.read(self.pin)
            vibrating = value == 0 if value is not None else False
            # 将布尔值转换为数字：1=振动, 0=无振动
            value_num = 1 if vibrating else 0
            
            self._last_value = value_num
            self._last_time = datetime.now()

            return {
                "value": value_num,
                "unit": "",
                "quality": DataQuality.GOOD
            }
        except Exception as e:
            self.logger.error(f"Vibration read error: {e}")
            return {"value": None, "unit": "", "quality": DataQuality.ERROR}

    def cleanup(self):
        """释放引脚资源"""
        gpio_manager.release(self.pin, self.sensor_id)
        self._initialized = False
