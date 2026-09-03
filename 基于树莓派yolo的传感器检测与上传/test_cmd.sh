#!/bin/bash
# 手动发送RGB命令测试
echo "=== 发送RGB预设颜色命令(value=1, 红色) ==="
curl -s -X POST http://192.168.1.22:3000/api/actuators/LT-1-002/commands \
  -H 'Content-Type: application/json' \
  -d '{"control_type":"rgb","command":"value","value":1}'
echo ""

echo "=== 等待5秒后查看硬件端日志 ==="
sleep 5
sudo journalctl -u smart-farm --since '10 sec ago' --no-pager | grep -E '命令|回执|RGB|rgb|LT-1-002|执行|WebSocket'
