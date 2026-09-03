#!/bin/bash
mysql -u root -p'CloudMysql@2026' --default-character-set=utf8mb4 -e "
USE smart_agriculture;
SELECT s.id, st.type, sd.value, sd.recorded_at
FROM sensor_data sd JOIN sensors s ON sd.sensor_id = s.id JOIN sensor_types st ON s.type_id = st.id
ORDER BY sd.id DESC LIMIT 8;
SELECT COUNT(*) AS total FROM sensor_data;
" 2>&1 | grep -v "Using a password"
