#!/bin/bash
mysql -u root -p'CloudMysql@2026' -e "USE smart_agriculture; DESCRIBE farms;" 2>&1 | grep -v "Using a password"
echo "=== sensors 结构 ==="
mysql -u root -p'CloudMysql@2026' -e "USE smart_agriculture; DESCRIBE sensors;" 2>&1 | grep -v "Using a password"
echo "=== 现有传感器 ==="
mysql -u root -p'CloudMysql@2026' -e "USE smart_agriculture; SELECT id,name,type_id,location FROM sensors LIMIT 10;" 2>&1 | grep -v "Using a password"
