#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ADC 模拟传感器扫描器 - 扫描 MCP3008 ADC 通道"""

import logging
import time
from typing import List

from scanner.base import ScanResult

logger = logging.getLogger(__name__)


# 已知 ADC 模拟传感器（通过电压范围/数值特征粗略识别）
# MCP3008 共 8 个通道 (0-7)
ADC_CHANNELS = list(range(8))

# 已知模拟传感器阈值特征 (类型 -> 电压范围)
# 注意：模拟传感器只能识别通道有信号，无法精确识别类型
KNOWN_ADC_DEVICES = {
    "light": {"driver": "LightSensor", "name": "光照传感器", "unit": "lux", "max_value": 1000},
    "soil_moisture": {"driver": "SoilMoistureSensor", "name": "土壤湿度传感器", "unit": "%", "max_value": 100},
    "sound": {"driver": "SoundSensor", "name": "声音传感器", "unit": "", "max_value": 100},
    "rain": {"driver": "RainSensor", "name": "雨滴传感器", "unit": "", "max_value": 100},
    " potentiometer": {"driver": "Potentiometer", "name": "电位器", "unit": "", "max_value": 100},
    "gas": {"driver": "GasSensor", "name": "烟雾传感器", "unit": "", "max_value": 100},
    "flame_analog": {"driver": "FlameAnalogSensor", "name": "火焰传感器", "unit": "", "max_value": 100},
}


class ADCScanner:
    """ADC 模拟传感器扫描器 - 基于 MCP3008"""

    def __init__(self, channels: List[int] = None, threshold: float = 0.05):
        """初始化 ADC 扫描器

        Args:
            channels: 要扫描的通道列表，默认 [0,1,2,3,4,5,6,7]
            threshold: 通道活跃阈值 (0.0-1.0)，超过此值认为有设备接入
        """
        self.channels = channels or ADC_CHANNELS
        self.threshold = threshold

    def _try_read_channel(self, channel: int):
        """尝试读取 ADC 通道

        Returns:
            (值0-1, raw_int 0-1023) 或 (None, None)
        """
        try:
            from gpiozero import MCP3008
            adc = MCP3008(channel=channel)
            time.sleep(0.05)  # 稳定读取
            value = adc.value
            raw = int(adc.value * 1023)
            adc.close()
            return value, raw
        except Exception as e:
            logger.debug(f"ADC channel {channel} read failed: {e}")
            return None, None

    def scan(self) -> List[ScanResult]:
        """扫描 ADC 通道，返回发现的设备列表

        Returns:
            扫描结果列表
        """
        results: List[ScanResult] = []

        try:
            from gpiozero import MCP3008  # noqa: F401
        except ImportError:
            logger.warning("gpiozero not available, ADC scan skipped")
            return results

        logger.info(f"Scanning ADC channels: {self.channels}")

        for channel in self.channels:
            value, raw = self._try_read_channel(channel)
            if value is None:
                continue

            # 通道有信号变化即认为有设备
            if value > self.threshold:
                # ADC 无法精确识别类型，标记为通用模拟传感器
                result = ScanResult(
                    interface="adc",
                    address=str(channel),
                    device_type="adc_analog_generic",
                    name=f"ADC模拟传感器 (通道 {channel})",
                    driver="ADCSensor",
                    config={"channel": channel},
                    confidence=0.4,  # ADC 类型识别置信度低
                    raw_data={
                        "channel": channel,
                        "value": value,
                        "raw_int": raw,
                        "voltage_estimate": round(value * 3.3, 2),
                    },
                )
                results.append(result)
                logger.info(
                    f"ADC device found: channel {channel}, value={value:.2f}, raw={raw}"
                )

        logger.info(f"ADC scan complete, found {len(results)} devices")
        return results
