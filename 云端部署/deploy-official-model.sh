#!/bin/bash
# 树莓派部署 YOLO 官方通用模型（yolov8n.pt：COCO 80 类，ultralytics 8.1.x 原生支持）
# 说明：yolo11n.pt 需要 ultralytics>=8.3，当前设备为 8.1.19，加载会报 C3k2 缺失
MODELS_DIR="$HOME/smart-farm/models"
mkdir -p "$MODELS_DIR"
cd "$MODELS_DIR" || exit 1
python3 - <<'PY'
from ultralytics import YOLO
m = YOLO("yolov8n.pt")
names = list(m.names.values())
print("LOAD_OK classes=%d sample=%s" % (len(names), names[:5]))
PY
echo "--- models dir ---"
ls -l "$MODELS_DIR"
echo "--- disk ---"
df -h / | tail -1
echo "DEPLOY_OFFICIAL_MODEL_DONE"
