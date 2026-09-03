#!/bin/bash
set -e
echo "=== 1. 停止服务 ==="
sudo systemctl stop smart-farm
echo "=== 2. 删除陈旧缓存 ==="
ls -la /home/pi/smart-farm/data/cache.db
sudo rm -f /home/pi/smart-farm/data/cache.db
echo "已删除"
echo "=== 3. 重启服务 ==="
sudo systemctl start smart-farm
sleep 8
systemctl is-active smart-farm
echo "=== 4. 验证缓存已重建 ==="
ls -la /home/pi/smart-farm/data/ 2>/dev/null
echo "=== 5. 最近日志 ==="
journalctl -u smart-farm -n 12 --no-pager | tail -10
