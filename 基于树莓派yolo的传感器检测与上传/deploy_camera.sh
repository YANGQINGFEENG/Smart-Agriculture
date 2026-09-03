#!/bin/bash
# 摄像头和舵机模块部署脚本

SRC_DIR="e:/基于树莓派yolo的传感器检测与上传"
DEST="pi@raspberrypi:~/smart-farm"

echo "=== 推送摄像头和舵机模块 ==="

# 推送新文件
scp "$SRC_DIR/drivers/actuators/servo.py" $DEST/drivers/actuators/
scp "$SRC_DIR/drivers/camera_tracker.py" $DEST/drivers/
scp "$SRC_DIR/drivers/actuators/__init__.py" $DEST/drivers/actuators/
scp "$SRC_DIR/app/system.py" $DEST/app/
scp "$SRC_DIR/config/settings.yaml" $DEST/config/
scp "$SRC_DIR/test_camera_servo.py" $DEST/

echo ""
echo "=== 检查依赖库 ==="
ssh pi@raspberrypi "
    pip3 list 2>/dev/null | grep -E 'opencv|picamera|servokit|numpy' || echo '检查中...'
    
    # 检查是否需要安装
    python3 -c 'import cv2' 2>/dev/null || echo '警告: opencv-python 未安装'
    python3 -c 'import picamera2' 2>/dev/null || echo '警告: picamera2 未安装'
    python3 -c 'import adafruit_servokit' 2>/dev/null || echo '警告: adafruit-circuitpython-servokit 未安装'
    python3 -c 'import numpy' 2>/dev/null || echo '警告: numpy 未安装'
"

echo ""
echo "=== 在树莓派上运行测试 ==="
ssh pi@raspberrypi "cd ~/smart-farm && python3 test_camera_servo.py"
