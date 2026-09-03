#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""扫描结果数据结构"""

from dataclasses import dataclass, field
from typing import Any, Dict, Optional
from datetime import datetime


@dataclass
class ScanResult:
    """扫描结果 - 描述一个被发现的设备"""
    interface: str                  # 接口类型: i2c/gpio/adc/onewire
    address: str                    # 设备地址 (I2C地址/GPIO引脚号/ADC通道/1-Wire ID)
    device_type: str                # 推断的设备类型 (如 bmp280/ds18b20/relay/light_sensor)
    name: str = ""                  # 设备名称
    driver: str = ""                # 推荐的驱动类名
    config: Dict[str, Any] = field(default_factory=dict)  # 设备初始化配置参数
    confidence: float = 1.0         # 识别置信度 (0.0-1.0)
    raw_data: Dict[str, Any] = field(default_factory=dict)  # 原始扫描数据
    discovered_at: datetime = field(default_factory=datetime.now)  # 发现时间

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "interface": self.interface,
            "address": self.address,
            "device_type": self.device_type,
            "name": self.name,
            "driver": self.driver,
            "config": self.config,
            "confidence": self.confidence,
            "raw_data": self.raw_data,
            "discovered_at": self.discovered_at.isoformat(),
        }
