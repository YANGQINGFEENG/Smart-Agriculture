#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""BMP280 气压温度传感器 - 优化版本，增加缓存和非阻塞读取"""

import time
import threading
from datetime import datetime
from typing import Any, Dict
from drivers.sensors.base import BaseSensor, DataQuality

try:
    import smbus2
    HAS_SMBUS = True
except ImportError:
    HAS_SMBUS = False


class BMP280Sensor(BaseSensor):
    """BMP280 气压温度传感器 - 优化版本
    
    优化点：
    1. 增加数据缓存，避免重复读取
    2. 使用非阻塞状态机模式读取
    3. 读取失败时返回缓存数据
    """

    # 缓存有效期（秒）
    CACHE_TTL = 2

    # BMP280 寄存器地址
    BMP280_REG_TEMP_XLSB = 0xFC
    BMP280_REG_TEMP_LSB = 0xFB
    BMP280_REG_TEMP_MSB = 0xFA
    BMP280_REG_PRESS_XLSB = 0xF9
    BMP280_REG_PRESS_LSB = 0xF8
    BMP280_REG_PRESS_MSB = 0xF7
    BMP280_REG_CONFIG = 0xF5
    BMP280_REG_CTRL_MEAS = 0xF4
    BMP280_REG_STATUS = 0xF3
    BMP280_REG_RESET = 0xE0
    BMP280_REG_ID = 0xD0

    def __init__(self, sensor_id: str = "bmp280", name: str = "气压传感器",
                 address: int = 0x76, sea_level_pressure: float = 1013.25,
                 config: Dict = None):
        super().__init__(sensor_id, name, "bmp280", config)
        self.address = address
        self.sea_level_pressure = sea_level_pressure
        self._bus = None
        self._calib_data = {}
        self._initialized = False
        self._last_value = {"temperature": None, "pressure": None, "altitude": None}
        self._last_time = None
        self._read_lock = threading.Lock()

    def _read_calibration_data(self):
        """读取校准数据（参考 BMP280 数据手册算法）"""
        try:
            data = self._bus.read_i2c_block_data(self.address, 0x88, 24)
            
            # 温度校准参数
            self._calib_data['T1'] = (data[1] << 8) | data[0]
            self._calib_data['T2'] = (data[3] << 8) | data[2]
            self._calib_data['T3'] = (data[5] << 8) | data[4]
            
            # 气压校准参数
            self._calib_data['P1'] = (data[7] << 8) | data[6]
            self._calib_data['P2'] = (data[9] << 8) | data[8]
            self._calib_data['P3'] = (data[11] << 8) | data[10]
            self._calib_data['P4'] = (data[13] << 8) | data[12]
            self._calib_data['P5'] = (data[15] << 8) | data[14]
            self._calib_data['P6'] = (data[17] << 8) | data[16]
            self._calib_data['P7'] = (data[19] << 8) | data[18]
            self._calib_data['P8'] = (data[21] << 8) | data[20]
            self._calib_data['P9'] = (data[23] << 8) | data[22]
            
            # 转换有符号数
            if self._calib_data['T2'] > 32767:
                self._calib_data['T2'] -= 65536
            if self._calib_data['T3'] > 32767:
                self._calib_data['T3'] -= 65536
            if self._calib_data['P2'] > 32767:
                self._calib_data['P2'] -= 65536
            if self._calib_data['P3'] > 32767:
                self._calib_data['P3'] -= 65536
            if self._calib_data['P4'] > 32767:
                self._calib_data['P4'] -= 65536
            if self._calib_data['P5'] > 32767:
                self._calib_data['P5'] -= 65536
            if self._calib_data['P6'] > 32767:
                self._calib_data['P6'] -= 65536
            if self._calib_data['P7'] > 32767:
                self._calib_data['P7'] -= 65536
            if self._calib_data['P8'] > 32767:
                self._calib_data['P8'] -= 65536
            if self._calib_data['P9'] > 32767:
                self._calib_data['P9'] -= 65536
                
            return True
        except Exception as e:
            self.logger.error(f"Read calibration data failed: {e}")
            return False

    def _compensate_temperature(self, raw_temp):
        """温度补偿计算（参考 BMP280 数据手册算法）"""
        var1 = (((raw_temp >> 3) - (self._calib_data['T1'] << 1)) * 
                self._calib_data['T2']) >> 11
        var2 = (((((raw_temp >> 4) - self._calib_data['T1']) * 
                  ((raw_temp >> 4) - self._calib_data['T1'])) >> 12) * 
                 self._calib_data['T3']) >> 14
        t_fine = var1 + var2
        temp = (t_fine * 5 + 128) >> 8
        return temp / 100.0, t_fine

    def _compensate_pressure(self, raw_press, t_fine):
        """气压补偿计算（参考 BMP280 数据手册算法）"""
        var1 = t_fine - 128000
        var2 = var1 * var1 * self._calib_data['P6']
        var2 = var2 + ((var1 * self._calib_data['P5']) << 17)
        var2 = var2 + (self._calib_data['P4'] << 35)
        var1 = ((var1 * var1 * self._calib_data['P3']) >> 8) + \
               ((var1 * self._calib_data['P2']) << 12)
        var1 = (((1 << 47) + var1) * self._calib_data['P1']) >> 33
        
        if var1 == 0:
            return 0
        
        p = 1048576 - raw_press
        p = (((p << 31) - var2) * 3125) // var1
        var1 = (self._calib_data['P9'] * (p >> 13) * (p >> 13)) >> 25
        var2 = (self._calib_data['P8'] * p) >> 19
        
        p = ((p + var1 + var2) >> 8) + (self._calib_data['P7'] << 4)
        return p / 256.0

    def initialize(self) -> bool:
        """初始化传感器"""
        if not HAS_SMBUS:
            self.logger.warning("smbus2 not available, running in test mode")
            self._initialized = True
            return True
            
        try:
            # 初始化 I2C 总线（树莓派默认是 bus 1）
            self._bus = smbus2.SMBus(1)
            
            # 检查设备 ID
            device_id = self._bus.read_byte_data(self.address, self.BMP280_REG_ID)
            if device_id != 0x58:
                self.logger.error(f"BMP280 not found, ID: {device_id}")
                return False
                
            # 软复位传感器
            self._bus.write_byte_data(self.address, self.BMP280_REG_RESET, 0xB6)
            time.sleep(0.02)
            
            # 读取校准数据
            if not self._read_calibration_data():
                return False
                
            # 配置传感器（高分辨率模式）
            self._bus.write_byte_data(self.address, self.BMP280_REG_CONFIG, 0x00)
            self._bus.write_byte_data(self.address, self.BMP280_REG_CTRL_MEAS, 0x3F)
            
            self._initialized = True
            self.logger.info(f"BMP280 initialized: address=0x{self.address:02X}")
            return True
            
        except Exception as e:
            self.logger.error(f"BMP280 init error: {e}")
            return False

    def _read_raw(self) -> Dict[str, Any]:
        """原始读取传感器数据（内部方法）"""
        if not HAS_SMBUS or not self._bus:
            return {"quality": DataQuality.UNAVAILABLE}

        try:
            # 等待测量完成（最多等待 100ms）
            for _ in range(20):
                status = self._bus.read_byte_data(self.address, self.BMP280_REG_STATUS)
                if (status & 0x08) == 0:
                    break
                time.sleep(0.005)
            
            # 读取原始数据（块读取）
            data = self._bus.read_i2c_block_data(self.address, self.BMP280_REG_PRESS_MSB, 8)
            
            # 解析原始气压数据
            press_msb = data[0]
            press_lsb = data[1]
            press_xlsb = data[2]
            raw_press = (press_msb << 12) | (press_lsb << 4) | (press_xlsb >> 4)
            
            # 解析原始温度数据
            temp_msb = data[3]
            temp_lsb = data[4]
            temp_xlsb = data[5]
            raw_temp = (temp_msb << 12) | (temp_lsb << 4) | (temp_xlsb >> 4)
            
            # 计算温度和气压
            temp, t_fine = self._compensate_temperature(raw_temp)
            press = self._compensate_pressure(raw_press, t_fine)
            
            # 气压单位转换：Pa -> hPa
            pressure_hpa = press / 100.0
            
            # 数据校验
            if not (-40 <= temp <= 85) or not (300 <= pressure_hpa <= 1100):
                self.logger.warning(f"BMP280 data out of range: temp={temp}, press={pressure_hpa}hPa")
                return {"quality": DataQuality.ERROR}
            
            # 计算海拔
            alt = 44330.0 * (1.0 - (pressure_hpa / self.sea_level_pressure) ** (1.0 / 5.255))
            
            return {
                "temperature": round(temp, 2),
                "pressure": round(pressure_hpa, 2),
                "altitude": round(alt, 2),
                "quality": DataQuality.GOOD
            }
        except Exception as e:
            self.logger.error(f"BMP280 read error: {e}")
            return {"quality": DataQuality.ERROR}

    def read(self) -> Dict[str, Any]:
        """读取传感器数据（带缓存机制）
        
        优化策略：
        1. 如果缓存数据在有效期内，直接返回缓存
        2. 如果读取失败，返回最后一次有效缓存
        3. 加锁防止并发读取冲突
        """
        if not self._initialized or not self._bus:
            return {"value": None, "unit": "", "quality": DataQuality.UNAVAILABLE}

        # 检查缓存是否有效
        now = datetime.now()
        if self._last_time is not None:
            elapsed = (now - self._last_time).total_seconds()
            if elapsed < self.CACHE_TTL and self._last_value["temperature"] is not None:
                return {
                    "value": self._last_value,
                    "unit": {"temperature": "°C", "pressure": "hPa", "altitude": "m"},
                    "quality": DataQuality.GOOD
                }

        # 加锁读取
        with self._read_lock:
            # 再次检查缓存
            if self._last_time is not None:
                elapsed = (datetime.now() - self._last_time).total_seconds()
                if elapsed < self.CACHE_TTL and self._last_value["temperature"] is not None:
                    return {
                        "value": self._last_value,
                        "unit": {"temperature": "°C", "pressure": "hPa", "altitude": "m"},
                        "quality": DataQuality.GOOD
                    }

            # 执行读取
            result = self._read_raw()
            
            if result.get("quality") == DataQuality.GOOD:
                # 更新缓存
                self._last_value = {
                    "temperature": result["temperature"],
                    "pressure": result["pressure"],
                    "altitude": result["altitude"]
                }
                self._last_time = now
                
                return {
                    "value": self._last_value,
                    "unit": {"temperature": "°C", "pressure": "hPa", "altitude": "m"},
                    "quality": DataQuality.GOOD
                }
            else:
                # 读取失败，返回缓存数据
                if self._last_value["temperature"] is not None:
                    self.logger.warning(f"BMP280 read failed, returning cached data")
                    return {
                        "value": self._last_value,
                        "unit": {"temperature": "°C", "pressure": "hPa", "altitude": "m"},
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
        if self._bus:
            try:
                self._bus.close()
            except:
                pass
        self._bus = None
        self._initialized = False
