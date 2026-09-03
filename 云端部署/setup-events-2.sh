#!/bin/bash
mysql -uroot -pCloudMysql@2026 smart_agriculture <<'EOF'
DROP EVENT IF EXISTS auto_unlock_actuators;
CREATE EVENT auto_unlock_actuators
ON SCHEDULE EVERY 30 SECOND
ON COMPLETION PRESERVE
ENABLE
DO
  UPDATE actuator_commands SET status='timeout' WHERE status IN ('pending','executing') AND created_at < DATE_SUB(NOW(), INTERVAL 2 MINUTE);
EOF
echo "--- event body 拆开：第二条用单独事件 ---"
mysql -uroot -pCloudMysql@2026 smart_agriculture <<'EOF'
DROP EVENT IF EXISTS auto_unlock_actuators2;
CREATE EVENT auto_unlock_actuators2
ON SCHEDULE EVERY 30 SECOND
ON COMPLETION PRESERVE
ENABLE
DO
  UPDATE actuators a SET a.locked=0 WHERE a.locked=1 AND NOT EXISTS (
    SELECT 1 FROM actuator_commands c
    WHERE c.actuator_id=a.id AND c.status IN ('pending','executing') AND c.created_at > DATE_SUB(NOW(), INTERVAL 2 MINUTE)
  );
EOF
mysql -uroot -pCloudMysql@2026 smart_agriculture -e "SHOW EVENTS;" 2>/dev/null
