#!/bin/bash
# 查看识别模型清单（HTTP API + 数据库），用于部署后核对
GW=10.248.88.186
echo "=== HTTP /api/device/yolo-models ==="
curl -s "http://127.0.0.1:3000/api/device/yolo-models?gateway_ip=$GW" > /tmp/yolo-models.json
python3 - <<'PY'
import json
d = json.load(open('/tmp/yolo-models.json')).get("data") or {}
print("gateway_ip:", d.get("gateway_ip"), "| default:", d.get("default_gateway_ip"))
for m in d.get("models") or []:
    print(f"  id={m['id']:<3} {m['filename']:<14} source={m['source']:<9} is_active={int(m['is_active'])} "
          f"status={m['status']:<9} size_mb={m.get('size_mb')} classes={m.get('class_count')} "
          f"on_device={m.get('on_device')} is_current={m.get('is_current')}")
s = d.get("status") or {}
if s:
    print("status:", s.get("current_model"), "| classes:", s.get("class_count"),
          "| avg_ms:", s.get("avg_inference_time_ms"), "| inferences:", s.get("total_inferences"),
          "| switches:", s.get("switch_count"), "| reported_at:", s.get("reported_at"))
PY

echo "=== MySQL yolo_models ==="
mysql -uroot -p'CloudMysql@2026' smart_agriculture -e "
SELECT id, filename, name, source, is_active, status, size_mb, class_count
FROM yolo_models WHERE gateway_ip='$GW' ORDER BY id;" 2>/dev/null

echo "=== MySQL yolo_model_switch_logs (last 6) ==="
mysql -uroot -p'CloudMysql@2026' smart_agriculture -e "
SELECT id, filename, from_model, status, LEFT(COALESCE(message,''),44) AS message, pushed_at, acked_at
FROM yolo_model_switch_logs WHERE gateway_ip='$GW' ORDER BY id DESC LIMIT 6;" 2>/dev/null
echo "CHECK_MODELS_DONE"
