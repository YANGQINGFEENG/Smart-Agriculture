#!/bin/bash
echo "=== 锁状态 ==="
mysql -uroot -pCloudMysql@2026 smart_agriculture -N -e 'SELECT id, locked FROM actuators WHERE id="CAM-1-001";' 2>/dev/null
echo "=== 最近指令 ==="
mysql -uroot -pCloudMysql@2026 smart_agriculture -N -e 'SELECT id, command, status, created_at FROM commands WHERE actuator_id="CAM-1-001" ORDER BY id DESC LIMIT 5;' 2>/dev/null
