# 部署摄像头和舵机模块
$SRC = "e:\基于树莓派yolo的传感器检测与上传"

Write-Host "=== 推送摄像头和舵机模块 ===" -ForegroundColor Cyan

# 推送文件
scp "$SRC\drivers\actuators\servo.py" pi@raspberrypi:~/smart-farm/drivers/actuators/
scp "$SRC\drivers\camera_tracker.py" pi@raspberrypi:~/smart-farm/drivers/
scp "$SRC\drivers\actuators\__init__.py" pi@raspberrypi:~/smart-farm/drivers/actuators/
scp "$SRC\app\system.py" pi@raspberrypi:~/smart-farm/app/
scp "$SRC\config\settings.yaml" pi@raspberrypi:~/smart-farm/config/
scp "$SRC\test_camera_servo.py" pi@raspberrypi:~/smart-farm/

Write-Host ""
Write-Host "=== 检查依赖库 ===" -ForegroundColor Cyan
ssh pi@raspberrypi "python3 -c 'import cv2; print(\"opencv: OK\")' 2>&1; python3 -c 'import picamera2; print(\"picamera2: OK\")' 2>&1; python3 -c 'import adafruit_servokit; print(\"servokit: OK\")' 2>&1; python3 -c 'import numpy; print(\"numpy: OK\")' 2>&1"

Write-Host ""
Write-Host "=== 在树莓派上运行测试 ===" -ForegroundColor Cyan
ssh pi@raspberrypi "cd ~/smart-farm && python3 test_camera_servo.py"
