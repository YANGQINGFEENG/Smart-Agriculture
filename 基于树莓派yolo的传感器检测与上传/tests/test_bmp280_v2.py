#!/usr/bin/env python3
import smbus2
import time

BMP280_REG_PRESS_MSB = 0xF7
BMP280_REG_CTRL_MEAS = 0xF4
BMP280_REG_STATUS = 0xF3
BMP280_REG_RESET = 0xB6

bus = smbus2.SMBus(1)
address = 0x76

# 软复位
bus.write_byte_data(address, BMP280_REG_RESET, 0xB6)
time.sleep(0.1)

# 配置传感器 - 高分辨率正常模式
bus.write_byte_data(address, BMP280_REG_CTRL_MEAS, 0x3F)
time.sleep(1.0)

# 等待测量完成
for i in range(30):
    status = bus.read_byte_data(address, BMP280_REG_STATUS)
    print(f"Status {i}: 0x{status:02X}")
    if (status & 0x08) == 0:
        break
    time.sleep(0.05)

# 读取原始数据
data = bus.read_i2c_block_data(address, BMP280_REG_PRESS_MSB, 8)
print(f"Raw data: {[hex(x) for x in data]}")

press_msb = data[0]
press_lsb = data[1]
press_xlsb = data[2]
raw_press = (press_msb << 12) | (press_lsb << 4) | (press_xlsb >> 4)
print(f"Raw pressure: {raw_press} (0x{raw_press:06X})")

temp_msb = data[3]
temp_lsb = data[4]
temp_xlsb = data[5]
raw_temp = (temp_msb << 12) | (temp_lsb << 4) | (temp_xlsb >> 4)
print(f"Raw temperature: {raw_temp} (0x{raw_temp:06X})")

bus.close()
