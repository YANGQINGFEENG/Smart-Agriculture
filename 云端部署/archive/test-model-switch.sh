#!/bin/bash
# 端到端验证：网页端 API 下发识别模型切换 -> 树莓派热切换 -> 回执入库
BASE=http://127.0.0.1:3000
GW=10.248.88.186
TARGET=${1:-yolov8n.pt}
pp() { (python3 -m json.tool 2>/dev/null || cat) | head -70; }

echo "=== [1] 切换前模型清单与状态 ==="
curl -s "$BASE/api/device/yolo-models?gateway_ip=$GW" | pp

echo "=== [2] 下发切换指令 -> $TARGET ==="
curl -s -X POST "$BASE/api/device/yolo-models/switch" \
  -H 'Content-Type: application/json' \
  -d "{\"gateway_ip\":\"$GW\",\"filename\":\"$TARGET\"}" | pp

echo "=== [3] 等待硬件端热切换（25s）==="
sleep 25

echo "=== [4] 切换记录 ==="
curl -s "$BASE/api/device/yolo-models/switch?gateway_ip=$GW&limit=5" | pp

echo "=== [5] 切换后状态 ==="
curl -s "$BASE/api/device/yolo-models/status?gateway_ip=$GW" | pp

echo "=== [6] 数据库核对 ==="
mysql -uroot -p'CloudMysql@2026' smart_agriculture -e "
SELECT id, filename, source, is_active, status, size_mb, class_count, LEFT(COALESCE(last_message,''),40) AS msg
FROM yolo_models WHERE gateway_ip='$GW' ORDER BY id;
SELECT gateway_ip, current_model, loaded, class_count, switch_count, switching, reported_at
FROM yolo_model_status WHERE gateway_ip='$GW';
SELECT id, filename, from_model, status, LEFT(COALESCE(message,''),50) AS message, pushed_at, acked_at
FROM yolo_model_switch_logs WHERE gateway_ip='$GW' ORDER BY id DESC LIMIT 5;
" 2>/dev/null
echo "E2E_MODEL_SWITCH_DONE"
