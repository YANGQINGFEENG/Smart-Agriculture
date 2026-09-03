#!/bin/bash
mysql -uroot -pCloudMysql@2026 smart_agriculture -e 'UPDATE actuators SET locked=0 WHERE id="CAM-1-001"; SELECT id, locked FROM actuators WHERE id="CAM-1-001";' 2>/dev/null
