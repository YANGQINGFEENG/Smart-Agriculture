#!/bin/bash
# 1. 确保事件调度器开启
mysql -uroot -pCloudMysql@2026 -e "SET GLOBAL event_scheduler = ON;" 2>/dev/null
# 2. 删除旧事件（如有）
mysql -uroot -pCloudMysql@2026 smart_agriculture -e "DROP EVENT IF EXISTS auto_unlock_actuators;" 2>/dev/null
# 3. 创建自动清理+解锁事件：每30秒执行一次
mysql -uroot -pCloudMysql@2026 smart_agriculture -e "
CREATE EVENT auto_unlock_actuators
ON SCHEDULE EVERY 30 SECOND
ON COMPLETION PRESERVE
ENABLE
DO BEGIN
  UPDATE actuator_commands SET status='timeout' WHERE status IN ('pending','executing') AND created_at < DATE_SUB(NOW(), INTERVAL 2 MINUTE);
  UPDATE actuators a SET a.locked=0 WHERE a.locked=1 AND NOT EXISTS (
    SELECT 1 FROM actuator_commands c
    WHERE c.actuator_id=a.id AND c.status IN ('pending','executing') AND c.created_at > DATE_SUB(NOW(), INTERVAL 2 MINUTE)
  );
END;" 2>/dev/null
# 4. 验证
mysql -uroot -pCloudMysql@2026 -N -e "SELECT @@event_scheduler;" 2>/dev/null
mysql -uroot -pCloudMysql@2026 smart_agriculture -N -e "SELECT EVENT_NAME, STATUS, INTERVAL_VALUE, INTERVAL_FIELD FROM information_schema.EVENTS WHERE EVENT_SCHEMA='smart_agriculture';" 2>/dev/null
echo "=== 立即清理一次 ==="
mysql -uroot -pCloudMysql@2026 smart_agriculture -e "UPDATE actuator_commands SET status='timeout' WHERE status IN ('pending','executing') AND created_at < DATE_SUB(NOW(), INTERVAL 2 MINUTE); UPDATE actuators a SET a.locked=0 WHERE a.locked=1 AND NOT EXISTS (SELECT 1 FROM actuator_commands c WHERE c.actuator_id=a.id AND c.status IN ('pending','executing') AND c.created_at > DATE_SUB(NOW(), INTERVAL 2 MINUTE)); SELECT id, locked FROM actuators WHERE locked=1;" 2>/dev/null
echo "=== done（上面无输出=没有执行器被锁） ==="
