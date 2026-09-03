#!/bin/bash
# 在树莓派上实测各官方通用模型能否被当前 ultralytics 版本加载
cd /tmp
python3 -c "import ultralytics; print('ultralytics', ultralytics.__version__)"
for f in yolo11n.pt yolov5n.pt yolov8n.pt; do
  [ -f "/tmp/$f" ] || { echo "=== $f SKIP (文件不存在) ==="; continue; }
  echo "=== $f ==="
  python3 - "$f" <<'PY' 2>&1 | tail -4
import sys
name = sys.argv[1]
try:
    from ultralytics import YOLO
    m = YOLO("/tmp/" + name)
    names = list(m.names.values()) if hasattr(m.names, "values") else m.names
    print("LOAD_OK %s classes=%d sample=%s" % (name, len(names), names[:5]))
except Exception as e:
    print("LOAD_FAIL %s: %s: %s" % (name, type(e).__name__, e))
PY
done
echo "MODEL_LOAD_TEST_DONE"
