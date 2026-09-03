#!/bin/bash
echo "=== 进程 ==="
pgrep -af 'main.py' || echo "无 main.py 进程"
echo "=== libcamera 识别 ==="
timeout 15 rpicam-hello --list-cameras 2>&1 | head -6
echo "=== I2C 总线 1 ==="
sudo i2cdetect -y 1 2>/dev/null | tail -8
echo "=== 服务状态 ==="
systemctl is-active smart-farm
echo "=== 最近摄像头相关日志 ==="
journalctl -u smart-farm --since '14:42:50' --no-pager | grep -iE '摄像头|camera|帧上传|视频流' | tail -8
