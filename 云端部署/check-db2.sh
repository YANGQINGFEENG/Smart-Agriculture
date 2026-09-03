#!/bin/bash
mysql -u root -p'CloudMysql@2026' -e "USE smart_agriculture; SHOW TABLES;" 2>&1 | grep -v "Using a password"
echo "=== 关键表行数 ==="
mysql -u root -p'CloudMysql@2026' -e "USE smart_agriculture; SELECT COUNT(*) AS farms FROM farms; SELECT COUNT(*) AS sensors FROM sensors; SELECT COUNT(*) AS sensor_data FROM sensor_data;" 2>&1 | grep -v "Using a password"
