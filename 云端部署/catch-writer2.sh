#!/bin/bash
MP="-u root -pCloudMysql@2026"
mysql $MP -e "SET GLOBAL general_log='ON'; SET GLOBAL general_log_file='/tmp/mysql-general.log';"
echo "general log ON, waiting 70s..."
sleep 70
mysql $MP -e "SET GLOBAL general_log='OFF';"
echo "=== UPDATE actuators 相关语句 ==="
grep -a "UPDATE actuators\|UPDATE \`actuators\`" /tmp/mysql-general.log | tail -20
echo "=== 含 192.168.1.63 的语句 ==="
grep -a "192.168.1.63" /tmp/mysql-general.log | tail -10
wc -l /tmp/mysql-general.log
rm -f /tmp/mysql-general.log
