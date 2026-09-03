#!/bin/bash
# 扫描 I2C 总线设备
echo "=== I2C 总线扫描 ==="
echo "检查是否安装 i2c-tools..."
which i2cdetect || sudo apt-get install -y i2c-tools

echo ""
echo "扫描 I2C 总线 1 (GPIO2/SDA, GPIO3/SCL):"
sudo i2cdetect -y 1

echo ""
echo "如果看到 'UU' 表示该地址已被驱动程序占用"
echo "常见设备地址:"
echo "  0x40 - PCA9685 (舵机驱动)"
echo "  0x76/0x77 - BMP280 (气压传感器)"
echo "  0x68 - MPU6050 (加速度计)"
echo "  0x27/0x3f - LCD1602 (显示屏)"
