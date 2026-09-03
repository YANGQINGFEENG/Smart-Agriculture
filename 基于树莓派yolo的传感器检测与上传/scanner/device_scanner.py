#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""设备扫描管理器 - 统一调度所有接口的扫描器"""

import logging
import threading
from typing import List, Dict, Any, Optional, Callable

from scanner.base import ScanResult
from scanner.i2c_scanner import I2CScanner
from scanner.gpio_scanner import GPIOScanner
from scanner.adc_scanner import ADCScanner
from scanner.onewire_scanner import OneWireScanner

logger = logging.getLogger(__name__)


class DeviceScanner:
    """设备扫描管理器 - 协调多个扫描器并汇总结果"""

    def __init__(self, config: Dict[str, Any] = None):
        """初始化设备扫描管理器

        Args:
            config: 扫描器配置
                {
                    "enabled_interfaces": ["i2c", "gpio", "adc", "onewire"],
                    "i2c_bus": 1,
                    "gpio_scan_pins": [...],
                    "gpio_exclude_pins": [...],
                    "adc_channels": [0,1,2,3,4,5,6,7],
                    "adc_threshold": 0.05,
                    "onewire_bus_path": "/sys/bus/w1/devices/"
                }
        """
        config = config or {}
        self.enabled_interfaces = config.get(
            "enabled_interfaces", ["i2c", "gpio", "adc", "onewire"]
        )
        self._scanners: Dict[str, Any] = {}
        self._init_scanners(config)
        self._progress_callback: Optional[Callable[[str, int, int], None]] = None

    def _init_scanners(self, config: Dict[str, Any]):
        """初始化所有扫描器"""
        if "i2c" in self.enabled_interfaces:
            self._scanners["i2c"] = I2CScanner(bus_number=config.get("i2c_bus", 1))
        if "gpio" in self.enabled_interfaces:
            self._scanners["gpio"] = GPIOScanner(
                scan_pins=config.get("gpio_scan_pins"),
                exclude_pins=config.get("gpio_exclude_pins", []),
            )
        if "adc" in self.enabled_interfaces:
            self._scanners["adc"] = ADCScanner(
                channels=config.get("adc_channels"),
                threshold=config.get("adc_threshold", 0.05),
            )
        if "onewire" in self.enabled_interfaces:
            self._scanners["onewire"] = OneWireScanner(
                bus_path=config.get("onewire_bus_path")
            )

    def set_progress_callback(self, callback: Callable[[str, int, int], None]):
        """设置进度回调

        Args:
            callback: 回调函数，参数为 (interface_name, current_step, total_steps)
        """
        self._progress_callback = callback

    def _notify_progress(self, interface: str, current: int, total: int):
        """通知进度"""
        if self._progress_callback:
            try:
                self._progress_callback(interface, current, total)
            except Exception as e:
                logger.error(f"Progress callback error: {e}")

    def scan_interface(self, interface: str) -> List[ScanResult]:
        """扫描单个接口

        Args:
            interface: 接口名 (i2c/gpio/adc/onewire)

        Returns:
            扫描结果列表
        """
        scanner = self._scanners.get(interface)
        if not scanner:
            logger.warning(f"Scanner for interface '{interface}' not enabled")
            return []
        self._notify_progress(interface, 0, 1)
        try:
            results = scanner.scan()
            self._notify_progress(interface, 1, 1)
            return results
        except Exception as e:
            logger.error(f"Scan interface {interface} failed: {e}")
            return []

    def scan_all(self) -> List[ScanResult]:
        """扫描所有已启用的接口

        Returns:
            所有扫描结果列表
        """
        all_results: List[ScanResult] = []
        total_interfaces = len(self._scanners)
        logger.info(f"Starting device scan on {total_interfaces} interfaces...")

        for index, (interface_name, scanner) in enumerate(self._scanners.items()):
            self._notify_progress(interface_name, index, total_interfaces)
            try:
                results = scanner.scan()
                all_results.extend(results)
            except Exception as e:
                logger.error(f"Scan {interface_name} failed: {e}")
        self._notify_progress("done", total_interfaces, total_interfaces)

        logger.info(
            f"Scan complete, found {len(all_results)} devices on {total_interfaces} interfaces"
        )
        return all_results

    def scan_all_async(self, callback: Callable[[List[ScanResult]], None]):
        """异步扫描所有接口

        Args:
            callback: 完成回调，参数为扫描结果列表
        """
        def _scan_thread():
            try:
                results = self.scan_all()
                callback(results)
            except Exception as e:
                logger.error(f"Async scan failed: {e}")
                callback([])

        thread = threading.Thread(target=_scan_thread, daemon=True, name="device-scanner")
        thread.start()
        logger.info("Async device scan started")

    def get_enabled_interfaces(self) -> List[str]:
        """获取已启用的接口列表"""
        return list(self._scanners.keys())

    def to_config_sensors(self, results: List[ScanResult]) -> List[Dict]:
        """将扫描结果转换为 sensors.yaml 格式的传感器配置

        Args:
            results: 扫描结果列表

        Returns:
            传感器配置列表
        """
        sensor_configs = []
        for result in results:
            sensor_configs.append({
                "id": f"{result.device_type}_{result.address}".lower().replace("0x", "").replace("-", "_"),
                "type": result.device_type,
                "name": result.name,
                "enabled": True,
                "config": result.config,
                "discovered": True,
                "interface": result.interface,
                "address": result.address,
            })
        return sensor_configs
