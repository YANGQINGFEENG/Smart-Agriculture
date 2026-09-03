#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""1-Wire 设备扫描器 - 扫描 DS18B20 等 1-Wire 总线设备"""

import os
import glob
import logging
from typing import List

from scanner.base import ScanResult

logger = logging.getLogger(__name__)


# 1-Wire 设备家族代码 (family_id -> 设备类型)
# https://github.com/owfs/owfs-doc/blob/master/family.md
KNOWN_1WIRE_FAMILIES = {
    "10": {"device_type": "ds18b20", "driver": "DS18B20Sensor", "name": "DS18B20 温度传感器"},
    "22": {"device_type": "ds18b20", "driver": "DS18B20Sensor", "name": "DS1822 温度传感器"},
    "28": {"device_type": "ds18b20", "driver": "DS18B20Sensor", "name": "DS18B20 温度传感器"},
    "3b": {"device_type": "ds18b20", "driver": "DS18B20Sensor", "name": "DS18S20 温度传感器"},
    "26": {"device_type": "ds2438", "driver": "DS2438Sensor", "name": "DS2438 电池监控"},
    "29": {"device_type": "ds2408", "driver": "DS2408", "name": "DS2408 8路IO"},
    "3a": {"device_type": "ds2413", "driver": "DS2413", "name": "DS2413 双路IO"},
    "12": {"device_type": "ds2406", "driver": "DS2406", "name": "DS2406 双路IO"},
    "81": {"device_type": "ds1420", "driver": "DS1420", "name": "DS1420 加密"},
}


class OneWireScanner:
    """1-Wire 总线设备扫描器"""

    def __init__(self, bus_path: str = None):
        """初始化 1-Wire 扫描器

        Args:
            bus_path: 1-Wire 总线路径，默认为 /sys/bus/w1/devices/
        """
        self.bus_path = bus_path or "/sys/bus/w1/devices/"

    def _list_devices(self) -> List[str]:
        """列出所有已挂载的 1-Wire 设备 ID"""
        try:
            if not os.path.exists(self.bus_path):
                logger.warning(f"1-Wire bus path not found: {self.bus_path}")
                logger.warning("Hint: enable 1-Wire in /boot/firmware/config.txt: dtoverlay=w1-gpio")
                return []
            entries = os.listdir(self.bus_path)
            # 过滤掉 w1_bus_master1 等总线本身条目
            devices = []
            for entry in entries:
                # 1-Wire 设备 ID 格式: XX-YYYYYYYYYYYY (XX是家族代码)
                if "-" in entry and len(entry) >= 15:
                    devices.append(entry)
            return devices
        except Exception as e:
            logger.error(f"List 1-Wire devices failed: {e}")
            return []

    def _read_temperature(self, device_id: str) -> float:
        """读取 DS18B20 温度（如果设备是温度传感器）"""
        try:
            w1_path = os.path.join(self.bus_path, device_id, "w1_slave")
            if not os.path.exists(w1_path):
                return None
            with open(w1_path, "r") as f:
                content = f.read()
            # 文件格式: 第一行 CRC 校验，第二行 t=xxxxx (千分之一度)
            for line in content.split("\n"):
                if "t=" in line:
                    temp_str = line.split("t=")[-1].strip()
                    return int(temp_str) / 1000.0
            return None
        except Exception as e:
            logger.debug(f"Read 1-Wire device {device_id} failed: {e}")
            return None

    def scan(self) -> List[ScanResult]:
        """扫描 1-Wire 总线，返回发现的设备列表

        Returns:
            扫描结果列表
        """
        results: List[ScanResult] = []
        devices = self._list_devices()

        if not devices:
            logger.info("No 1-Wire devices found")
            return results

        logger.info(f"Scanning 1-Wire devices: {devices}")

        for device_id in devices:
            try:
                # 解析家族代码
                family_code = device_id.split("-")[0].lower()
                family_info = KNOWN_1WIRE_FAMILIES.get(family_code, {
                    "device_type": f"unknown_1wire_{family_code}",
                    "driver": "UnknownOneWireDevice",
                    "name": f"未知 1-Wire 设备 ({device_id})",
                })

                raw_data = {"device_id": device_id, "family_code": family_code}

                # 如果是温度传感器，尝试读取当前温度作为特征
                if family_info["device_type"] == "ds18b20":
                    temp = self._read_temperature(device_id)
                    if temp is not None:
                        raw_data["current_temperature"] = temp
                        raw_data["verified"] = True

                result = ScanResult(
                    interface="onewire",
                    address=device_id,
                    device_type=family_info["device_type"],
                    name=family_info["name"],
                    driver=family_info["driver"],
                    config={"device_id": device_id, "device_path": os.path.join(self.bus_path, device_id)},
                    confidence=0.95 if family_code in KNOWN_1WIRE_FAMILIES else 0.5,
                    raw_data=raw_data,
                )
                results.append(result)
                logger.info(f"1-Wire device found: {device_id} -> {family_info['name']}")

            except Exception as e:
                logger.error(f"Parse 1-Wire device {device_id} failed: {e}")

        logger.info(f"1-Wire scan complete, found {len(results)} devices")
        return results
