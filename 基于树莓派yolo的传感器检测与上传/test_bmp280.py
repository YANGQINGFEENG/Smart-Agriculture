#!/usr/bin/env python3
"""BMP280 诊断测试脚本"""
import smbus2
import time

def test_bmp280():
    """测试所有 I2C 总线和地址"""
    print("=== BMP280 诊断测试 ===\n")
    
    # 尝试所有 I2C 总线
    for bus_num in [0, 1, 4, 11, 12]:
        try:
            bus = smbus2.SMBus(bus_num)
            print(f"\nI2C Bus {bus_num}: OK")
            
            # 尝试所有 BMP280 可能的地址
            for addr in [0x76, 0x77]:
                try:
                    id = bus.read_byte_data(addr, 0xD0)
                    device_type = "BMP280" if id == 0x58 else f"Unknown (0x{id:02X})"
                    print(f"  地址 0x{addr:02X}: 检测到 {device_type}")
                    
                    if id == 0x58:
                        # 读取校准数据
                        data = bus.read_i2c_block_data(addr, 0x88, 24)
                        print(f"  校准数据: {len(data)} 字节")
                        
                        # 软复位
                        bus.write_byte_data(addr, 0xE0, 0xB6)
                        time.sleep(0.02)
                        
                        # 配置传感器（高分辨率模式）
                        bus.write_byte_data(addr, 0xF5, 0x00)  # 正常模式
                        bus.write_byte_data(addr, 0xF4, 0x3F)  # 温压都开启， oversampling x16
                        time.sleep(0.1)
                        
                        # 读取状态
                        status = bus.read_byte_data(addr, 0xF3)
                        print(f"  状态寄存器: 0x{status:02X}")
                        
                        # 读取原始数据
                        raw = bus.read_i2c_block_data(addr, 0xF7, 8)
                        print(f"  原始数据: {raw}")
                        
                except Exception as e:
                    print(f"  地址 0x{addr:02X}: {e}")
            
            bus.close()
        except Exception as e:
            print(f"I2C Bus {bus_num}: {e}")

if __name__ == "__main__":
    test_bmp280()
