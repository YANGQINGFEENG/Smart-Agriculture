#!/bin/bash
# 杀掉长时间僵死的查询
mysql -uroot -p'CloudMysql@2026' -e "KILL 24; KILL 23; KILL 36;" 2>/dev/null
sleep 3
mysql -uroot -p'CloudMysql@2026' -e "
SELECT id, time, LEFT(COALESCE(info,''),80) AS info FROM information_schema.processlist WHERE command<>'Sleep';
" 2>/dev/null
echo "=== CPU/负载 ==="
uptime
top -bn1 | head -5 | tail -3
echo "KILL_DONE"
