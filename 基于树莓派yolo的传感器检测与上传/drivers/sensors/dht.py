#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""DHT11/DHT22 温湿度传感器 - 使用统一 GPIO 管理器，优化读取性能"""

import time
import threading
from datetime import datetime
from typing import Any, Dict
from drivers.sensors.base import BaseSensor, DataQuality
from drivers.gpio_manager import gpio_manager

try:
    import lgpio
    HAS_LGPIO = True
except ImportError:
    HAS_LGPIO = False


class DHTSensor(BaseSensor):
    """DHT11/DHT22 温湿度传感器 - 优化版本
    
    优化点：
    1. 使用统一 GPIO 管理器管理引脚资源
    2. 减少读取超时时间（从10ms降到5ms）
    3. 增加数据缓存，避免重复读取
    4. 单次读取失败时返回缓存数据
    """

    # 缓存有效期（秒）
    CACHE_TTL = 2
    # 读取超时时间（秒）
    READ_TIMEOUT = 0.005

    def __init__(self, sensor_id: str = "dht11", name: str = "温湿度传感器",
                 pin: int = 6, sensor_type: str = "DHT11", config: Dict = None):
        super().__init__(sensor_id, name, sensor_type.lower(), config)
        self.pin = pin
        self.sensor_type = sensor_type.upper()
        self._initialized = False
        self._last_value = {"temperature": None, "humidity": None}
        self._last_time = None
        self._read_lock = threading.Lock()

    def initialize(self) -> bool:
        """初始化传感器"""
        # 确保 GPIO 管理器已初始化
        if not gpio_manager.is_initialized():
            gpio_manager.initialize()
        
        self._initialized = True
        self.logger.info(f"DHT initialized: pin={self.pin}, type={self.sensor_type}")
        return True

    def _bits_to_byte(self, bits):
        """将8位二进制数据转换为字节"""
        byte = 0
        for bit in bits:
            byte = (byte << 1) | bit
        return byte

    def _read_raw(self) -> Dict[str, Any]:
        """原始读取传感器数据（内部方法，带超时保护）
        
        使用 GPIOManager 的临时操作方法，避免引脚占用冲突
        """
        if not gpio_manager.is_initialized():
            # 测试模式
            return {
                "temperature": 25.0,
                "humidity": 50.0,
                "quality": DataQuality.GOOD
            }

        try:
            # 发送开始信号
            gpio_manager.temp_claim_output(self.pin)
            gpio_manager.temp_write(self.pin, 0)
            time.sleep(0.018)
            gpio_manager.temp_write(self.pin, 1)
            time.sleep(0.00002)
            
            # 切换到输入模式
            gpio_manager.temp_claim_input(self.pin)
            
            # 读取响应信号
            timeout = time.time() + self.READ_TIMEOUT
            while gpio_manager.temp_read(self.pin) == 0:
                if time.time() > timeout:
                    self.logger.error("DHT response timeout (LOW)")
                    gpio_manager.temp_free(self.pin)
                    return {"quality": DataQuality.ERROR}
            
            timeout = time.time() + self.READ_TIMEOUT
            while gpio_manager.temp_read(self.pin) == 1:
                if time.time() > timeout:
                    self.logger.error("DHT response timeout (HIGH)")
                    gpio_manager.temp_free(self.pin)
                    return {"quality": DataQuality.ERROR}
            
            # 读取40位数据
            data = []
            for _ in range(40):
                timeout = time.time() + self.READ_TIMEOUT
                while gpio_manager.temp_read(self.pin) == 0:
                    if time.time() > timeout:
                        self.logger.error("DHT data read timeout (LOW)")
                        gpio_manager.temp_free(self.pin)
                        return {"quality": DataQuality.ERROR}
                
                start_time = time.time()
                timeout = time.time() + self.READ_TIMEOUT
                while gpio_manager.temp_read(self.pin) == 1:
                    if time.time() > timeout:
                        self.logger.error("DHT data read timeout (HIGH)")
                        gpio_manager.temp_free(self.pin)
                        return {"quality": DataQuality.ERROR}
                
                duration = time.time() - start_time
                if duration > 0.000028:
                    data.append(1)
                else:
                    data.append(0)
            
            # 释放引脚
            gpio_manager.temp_free(self.pin)
            
            # 解析数据
            humidity_high = self._bits_to_byte(data[0:8])
            humidity_low = self._bits_to_byte(data[8:16])
            temp_high = self._bits_to_byte(data[16:24])
            temp_low = self._bits_to_byte(data[24:32])
            checksum = self._bits_to_byte(data[32:40])
            
            # 验证校验和
            if (humidity_high + humidity_low + temp_high + temp_low) & 0xFF != checksum:
                self.logger.warning("DHT checksum error")
                return {"quality": DataQuality.ERROR}
            
            # 计算温度和湿度
            if self.sensor_type == "DHT11":
                temperature = temp_high
                humidity = humidity_high
            else:
                temperature = (temp_high << 8) + temp_low
                humidity = (humidity_high << 8) + humidity_low
                if temperature > 0x8000:
                    temperature = -((temperature ^ 0xFFFF) + 1)
                temperature /= 10.0
                humidity /= 10.0
            
            # 数据范围校验
            if humidity < 0 or humidity > 100 or temperature < -40 or temperature > 85:
                self.logger.warning(f"DHT data out of range: temp={temperature}, humidity={humidity}")
                return {"quality": DataQuality.ERROR}
            
            return {
                "temperature": temperature,
                "humidity": humidity,
                "quality": DataQuality.GOOD
            }
        except Exception as e:
            self.logger.error(f"DHT read error: {e}")
            try:
                gpio_manager.temp_free(self.pin)
            except:
                pass
            return {"quality": DataQuality.ERROR}

    def read(self) -> Dict[str, Any]:
        """读取传感器数据（带缓存机制）
        
        优化策略：
        1. 如果缓存数据在有效期内，直接返回缓存
        2. 如果读取失败，返回最后一次有效缓存
        3. 加锁防止并发读取冲突
        """
        if not self._initialized:
            return {"value": None, "unit": "", "quality": DataQuality.UNAVAILABLE}

        # 检查缓存是否有效
        now = datetime.now()
        if self._last_time is not None:
            elapsed = (now - self._last_time).total_seconds()
            if elapsed < self.CACHE_TTL and self._last_value["temperature"] is not None:
                return {
                    "value": self._last_value,
                    "unit": {"temperature": "°C", "humidity": "%"},
                    "quality": DataQuality.GOOD
                }

        # 加锁读取
        with self._read_lock:
            # 再次检查缓存（可能在等待锁时已更新）
            if self._last_time is not None:
                elapsed = (datetime.now() - self._last_time).total_seconds()
                if elapsed < self.CACHE_TTL and self._last_value["temperature"] is not None:
                    return {
                        "value": self._last_value,
                        "unit": {"temperature": "°C", "humidity": "%"},
                        "quality": DataQuality.GOOD
                    }

            # 执行读取
            result = self._read_raw()
            
            if result.get("quality") == DataQuality.GOOD:
                # 更新缓存
                self._last_value = {
                    "temperature": result["temperature"],
                    "humidity": result["humidity"]
                }
                self._last_time = now
                
                return {
                    "value": self._last_value,
                    "unit": {"temperature": "°C", "humidity": "%"},
                    "quality": DataQuality.GOOD
                }
            else:
                # 读取失败，返回缓存数据（如果有）
                if self._last_value["temperature"] is not None:
                    self.logger.warning(f"DHT read failed, returning cached data")
                    return {
                        "value": self._last_value,
                        "unit": {"temperature": "°C", "humidity": "%"},
                        "quality": DataQuality.WARNING
                    }
                else:
                    return {
                        "value": None,
                        "unit": "",
                        "quality": DataQuality.ERROR
                    }

    def cleanup(self):
        """释放资源"""
        # DHT 使用临时引脚，不需要长期占用
        self._initialized = False
