#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""I2C 总线诊断脚本"""

import os
import sys
import time

print("=" * 50)
print("I2C 总线诊断工具")
print("=" * 50)

# 检查 I2C 是否启用
print("\n1. 检查 I2C 状态...")
try:
    with open('/boot/config.txt', 'r') as f:
        content = f.read()
        if 'dtparam=i2c_arm=on' in content:
            print("   ✅ I2C 已启用 (在 /boot/config.txt 中)")
        else:
            print("   ⚠️ I2C 可能未启用，请检查 /boot/config.txt")
except:
    print("   ⚠️ 无法读取 /boot/config.txt")

# 检查内核模块
print("\n2. 检查 I2C 内核模块...")
import subprocess
result = subprocess.run(['lsmod'], capture_output=True, text=True)
if 'i2c_dev' in result.stdout:
    print("   ✅ i2c_dev 模块已加载")
else:
    print("   ⚠️ i2c_dev 模块未加载，尝试加载...")
    subprocess.run(['sudo', 'modprobe', 'i2c_dev'])
    result = subprocess.run(['lsmod'], capture_output=True, text=True)
    if 'i2c_dev' in result.stdout:
        print("   ✅ i2c_dev 模块已加载")
    else:
        print("   ❌ 无法加载 i2c_dev 模块")

# 扫描 I2C 设备
print("\n3. 扫描 I2C 总线 1...")
try:
    from smbus2 import SMBus
    bus = SMBus(1)
    
    found_devices = []
    for addr in range(0, 128):
        try:
            bus.write_byte(addr)
            found_devices.append(addr)
        except:
            pass
    
    if found_devices:
        print(f"   发现 {len(found_devices)} 个设备:")
        device_map = {
            0x40: "PCA9685 (舵机驱动)",
            0x76: "BMP280 (气压传感器)",
            0x77: "BMP280 (气压传感器)",
            0x68: "MPU6050 (加速度计)",
            0x27: "LCD1602 (显示屏)",
            0x3f: "LCD1602 (显示屏)",
            0x50: "AT24C02 (EEPROM)",
        }
        
        for addr in found_devices:
            addr_str = f"0x{addr:02X}"
            device_name = device_map.get(addr, "未知设备")
            print(f"   [{addr_str}] {device_name}")
    else:
        print("   ❌ 未发现任何 I2C 设备!")
        print("\n   请检查:")
        print("   1. 设备是否已上电")
        print("   2. SDA/SCL 接线是否正确")
        print("   3. 设备地址是否正确")
    
    bus.close()
    
except ImportError:
    print("   ⚠️ smbus2 未安装")
    print("   请运行: pip3 install smbus2")
except Exception as e:
    print(f"   ❌ 扫描失败: {e}")

# 检查 PCA9685
print("\n4. 检查 PCA9685 (0x40)...")
try:
    bus = SMBus(1)
    # 尝试读取 PCA9685 的 MODE1 寄存器
    bus.write_byte_data(0x40, 0x00, 0x00)
    result = bus.read_byte(0x40)
    print(f"   ✅ PCA9685 响应: MODE1=0x{result:02X}")
    
    # 尝试初始化
    bus.write_byte_data(0x40, 0x00, 0x20)  # 启用响应
    print("   ✅ PCA9685 初始化成功")
    bus.close()
except Exception as e:
    print(f"   ❌ PCA9685 无响应: {e}")
    print("\n   排查清单:")
    print("   ✓ PCA9685 VCC 接树莓派 3.3V 或 5V")
    print("   ✓ PCA9685 GND 接树莓派 GND")
    print("   ✓ PCA9685 SDA 接树莓派 GPIO2 (BCM)")
    print("   ✓ PCA9685 SCL 接树莓派 GPIO3 (BCM)")
    print("   ✓ 舵机单独供电时，GND 需要共地")

# 检查 BMP280
print("\n5. 检查 BMP280 (0x76)...")
try:
    bus = SMBus(1)
    # 读取 BMP280 ID 寄存器
    bus.write_byte(0x76)
    result = bus.read_byte(0x76)
    print(f"   ✅ BMP280 响应: ID=0x{result:02X}")
    if result == 0x58:
        print("   ✅ BMP280 芯片 ID 正确")
    bus.close()
except Exception as e:
    print(f"   ❌ BMP280 无响应: {e}")

print("\n" + "=" * 50)
print("诊断完成")
print("=" * 50)
