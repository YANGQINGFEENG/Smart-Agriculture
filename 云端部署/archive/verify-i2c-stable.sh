#!/bin/bash
for i in 1 2 3; do
  p=$(timeout 3 sudo i2cget -y 1 0x40 0x00 2>&1)
  m=$(timeout 3 sudo i2cget -y 1 0x68 0x75 2>&1)
  b=$(timeout 3 sudo i2cget -y 1 0x76 0xD0 2>&1)
  echo "第${i}次: PCA9685=$p  MPU6050=$m  BMP280=$b"
  sleep 1
done
echo "=== 最近20分钟服务错误数 ==="
journalctl -u smart-farm --since '-20 min' --no-pager | grep -acE 'PWM 失败|Remote I/O|Connection timed out|初始化失败' || true
