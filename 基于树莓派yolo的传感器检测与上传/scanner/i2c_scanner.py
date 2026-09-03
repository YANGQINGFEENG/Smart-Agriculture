#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""I2C 设备扫描器 - 扫描 I2C 总线上的设备"""

import logging
from typing import List

from scanner.base import ScanResult

logger = logging.getLogger(__name__)


# 已知 I2C 设备地址表 (address -> 设备类型/驱动/名称)
KNOWN_I2C_DEVICES = {
    0x76: {"device_type": "bmp280", "driver": "BMP280Sensor", "name": "BMP280 气压传感器", "config": {"address": 0x76}},
    0x77: {"device_type": "bmp280", "driver": "BMP280Sensor", "name": "BMP280 气压传感器", "config": {"address": 0x77}},
    0x68: {"device_type": "mpu6050", "driver": "MPU6050Sensor", "name": "MPU6050 陀螺仪", "config": {"address": 0x68}},
    0x69: {"device_type": "mpu6050", "driver": "MPU6050Sensor", "name": "MPU6050 陀螺仪", "config": {"address": 0x69}},
    0x27: {"device_type": "lcd1602", "driver": "LCD1602", "name": "I2C LCD1602", "config": {"address": 0x27}},
    0x3F: {"device_type": "lcd1602", "driver": "LCD1602", "name": "I2C LCD1602", "config": {"address": 0x3F}},
    0x48: {"device_type": "pcf8591", "driver": "PCF8591", "name": "PCF8591 ADC", "config": {"address": 0x48}},
    0x40: {"device_type": "sht30", "driver": "SHT30Sensor", "name": "SHT30 温湿度传感器", "config": {"address": 0x40}},
    0x44: {"device_type": "sht30", "driver": "SHT30Sensor", "name": "SHT30 温湿度传感器", "config": {"address": 0x44}},
    0x70: {"device_type": "pca9685", "driver": "PCA9685", "name": "PCA9685 舵机驱动板", "config": {"address": 0x70}},
    0x5A: {"device_type": "max30102", "driver": "MAX30102Sensor", "name": "MAX30102 心率传感器", "config": {"address": 0x5A}},
    0x29: {"device_type": "vl53l0x", "driver": "VL53L0XSensor", "name": "VL53L0X 激光测距", "config": {"address": 0x29}},
}


class I2CScanner:
    """I2C 总线设备扫描器"""

    def __init__(self, bus_number: int = 1):
        """初始化 I2C 扫描器

        Args:
            bus_number: I2C 总线编号（树莓派默认为 1）
        """
        self.bus_number = bus_number
        self._i2c = None

    def _get_bus(self):
        """获取 I2C 总线实例"""
        if self._i2c is not None:
            return self._i2c
        try:
            import board
            self._i2c = board.I2C()
            return self._i2c
        except Exception as e:
            logger.warning(f"I2C bus not available: {e}")
            return None

    def scan(self) -> List[ScanResult]:
        """扫描 I2C 总线，返回发现的设备列表

        Returns:
            扫描结果列表
        """
        results: List[ScanResult] = []
        i2c = self._get_bus()
        if i2c is None:
            logger.warning("I2C scan skipped - bus not available")
            return results

        logger.info(f"Scanning I2C bus {self.bus_number}...")
        for address in range(0x03, 0x78):  # 标准扫描范围 0x03-0x77
            try:
                while not i2c.try_lock():
                    pass
                try:
                    # 尝试写入并读取，验证设备存在
                    i2c.writeto(address, b'\x00')
                finally:
                    i2c.unlock()

                # 设备存在
                device_info = KNOWN_I2C_DEVICES.get(address, {
                    "device_type": f"unknown_i2c_{address:02X}",
                    "driver": "UnknownI2CDevice",
                    "name": f"未知 I2C 设备 0x{address:02X}",
                    "config": {"address": address},
                })

                result = ScanResult(
                    interface="i2c",
                    address=f"0x{address:02X}",
                    device_type=device_info["device_type"],
                    name=device_info["name"],
                    driver=device_info["driver"],
                    config=device_info["config"].copy(),
                    confidence=0.8 if address in KNOWN_I2C_DEVICES else 0.5,
                    raw_data={"bus": self.bus_number, "address_int": address},
                )
                results.append(result)
                logger.info(f"I2C device found: 0x{address:02X} -> {device_info['name']}")

            except OSError:
                # 该地址无设备
                continue
            except Exception as e:
                logger.debug(f"I2C scan address 0x{address:02X} error: {e}")
                continue

        logger.info(f"I2C scan complete, found {len(results)} devices")
        return results
