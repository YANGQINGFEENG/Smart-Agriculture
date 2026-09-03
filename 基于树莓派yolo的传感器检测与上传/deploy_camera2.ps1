# 部署摄像头和舵机模块 - 使用相对路径
$SRC = Get-Location

Write-Host "=== 推送摄像头和舵机模块 ===" -ForegroundColor Cyan

# 推送文件
scp ".\drivers\actuators\servo.py" pi@raspberrypi:~/smart-farm/drivers/actuators/
scp ".\drivers\camera_tracker.py" pi@raspberrypi:~/smart-farm/drivers/
scp ".\drivers\actuators\__init__.py" pi@raspberrypi:~/smart-farm/drivers/actuators/
scp ".\app\system.py" pi@raspberrypi:~/smart-farm/app/
scp ".\config\settings.yaml" pi@raspberrypi:~/smart-farm/config/
scp ".\test_camera_servo.py" pi@raspberrypi:~/smart-farm/

Write-Host ""
Write-Host "=== 检查依赖库 ===" -ForegroundColor Cyan
ssh pi@raspberrypi "python3 -c 'import cv2; print(\"opencv: OK\")' 2>&1 || echo 'opencv: missing'; python3 -c 'import picamera2; print(\"picamera2: OK\")' 2>&1 || echo 'picamera2: missing'; python3 -c 'import adafruit_servokit; print(\"servokit: OK\")' 2>&1 || echo 'servokit: missing'; python3 -c 'import numpy; print(\"numpy: OK\")' 2>&1 || echo 'numpy: missing'"

Write-Host ""
Write-Host "=== 在树莓派上运行测试 ===" -ForegroundColor Cyan
ssh pi@raspberrypi "cd ~/smart-farm && python3 test_camera_servo.py"
