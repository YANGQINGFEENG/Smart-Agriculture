#!/bin/bash
echo "=== 连续观测 CAM feedback 变化 (每5秒,共5次) ==="
for i in 1 2 3 4 5; do
  v=$(mysql -u root -p'CloudMysql@2026' -N -e "USE smart_agriculture; SELECT JSON_UNQUOTE(JSON_EXTRACT(feedback,'\$.stream_url')), last_update FROM actuators WHERE id='CAM-1-001';" 2>/dev/null)
  echo "[$i] $v"
  sleep 5
done
echo "=== WS 服务器最近日志(注册来源) ==="
journalctl -u pm2-root -n 200 --no-pager 2>/dev/null | grep -iE "register|gateway|connected" | tail -10
ls /root/.pm2/logs/ 2>/dev/null
tail -30 /root/.pm2/logs/smart-agri-ws-out.log 2>/dev/null | grep -iE "register|gateway|connect" | tail -8
