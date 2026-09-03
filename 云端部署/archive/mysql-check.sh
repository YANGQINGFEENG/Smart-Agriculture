#!/bin/bash
# 排查 MySQL 高 CPU：当前查询 + 大表
mysql -uroot -p'CloudMysql@2026' -e "
SELECT id, user, db, command, time, state, LEFT(COALESCE(info,''),120) AS info
FROM information_schema.processlist
WHERE command<>'Sleep' ORDER BY time DESC LIMIT 10;

SELECT table_name, table_rows, ROUND((data_length+index_length)/1024/1024) AS total_mb
FROM information_schema.tables
WHERE table_schema='smart_agriculture'
ORDER BY (data_length+index_length) DESC LIMIT 8;

SHOW GLOBAL STATUS LIKE 'Threads_running';
SHOW GLOBAL STATUS LIKE 'Questions';
" 2>/dev/null
echo "=== innodb status 摘要 ==="
mysql -uroot -p'CloudMysql@2026' -e "SHOW ENGINE INNODB STATUS\G" 2>/dev/null | grep -A 12 "ACTIVE\| queries" | head -40
echo "MYSQL_CHECK_DONE"
