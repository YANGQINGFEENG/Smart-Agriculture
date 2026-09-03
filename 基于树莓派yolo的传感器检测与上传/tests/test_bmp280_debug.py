#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""调试 BMP280 气压计算"""

import smbus2
import time

BMP280_REG_PRESS_MSB = 0xF7
BMP280_REG_CTRL_MEAS = 0xF4
BMP280_REG_STATUS = 0xF3

bus = smbus2.SMBus(1)
address = 0x76

# 配置传感器
bus.write_byte_data(address, BMP280_REG_CTRL_MEAS, 0x27)
time.sleep(0.5)

# 等待测量完成
for i in range(20):
    status = bus.read_byte_data(address, BMP280_REG_STATUS)
    print(f"Status {i}: 0x{status:02X}")
    if (status & 0x08) == 0:
        break
    time.sleep(0.05)

# 读取原始数据
data = bus.read_i2c_block_data(address, BMP280_REG_PRESS_MSB, 8)
print(f"Raw data: {[hex(x) for x in data]}")

# 解析气压
press_msb = data[0]
press_lsb = data[1]
press_xlsb = data[2]
raw_press = (press_msb << 12) | (press_lsb << 4) | (press_xlsb >> 4)
print(f"Raw pressure: {raw_press} (0x{raw_press:06X})")

# 解析温度
temp_msb = data[3]
temp_lsb = data[4]
temp_xlsb = data[5]
raw_temp = (temp_msb << 12) | (temp_lsb << 4) | (temp_xlsb >> 4)
print(f"Raw temperature: {raw_temp} (0x{raw_temp:06X})")

# 读取校准数据
calib_data = bus.read_i2c_block_data(address, 0x88, 24)

T1 = (calib_data[1] << 8) | calib_data[0]
T2 = (calib_data[3] << 8) | calib_data[2]
T3 = (calib_data[5] << 8) | calib_data[4]
P1 = (calib_data[7] << 8) | calib_data[6]
P2 = (calib_data[9] << 8) | calib_data[8]
P3 = (calib_data[11] << 8) | calib_data[10]
P4 = (calib_data[13] << 8) | calib_data[12]
P5 = (calib_data[15] << 8) | calib_data[14]
P6 = (calib_data[17] << 8) | calib_data[16]
P7 = (calib_data[19] << 8) | calib_data[18]
P8 = (calib_data[21] << 8) | calib_data[20]
P9 = (calib_data[23] << 8) | calib_data[22]

if T2 > 32767: T2 -= 65536
if T3 > 32767: T3 -= 65536
if P2 > 32767: P2 -= 65536
if P3 > 32767: P3 -= 65536
if P4 > 32767: P4 -= 65536
if P5 > 32767: P5 -= 65536
if P6 > 32767: P6 -= 65536
if P7 > 32767: P7 -= 65536
if P8 > 32767: P8 -= 65536
if P9 > 32767: P9 -= 65536

print(f"T1={T1}, T2={T2}, T3={T3}")
print(f"P1={P1}, P2={P2}, P3={P3}, P4={P4}, P5={P5}, P6={P6}, P7={P7}, P8={P8}, P9={P9}")

# 温度补偿
var1 = (((raw_temp >> 3) - (T1 << 1)) * T2) >> 11
var2 = (((((raw_temp >> 4) - T1) * ((raw_temp >> 4) - T1)) >> 12) * T3) >> 14
t_fine = var1 + var2
temp = (t_fine * 5 + 128) >> 8
print(f"Temperature: {temp/100.0}°C, t_fine={t_fine}")

# 气压补偿 - 使用精确的整数运算
print("\n--- Pressure Compensation Debug ---")
var1 = t_fine - 128000
print(f"var1 = t_fine - 128000 = {t_fine} - 128000 = {var1}")

var2 = var1 * var1 * P6
print(f"var2 = var1 * var1 * P6 = {var1} * {var1} * {P6} = {var2}")

temp = (var1 * P5) << 17
print(f"var1 * P5 << 17 = {var1} * {P5} << 17 = {temp}")
var2 = var2 + temp
print(f"var2 += temp = {var2}")

temp = P4 << 35
print(f"P4 << 35 = {P4} << 35 = {temp}")
var2 = var2 + temp
print(f"var2 += temp = {var2}")

temp = (var1 * var1 * P3) >> 8
print(f"(var1 * var1 * P3) >> 8 = ({var1} * {var1} * {P3}) >> 8 = {temp}")
temp2 = (var1 * P2) << 12
print(f"(var1 * P2) << 12 = ({var1} * {P2}) << 12 = {temp2}")
var1 = temp + temp2
print(f"var1 = temp + temp2 = {var1}")

temp = ((1 << 47) + var1) * P1
print(f"((1 << 47) + var1) * P1 = ({(1 << 47)} + {var1}) * {P1} = {temp}")
var1 = temp >> 33
print(f"var1 = temp >> 33 = {var1}")

if var1 == 0:
    print("var1 == 0, return 0")
    p = 0
else:
    p = 1048576 - raw_press
    print(f"p = 1048576 - raw_press = 1048576 - {raw_press} = {p}")
    
    temp = (p << 31) - var2
    print(f"(p << 31) - var2 = ({p} << 31) - {var2} = {temp}")
    temp = temp * 3125
    print(f"temp * 3125 = {temp}")
    p = temp // var1
    print(f"p = temp // var1 = {p}")
    
    temp = (P9 * (p >> 13) * (p >> 13)) >> 25
    print(f"(P9 * (p >> 13) * (p >> 13)) >> 25 = ({P9} * {p >> 13} * {p >> 13}) >> 25 = {temp}")
    var1 = temp
    
    temp = (P8 * p) >> 19
    print(f"(P8 * p) >> 19 = ({P8} * {p}) >> 19 = {temp}")
    var2 = temp
    
    p = ((p + var1 + var2) >> 8) + (P7 << 4)
    print(f"p = ((p + var1 + var2) >> 8) + (P7 << 4) = (({p} + {var1} + {var2}) >> 8) + ({P7} << 4) = {p}")
    
    p = p / 256.0
    print(f"p = p / 256.0 = {p}")

print(f"\nFinal Pressure: {p} hPa")
bus.close()
