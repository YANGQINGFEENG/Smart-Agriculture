#!/usr/bin/env python3
import smbus2

bus = smbus2.SMBus(1)
for addr in [0x76, 0x77]:
    try:
        data = bus.read_byte_data(addr, 0xD0)
        print(f"Address 0x{addr:02X}: ID=0x{data:02X}")
    except Exception as e:
        print(f"Address 0x{addr:02X}: {e}")
bus.close()
