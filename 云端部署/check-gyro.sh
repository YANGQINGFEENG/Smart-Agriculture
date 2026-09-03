#!/bin/bash
echo "=== I2C 总线扫描 (找 MPU6050: 0x68/0x69, PCA9685: 0x40) ==="
for bus in /dev/i2c-*; do
  b=$(basename $bus | sed 's/i2c-//')
  found=$(sudo i2cdetect -y $b 2>/dev/null | grep -E '40|68|69' | head -2)
  if [ -n "$found" ]; then
    echo "i2c-$b:"
    sudo i2cdetect -y $b 2>/dev/null | tail -n +2
  fi
done
echo "=== 陀螺仪驱动日志 ==="
journalctl -u smart-farm -b --no-pager | grep -aiE 'gyro|陀螺仪|mpu6050|手势' | tail -8
echo "=== 摄像头节点 feedback 中的陀螺仪字段 ==="
