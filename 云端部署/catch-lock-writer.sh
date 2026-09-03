#!/bin/bash
MP="-uroot -pCloudMysql@2026"
# 1. 开 general_log 抓写入者
mysql $MP -e "SET GLOBAL general_log='ON'; SET GLOBAL log_output='TABLE';" 2>/dev/null
# 2. 立即手动解锁
mysql $MP smart_agriculture -e "UPDATE actuators SET locked=0 WHERE id='CAM-1-001';" 2>/dev/null
echo "unlocked at $(date +%H:%M:%S), 等待100秒观察谁再加锁..."
sleep 100
# 3. 查看当前锁状态
mysql $MP smart_agriculture -N -e "SELECT locked, last_update FROM actuators WHERE id='CAM-1-001';" 2>/dev/null
# 4. 抓取刚才100秒内所有涉及 actuators 的 UPDATE
echo "=== general_log 中的 UPDATE actuators ==="
mysql $MP -N -e "SELECT CONVERT(event_time USING utf8) AS t, LEFT(CONVERT(argument USING utf8), 200) FROM mysql.general_log WHERE command_type='Query' AND CONVERT(argument USING utf8) LIKE '%UPDATE%actuators%' AND event_time > DATE_SUB(NOW(), INTERVAL 100 SECOND) ORDER BY event_time;" 2>/dev/null
mysql $MP -e "SET GLOBAL general_log='OFF';" 2>/dev/null
