#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""舵机直接驱动测试 - 绕过所有封装，直接操作 PCA9685 寄存器"""

import time
import sys
import os
import logging
from smbus2 import SMBus

logging.basicConfig(level=logging.INFO, format='%(asctime)s [INFO] %(message)s', datefmt='%H:%M:%S')
logger = logging.getLogger(__name__)

# PCA9685 寄存器
MODE1 = 0x00
MODE2 = 0x01
PRESCALE = 0xFE
LED0_ON_L = 0x06
LED0_OFF_L = 0x08

I2C_ADDR = 0x40
I2C_BUS = 1


def write_reg(bus, reg, val):
    """写寄存器"""
    bus.write_byte_data(I2C_ADDR, reg, val)


def read_reg(bus, reg):
    """读寄存器"""
    return bus.read_byte_data(I2C_ADDR, reg)


def set_channel_pwm(bus, channel, on, off):
    """直接设置通道PWM"""
    base = LED0_ON_L + 4 * channel
    bus.write_byte_data(I2C_ADDR, base, on & 0xFF)
    bus.write_byte_data(I2C_ADDR, base + 1, (on >> 8) & 0x0F)
    bus.write_byte_data(I2C_ADDR, base + 2, off & 0xFF)
    bus.write_byte_data(I2C_ADDR, base + 3, (off >> 8) & 0x0F)


def angle_to_pulse(angle):
    """角度转PWM值"""
    # 50Hz, 20ms周期, 4096分辨率
    # 0°=0.5ms=102, 90°=1.5ms=307, 180°=2.5ms=512
    pulse_ms = 0.5 + (angle / 180.0) * 2.0
    return int(pulse_ms / 20.0 * 4096)


def main():
    """主测试函数"""
    logger.info("=" * 50)
    logger.info("舵机直接驱动测试（绕过封装）")
    logger.info("=" * 50)

    bus = SMBus(I2C_BUS)
    
    # 1. 读取设备信息
    mode1 = read_reg(bus, MODE1)
    mode2 = read_reg(bus, MODE2)
    logger.info(f"读取寄存器: MODE1=0x{mode1:02X} MODE2=0x{mode2:02X}")

    # 2. 初始化 PCA9685
    logger.info("初始化 PCA9685...")
    write_reg(bus, MODE1, 0x10)  # 睡眠
    time.sleep(0.01)
    write_reg(bus, PRESCALE, 121)  # 50Hz
    time.sleep(0.01)
    write_reg(bus, MODE1, 0x20)  # 唤醒，自动递增
    time.sleep(0.01)
    write_reg(bus, MODE2, 0x04)  # 推挽输出（改为0x04试试）
    time.sleep(0.1)
    
    mode1 = read_reg(bus, MODE1)
    logger.info(f"初始化后: MODE1=0x{mode1:02X}")

    # 3. 测试所有通道（0-15）
    logger.info("")
    logger.info("=== 测试通道0（水平舵机）===")
    test_channel(bus, 0)

    logger.info("")
    logger.info("=== 测试通道1（俯仰舵机）===")
    test_channel(bus, 1)

    # 4. 同时测试两个通道
    logger.info("")
    logger.info("=== 双通道同时测试 ===")
    angles = [0, 45, 90, 135, 180, 90]
    for angle in angles:
        pulse = angle_to_pulse(angle)
        set_channel_pwm(bus, 0, 0, pulse)
        set_channel_pwm(bus, 1, 0, pulse)
        logger.info(f"  ch0+ch1 -> {angle}° (pulse={pulse})")
        time.sleep(1)

    # 5. 关闭所有通道
    logger.info("")
    logger.info("关闭所有通道...")
    for ch in range(16):
        set_channel_pwm(bus, ch, 0, 0)

    bus.close()
    logger.info("测试完成")


def test_channel(bus, channel):
    """测试单个通道"""
    logger.info(f"通道{channel} 测试开始:")
    
    # 测试几个关键角度
    angles = [90, 0, 45, 90, 135, 180, 90]
    for angle in angles:
        pulse = angle_to_pulse(angle)
        set_channel_pwm(bus, channel, 0, pulse)
        
        # 读回验证
        base = LED0_ON_L + 4 * channel
        off_l = read_reg(bus, base + 2)
        off_h = read_reg(bus, base + 3)
        readback = (off_h << 8) | off_l
        
        logger.info(f"  角度={angle:3d}° pulse={pulse:3d} 读回={readback:3d}")
        time.sleep(1)

    # 关闭
    set_channel_pwm(bus, channel, 0, 0)
    logger.info(f"通道{channel} 测试完成")


if __name__ == "__main__":
    main()
