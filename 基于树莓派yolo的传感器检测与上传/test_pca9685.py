#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""直接测试 PCA9685"""

from smbus2 import SMBus
import time

print("=== PCA9685 直接测试 ===")

try:
    bus = SMBus(1)
    print("✅ SMBus 已打开")
    
    # 读取 MODE1
    print("读取 0x40 的 MODE1 寄存器...")
    mode1 = bus.read_byte_data(0x40, 0x00)
    print(f"✅ MODE1 = 0x{mode1:02X}")
    
    # 进入睡眠
    print("进入睡眠模式...")
    bus.write_byte_data(0x40, 0x00, 0x10)
    time.sleep(0.01)
    
    # 设置频率 50Hz
    prescale = int(25000000.0 / (4096 * 50) - 1)
    print(f"设置预分频: {prescale} (50Hz)")
    bus.write_byte_data(0x40, 0xFE, prescale)
    
    # 唤醒
    print("唤醒 PCA9685...")
    bus.write_byte_data(0x40, 0x00, 0x00)
    time.sleep(0.01)
    
    # 启用自动递增
    bus.write_byte_data(0x40, 0x00, 0x20)
    
    # 设置通道0到90度
    print("设置通道0到90度...")
    pulse = int(1.5 / 20.0 * 4096)
    bus.write_byte_data(0x40, 0x06, 0x00)
    bus.write_byte_data(0x40, 0x07, 0x00)
    bus.write_byte_data(0x40, 0x08, pulse & 0xFF)
    bus.write_byte_data(0x40, 0x09, (pulse >> 8) & 0x0F)
    print(f"✅ 通道0 PWM 设置: {pulse}")
    time.sleep(1)
    
    # 设置通道0到0度
    print("设置通道0到0度...")
    pulse = int(0.5 / 20.0 * 4096)
    bus.write_byte_data(0x40, 0x08, pulse & 0xFF)
    bus.write_byte_data(0x40, 0x09, (pulse >> 8) & 0x0F)
    print(f"✅ 通道0 PWM 设置: {pulse}")
    time.sleep(1)
    
    # 设置通道0到180度
    print("设置通道0到180度...")
    pulse = int(2.5 / 20.0 * 4096)
    bus.write_byte_data(0x40, 0x08, pulse & 0xFF)
    bus.write_byte_data(0x40, 0x09, (pulse >> 8) & 0x0F)
    print(f"✅ 通道0 PWM 设置: {pulse}")
    time.sleep(1)
    
    # 回到90度
    print("回到90度...")
    pulse = int(1.5 / 20.0 * 4096)
    bus.write_byte_data(0x40, 0x08, pulse & 0xFF)
    bus.write_byte_data(0x40, 0x09, (pulse >> 8) & 0x0F)
    
    # 测试通道1
    print("\n设置通道1到90度...")
    pulse = int(1.5 / 20.0 * 4096)
    bus.write_byte_data(0x40, 0x0A, 0x00)
    bus.write_byte_data(0x40, 0x0B, 0x00)
    bus.write_byte_data(0x40, 0x0C, pulse & 0xFF)
    bus.write_byte_data(0x40, 0x0D, (pulse >> 8) & 0x0F)
    time.sleep(0.5)
    
    bus.close()
    print("\n✅ 测试完成!")
    
except Exception as e:
    print(f"❌ 错误: {e}")
    import traceback
    traceback.print_exc()
