#!/bin/bash
M="mysql -u root -p'CloudMysql@2026'"
eval $M -e "SET GLOBAL general_log='ON'; SET GLOBAL general_log_file='/tmp/mysql-general.log';"
echo "logging for 70s..."
sleep 70
eval $M -e "SET GLOBAL general_log='OFF';"
echo "=== 写 feedback/stream_url 的语句 ==="
grep -a "feedback" /tmp/mysql-general.log | grep -av "SELECT" | tail -20
echo "=== 该时段写入者线程上下文 ==="
grep -aB2 "UPDATE actuators" /tmp/mysql-general.log | tail -30
rm -f /tmp/mysql-general.log
