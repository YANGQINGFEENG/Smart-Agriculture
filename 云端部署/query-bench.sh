#!/bin/bash
# 验证修复后的查询性能
mysql -uroot -p'CloudMysql@2026' smart_agriculture -e "
SET profiling = 1;
SELECT
  s.id as sensor_id, s.name as sensor_name, st.type, st.name as type_name,
  sd.value, st.unit, sd.timestamp
FROM sensor_data sd
INNER JOIN sensors s ON sd.sensor_id = s.id
INNER JOIN sensor_types st ON s.type_id = st.id
WHERE sd.timestamp = (SELECT MAX(timestamp) FROM sensor_data WHERE sensor_id = s.id)
ORDER BY s.id;
SHOW PROFILES;
" 2>/dev/null | tail -8
echo "=== 负载 ==="
uptime
echo "QUERY_BENCH_DONE"
