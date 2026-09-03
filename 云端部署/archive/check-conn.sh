#!/bin/bash
mysql -u root -pCloudMysql@2026 -e "SELECT id, SUBSTRING_INDEX(host,':',1) AS src_ip, db, command, time FROM information_schema.processlist ORDER BY id;" 2>/dev/null
