#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""GPIO 数字传感器扫描器 - 扫描已配置的GPIO引脚"""

import logging
from typing import List, Dict, Any

from scanner.base import ScanResult

logger = logging.getLogger(__name__)


# 已知 GPIO 数字传感器 (引脚列表用于扫描，已知设备映射)
# 树莓派5 GPIO BCM 编号可用范围
GPIO_SCAN_PINS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27]

# 已知数字传感器类型 (通过特征识别)
KNOWN_GPIO_DEVICES = {
    "button": {"driver": "Button", "name": "按键", "config_key": "pin"},
    "vibration": {"driver": "VibrationSensor", "name": "振动传感器", "config_key": "pin"},
    "pir": {"driver": "PIRSensor", "name": "PIR人体感应", "config_key": "pin"},
    "tilt": {"driver": "TiltSensor", "name": "倾斜开关", "config_key": "pin"},
    "touch": {"driver": "TouchSensor", "name": "触摸传感器", "config_key": "pin"},
    "reed": {"driver": "ReedSwitch", "name": "干簧管", "config_key": "pin"},
    "obstacle": {"driver": "ObstacleSensor", "name": "红外避障", "config_key": "pin"},
    "flame": {"driver": "FlameSensor", "name": "火焰传感器", "config_key": "pin"},
    "hall": {"driver": "HallSensor", "name": "霍尔传感器", "config_key": "pin"},
    "sound": {"driver": "SoundSensor", "name": "声音传感器", "config_key": "pin"},
    "track": {"driver": "TrackSensor", "name": "循迹传感器", "config_key": "pin"},
}


class GPIOScanner:
    """GPIO 数字传感器扫描器"""

    def __init__(self, scan_pins: List[int] = None, exclude_pins: List[int] = None):
        """初始化 GPIO 扫描器

        Args:
            scan_pins: 要扫描的引脚列表，默认 GPIO_SCAN_PINS
            exclude_pins: 排除的引脚列表（已被占用的引脚）
        """
        self.scan_pins = scan_pins or GPIO_SCAN_PINS
        self.exclude_pins = set(exclude_pins or [])

    def _try_init_pin(self, pin: int):
        """尝试初始化 GPIO 引脚（用 Button 模式，可识别大多数数字传感器）

        Args:
            pin: BCM 编号的 GPIO 引脚

        Returns:
            (Button 实例, 状态值) 或 (None, None)
        """
        try:
            from gpiozero import Button
            device = Button(pin, pull_up=True)
            # 简单延迟以稳定
            import time
            time.sleep(0.05)
            state = device.is_active
            return device, state
        except Exception as e:
            logger.debug(f"GPIO pin {pin} probe failed: {e}")
            return None, None

    def scan(self) -> List[ScanResult]:
        """扫描 GPIO 引脚，返回发现的设备列表

        Returns:
            扫描结果列表
        """
        results: List[ScanResult] = []
        logger.info(f"Scanning GPIO pins: {self.scan_pins}")

        try:
            from gpiozero import Button  # noqa: F401
        except ImportError:
            logger.warning("gpiozero not available, GPIO scan skipped")
            return results

        for pin in self.scan_pins:
            if pin in self.exclude_pins:
                continue

            device, state = self._try_init_pin(pin)
            if device is None:
                continue

            try:
                device.close()
            except Exception:
                pass

            # 检测到引脚上有设备（无法精确识别类型，标记为通用数字传感器）
            # 默认推断为通用按键类型，置信度较低
            result = ScanResult(
                interface="gpio",
                address=str(pin),
                device_type="gpio_digital_generic",
                name=f"GPIO数字传感器 (引脚 {pin})",
                driver="GPIOButton",
                config={"pin": pin},
                confidence=0.4,  # GPIO 类型识别置信度低，需要用户在UI中确认
                raw_data={"pin": pin, "initial_state": bool(state), "pull_up": True},
            )
            results.append(result)
            logger.info(f"GPIO device found: pin {pin}, initial state: {state}")

        logger.info(f"GPIO scan complete, found {len(results)} potential devices")
        return results
