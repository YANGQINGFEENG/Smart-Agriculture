#!/bin/bash
# 将超过2分钟仍处于executing的指令标记为timeout，并解锁对应执行器
mysql -uroot -pCloudMysql@2026 smart_agriculture -e "
UPDATE actuator_commands SET status='timeout' WHERE status='executing' AND created_at < DATE_SUB(NOW(), INTERVAL 2 MINUTE);
SELECT id, command, status FROM actuator_commands WHERE actuator_id='CAM-1-001' ORDER BY id DESC LIMIT 4;
UPDATE actuators SET locked=0 WHERE id NOT IN (SELECT DISTINCT actuator_id FROM actuator_commands WHERE status='executing');
SELECT id, locked FROM actuators WHERE locked=1;
" 2>/dev/null
echo "=== done ==="
