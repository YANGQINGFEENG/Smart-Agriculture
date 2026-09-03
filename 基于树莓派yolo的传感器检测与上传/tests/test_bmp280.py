#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""测试 BMP280"""

from drivers.sensors.bmp280 import BMP280Sensor

sensor = BMP280Sensor()
if sensor.initialize():
    print("BMP280 initialized successfully")
    print(f"Calibration data: {sensor._calib_data}")
    for i in range(3):
        result = sensor.read()
        print(f"Read {i+1}: {result}")
else:
    print("BMP280 initialization failed")
