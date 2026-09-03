#!/bin/bash
# 检查 sensor_data / device_data 现有索引
mysql -uroot -p'CloudMysql@2026' smart_agriculture -e "SHOW INDEX FROM sensor_data;" 2>/dev/null
echo "---device_data---"
mysql -uroot -p'CloudMysql@2026' smart_agriculture -e "SHOW INDEX FROM device_data;" 2>/dev/null
echo "INDEX_CHECK_DONE"
