#!/bin/bash
echo "=== 1. 停服务 ==="
sudo systemctl stop smart-farm
sleep 3
echo "=== 2. 系统级抓帧测试 (rpicam-hello 5秒) ==="
timeout 30 rpicam-hello -t 5000 --nopreview 2>&1 | tail -6
echo "exit_code=$?"
echo "=== 3. 测试结果判定 ==="
ls -la /tmp/test-frame.jpg 2>/dev/null
echo "=== 4. 重启服务 ==="
sudo systemctl start smart-farm
