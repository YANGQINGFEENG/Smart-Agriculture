#!/bin/bash
sudo systemctl stop smart-farm
sleep 3
echo "=== rpicam-jpeg 抓图测试 (最多等 25 秒) ==="
timeout 25 rpicam-jpeg -o /tmp/test-cam.jpg -t 3000 --nopreview 2>&1 | tail -5
if [ -s /tmp/test-cam.jpg ]; then
  echo "SUCCESS: 抓图成功 $(ls -la /tmp/test-cam.jpg | awk '{print $5}') bytes"
else
  echo "FAILED: 无法抓图"
fi
echo "=== 换路测试: libcamera-still ==="
timeout 20 libcamera-still -o /tmp/test-cam2.jpg -t 2000 --nopreview 2>&1 | tail -3
[ -s /tmp/test-cam2.jpg ] && echo "SUCCESS2: $(stat -c%s /tmp/test-cam2.jpg) bytes" || echo "FAILED2"
sudo systemctl start smart-farm
