#!/bin/bash
mysql -u root -p'CloudMysql@2026' -e "USE smart_agriculture; DESCRIBE sensor_data;" 2>&1 | grep -v "Using a password"
mysql -u root -p'CloudMysql@2026' -e "USE smart_agriculture; SELECT * FROM sensor_data ORDER BY id DESC LIMIT 5;" 2>&1 | grep -v "Using a password"
