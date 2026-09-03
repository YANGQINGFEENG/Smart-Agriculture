#!/bin/bash
echo "=== I2C 总线 ==="
sudo i2cdetect -y 1 | grep -E '^40|68|76|40:' 
sudo i2cdetect -y 1 | tail -3
echo "=== 摄像头初始化与服务 ==="
sleep 20
journalctl -u smart-farm --since '-3 min' --no-pager | grep -aE '摄像头初始化|视频流|帧上传|追踪已启动|timed out|YOLO' | tail -10
echo "=== 帧上传状态 ==="
journalctl -u smart-farm --since '-3 min' --no-pager | grep -a '帧上传' | tail -4
