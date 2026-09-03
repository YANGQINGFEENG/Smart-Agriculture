#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""传感器基类"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from datetime import datetime
import logging


class DataQuality:
    """数据质量"""
    GOOD = "good"
    ERROR = "error"
    CALIBRATING = "calibrating"
    UNAVAILABLE = "unavailable"


class BaseSensor(ABC):
    """传感器抽象基类"""

    def __init__(self, sensor_id: str, name: str, sensor_type: str, config: Dict = None):
        """
        Args:
            sensor_id: 传感器唯一ID
            name: 传感器名称
            sensor_type: 传感器类型
            config: 配置参数
        """
        self.sensor_id = sensor_id
        self.name = name
        self.sensor_type = sensor_type
        self.config = config or {}
        self._initialized = False
        self._last_value = None
        self._last_time = None
        self.logger = logging.getLogger(f"sensor.{sensor_id}")

    @abstractmethod
    def initialize(self) -> bool:
        """初始化传感器"""
        pass

    @abstractmethod
    def read(self) -> Dict[str, Any]:
        """
        读取数据

        Returns:
            {
                "value": Any,
                "unit": str,
                "quality": str
            }
        """
        pass

    @abstractmethod
    def cleanup(self):
        """清理资源"""
        pass

    def get_status(self) -> Dict[str, Any]:
        """获取传感器状态"""
        return {
            "id": self.sensor_id,
            "name": self.name,
            "type": self.sensor_type,
            "initialized": self._initialized,
            "last_value": self._last_value,
            "last_time": self._last_time.isoformat() if self._last_time else None
        }

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        data = self.read()
        return {
            "sensor_id": self.sensor_id,
            "name": self.name,
            "type": self.sensor_type,
            "timestamp": datetime.now().isoformat(),
            "data": data,
            "quality": data.get("quality", DataQuality.GOOD)
        }
