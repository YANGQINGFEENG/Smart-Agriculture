#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""光照传感器驱动 (LM393 + MCP3008)

LM393 光敏传感器模块特性：
- 模拟输出，需要通过 MCP3008 ADC 读取
- 光照越强，阻值越小，输出电压越高
- 光照越弱，阻值越大，输出电压越低

硬件接线：
- LM393 VCC -> 5V 或 3.3V
- LM393 GND -> GND
- LM393 AO -> MCP3008 AIN0 (通道0)
"""

import logging
from datetime import datetime
from typing import Any, Dict

from drivers.sensors.base import BaseSensor, DataQuality

logger = logging.getLogger(__name__)


def MAP(x, in_min, in_max, out_min, out_max):
    """将值从输入范围映射到输出范围
    
    Args:
        x: 输入值
        in_min: 输入最小值
        in_max: 输入最大值
        out_min: 输出最小值
        out_max: 输出最大值
    
    Returns:
        映射后的值
    """
    return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min


class LightSensor(BaseSensor):
    """光照传感器驱动
    
    使用 MCP3008 ADC 读取 LM393 光敏传感器的模拟值，
    使用 MAP 函数将 ADC 原始值 (0-1023) 映射为亮度值 (0-255)，
    并转换为光照强度百分比 (0-100%)。
    """
    
    DEFAULT_CHANNEL = 0
    CACHE_TTL = 2
    
    def __init__(self, sensor_id: str = "light", name: str = "光照传感器",
                 adc_channel: int = 0, config: Dict = None, **kwargs):
        """初始化光照传感器"""
        if not config:
            config = {}
        for key, value in kwargs.items():
            if value is not None:
                config[key] = value
                
        super().__init__(sensor_id, name, "light", config)
        
        self.adc_channel = adc_channel or config.get("adc_channel", 0)
        self._adc_driver = None
        self._initialized = False
        
        # 缓存数据
        self._last_value = None
        self._last_time = None
        
        # 光照阈值配置
        self.bright_threshold = config.get("bright_threshold", 70)  # 强光阈值
        self.dark_threshold = config.get("dark_threshold", 30)  # 弱光阈值
    
    def initialize(self) -> bool:
        """初始化光照传感器"""
        try:
            from drivers.adc.mcp3008 import MCP3008Driver
            
            adc_config = {
                "channels": {
                    str(self.adc_channel): {
                        "channel": self.adc_channel,
                        "name": "light_sensor",
                        "type": "analog",
                        "unit": "lux",
                    }
                }
            }
            
            self._adc_driver = MCP3008Driver(adc_config)
            result = self._adc_driver.initialize()
            
            if result:
                self._initialized = True
                logger.info(f"光照传感器初始化成功: ADC通道={self.adc_channel}")
            else:
                logger.error("光照传感器初始化失败: ADC初始化失败")
                self._initialized = False
                
        except ImportError as e:
            logger.warning(f"光照传感器初始化失败: {e}")
            self._initialized = False
        except Exception as e:
            logger.error(f"光照传感器初始化错误: {e}")
            self._initialized = False
        
        return self._initialized
    
    def read(self) -> Dict[str, Any]:
        """读取光照数据
        
        使用 MAP 函数将 ADC 原始值 (0-1023) 映射为亮度值 (0-255)，
        然后计算光照百分比。
        
        Returns:
            Dict: 包含光照强度信息
        """
        if not self._initialized or not self._adc_driver:
            return {
                "value": None,
                "unit": "%",
                "quality": DataQuality.UNAVAILABLE
            }
        
        try:
            # 读取 ADC 原始值 (0-1023)
            raw_adc = self._adc_driver.read_raw(self.adc_channel)
            
            if raw_adc is None:
                logger.warning("光照传感器读取失败: ADC 返回 None")
                return {
                    "value": None,
                    "unit": "%",
                    "quality": DataQuality.ERROR
                }
            
            # 限制 ADC 值范围 (0-1023)
            raw_adc = max(0, min(1023, raw_adc))
            
            # 使用 MAP 函数将 ADC 原始值 (0-1023) 映射为亮度值 (0-255)
            brightness_value = round(MAP(raw_adc, 0, 1023, 0, 255))
            
            # 转换为百分比 (0-100%)
            brightness_percent = round((brightness_value / 255) * 100, 1)
            
            # 判断光照等级
            if brightness_percent >= self.bright_threshold:
                level = "bright"
            elif brightness_percent <= self.dark_threshold:
                level = "dark"
            else:
                level = "normal"
            
            # 更新缓存
            self._last_value = {
                "raw_adc": raw_adc,
                "brightness_value": brightness_value,
                "brightness_percent": brightness_percent,
                "level": level,
            }
            self._last_time = datetime.now()
            
            logger.debug(f"光照传感器数据: ADC={raw_adc}, 亮度值={brightness_value}, 百分比={brightness_percent}%, 等级={level}")
            
            return {
                "value": brightness_percent,
                "unit": "%",
                "quality": DataQuality.GOOD,
                "raw_adc": raw_adc,
                "brightness_value": brightness_value,
                "level": level,
            }
            
        except Exception as e:
            logger.error(f"光照传感器读取错误: {e}")
            return {
                "value": None,
                "unit": "%",
                "quality": DataQuality.ERROR
            }
    
    def get_detail(self) -> Dict[str, Any]:
        """获取详细的光照数据"""
        if self._last_value:
            return self._last_value
        return {"raw_adc": 0, "brightness_value": 0, "brightness_percent": 0, "level": "unknown"}
    
    def cleanup(self):
        """释放资源"""
        if self._adc_driver:
            self._adc_driver.cleanup()
            self._adc_driver = None
        self._initialized = False
        logger.info("光照传感器资源已释放")
