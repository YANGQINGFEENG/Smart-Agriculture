#!/bin/bash
# 云端建表：YOLO 识别模型管理（yolo_models / yolo_model_status / yolo_model_switch_logs）
mysql -uroot -p'CloudMysql@2026' < /tmp/create-yolo-models-table.sql 2>&1 | grep -v "Using a password"
echo "=== 建表结果 ==="
mysql -uroot -p'CloudMysql@2026' smart_agriculture -e "SHOW TABLES LIKE 'yolo%';" 2>/dev/null
echo "=== 表结构核对 ==="
mysql -uroot -p'CloudMysql@2026' smart_agriculture -e "
SELECT COUNT(*) AS yolo_models_rows FROM yolo_models;
SELECT COUNT(*) AS yolo_model_status_rows FROM yolo_model_status;
SELECT COUNT(*) AS switch_logs_rows FROM yolo_model_switch_logs;
SELECT id, name, ip_address, status FROM gateways ORDER BY id;
" 2>/dev/null
echo "CREATE_TABLES_DONE"
