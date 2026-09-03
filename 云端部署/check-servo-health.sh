#!/bin/bash
echo "=== 服务状态 ==="
systemctl is-active smart-farm
echo "=== I2C 总线扫描 ==="
sudo i2cdetect -y 1 2>&1 | tail -9
echo "=== 连续 5 次直读关键芯片（看稳定性）==="
for i in 1 2 3 4 5; do
  p=$(timeout 3 sudo i2cget -y 1 0x40 0x00 2>&1)
  m=$(timeout 3 sudo i2cget -y 1 0x68 0x75 2>&1)
  b=$(timeout 3 sudo i2cget -y 1 0x76 0xD0 2>&1)
  echo "第${i}次: PCA9685(0x40)=$p  MPU6050(0x68)=$m  BMP280(0x76)=$b"
  sleep 1
done
echo "=== 最近10分钟 PWM/总线错误 ==="
journalctl -u smart-farm --since '-10 min' --no-pager | grep -acE 'PWM 失败|Remote I/O|Connection timed out' || true
