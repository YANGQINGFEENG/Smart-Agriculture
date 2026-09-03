#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""MCP3008 ADC 模数转换模块驱动

MCP3008 是一款 8 通道 10 位 ADC 芯片，通过 SPI 接口与树莓派通信。
使用原生 SPI 接口，兼容树莓派 4/5。

硬件接线：
- VCC: 3.3V
- GND: GND
- CS: GPIO8 (CE0)
- CLK: GPIO11 (SCK)
- DOUT: GPIO9 (MISO)
- DIN: GPIO10 (MOSI)
"""

import logging
import time
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

try:
    import spidev
    HAS_SPIDEV = True
except ImportError:
    HAS_SPIDEV = False


class MCP3008Driver:
    """MCP3008 ADC 驱动类
    
    支持多通道模拟信号采集，用于连接模拟传感器（如光敏、土壤湿度等）。
    使用原生 spidev 库，避免 GPIOZero 的兼容性问题。
    """
    
    CHANNEL_COUNT = 8
    
    def __init__(self, config: Dict[str, Any] = None):
        """初始化 MCP3008 驱动"""
        self.config = config or {}
        self._initialized = False
        self._spi = None
        self._channel_mapping = self.config.get("channels", {})
        self._max_channel = 0
    
    def initialize(self) -> bool:
        """初始化 MCP3008 ADC"""
        if not HAS_SPIDEV:
            logger.warning("spidev 库未安装，MCP3008 驱动不可用")
            self._initialized = False
            return False
        
        try:
            # 打开 SPI 总线 0，设备 0 (CE0)
            self._spi = spidev.SpiDev()
            self._spi.open(0, 0)
            self._spi.max_speed_hz = 1000000  # 1MHz
            self._spi.mode = 0
            
            # 测试读取
            test_value = self._read_raw(0)
            if test_value is None:
                logger.error("MCP3008 测试读取失败")
                self._spi.close()
                self._spi = None
                self._initialized = False
                return False
            
            # 计算最大通道号
            for channel_key in self._channel_mapping:
                channel_num = self._channel_mapping[channel_key].get("channel", int(channel_key))
                self._max_channel = max(self._max_channel, channel_num)
            
            self._initialized = True
            logger.info(f"MCP3008 ADC 初始化成功，可用通道 0-{self._max_channel}")
            return True
            
        except Exception as e:
            logger.error(f"MCP3008 初始化错误: {e}")
            if self._spi:
                try:
                    self._spi.close()
                except Exception:
                    pass
                self._spi = None
            self._initialized = False
            return False
    
    def _read_raw(self, channel: int) -> Optional[int]:
        """读取原始 ADC 值 (0-1023)"""
        if not self._spi or not (0 <= channel <= 7):
            return None
        
        try:
            # MCP3008 通信协议：
            # 发送 3 字节：[开始位 + 通道选择, 0x00, 0x00]
            # 返回 3 字节：[无效, 高位数据, 低位数据]
            cmd = [0x01, (channel << 4) | 0x00, 0x00]
            response = self._spi.xfer2(cmd)
            
            # 从响应中提取 10 位数据
            value = ((response[1] & 0x03) << 8) | response[2]
            return value
            
        except Exception as e:
            logger.error(f"MCP3008 通道 {channel} 读取失败: {e}")
            return None
    
    def read_channel(self, channel: int) -> Optional[float]:
        """读取指定通道的模拟值 (0.0-1.0)"""
        raw = self._read_raw(channel)
        if raw is None:
            return None
        return raw / 1023.0
    
    def read_raw(self, channel: int) -> Optional[int]:
        """读取指定通道的原始值 (0-1023)"""
        return self._read_raw(channel)
    
    def read_all_channels(self) -> Dict[int, Optional[float]]:
        """读取所有通道的模拟值"""
        result = {}
        for ch in range(8):
            result[ch] = self.read_channel(ch)
        return result
    
    def read_channel_scaled(self, channel: int, in_min: float = 0, in_max: float = 1,
                           out_min: float = 0, out_max: float = 1023) -> Optional[float]:
        """读取通道值并缩放到指定范围"""
        raw_value = self.read_channel(channel)
        if raw_value is None:
            return None
        return (raw_value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min
    
    def get_channel_info(self) -> List[Dict[str, Any]]:
        """获取所有通道信息"""
        info = []
        for ch in range(8):
            info.append({
                "channel": ch,
                "configured": str(ch) in self._channel_mapping,
            })
        return info
    
    def cleanup(self):
        """释放资源"""
        if self._spi:
            try:
                self._spi.close()
            except Exception:
                pass
            self._spi = None
        self._initialized = False
        logger.info("MCP3008 ADC 资源已释放")
    
    def is_initialized(self) -> bool:
        """检查是否已初始化"""
        return self._initialized
