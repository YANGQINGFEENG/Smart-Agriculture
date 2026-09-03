#!/bin/bash
echo "=== 最近 8 条指令 ==="
mysql -uroot -pCloudMysql@2026 smart_agriculture -N -e 'SELECT id, command, control_value, status, created_at FROM actuator_commands WHERE actuator_id="CAM-1-001" ORDER BY id DESC LIMIT 8;' 2>/dev/null
echo "=== 锁状态 ==="
mysql -uroot -pCloudMysql@2026 smart_agriculture -N -e 'SELECT locked, last_update FROM actuators WHERE id="CAM-1-001";' 2>/dev/null
