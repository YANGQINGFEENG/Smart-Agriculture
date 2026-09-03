#!/usr/bin/env python3
"""I2C 诊断脚本"""
import smbus2
import os

print("=== I2C 诊断 ===")

# 检查 I2C 设备节点
for dev in ['/dev/i2c-1', '/dev/i2c-4', '/dev/i2c-11', '/dev/i2c-12']:
    exists = os.path.exists(dev)
    print(f"{dev}: {'存在' if exists else '不存在'}")

print("\n=== 扫描所有 I2C 总线 ===")
for bus_num in [1, 4, 11, 12]:
    try:
        bus = smbus2.SMBus(bus_num)
        print(f"\nBus {bus_num}:")
        found = False
        
        for addr in range(0x08, 0x78):
            try:
                bus.read_byte(addr)
                print(f"  发现设备: 0x{addr:02X}")
                found = True
            except:
                pass
        
        if not found:
            print(f"  无设备")
        
        bus.close()
    except Exception as e:
        print(f"Bus {bus_num}: {e}")

print("\n=== 检查完成 ===")
