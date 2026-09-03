#!/bin/bash
mysql -u root -p'CloudMysql@2026' --default-character-set=utf8mb4 -e "
USE smart_agriculture;
SELECT
 (SELECT COUNT(*) FROM farms) AS farms,
 (SELECT COUNT(*) FROM zones) AS zones,
 (SELECT COUNT(*) FROM sensors) AS sensors,
 (SELECT COUNT(*) FROM sensor_data) AS sensor_data,
 (SELECT COUNT(*) FROM devices) AS devices,
 (SELECT COUNT(*) FROM gateways) AS gateways;
SHOW TABLES;
" 2>&1 | grep -v "Using a password"
