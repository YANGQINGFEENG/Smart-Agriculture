#!/bin/bash
# 用服务实际使用的解释器（~/smart-farm/venv）验证候选官方模型能否加载
VENV=$HOME/smart-farm/venv/bin/python
echo "=== 解释器与版本 ==="
$VENV -c "import sys, ultralytics; print(sys.executable); print('ultralytics', ultralytics.__version__)"

for f in "$@"; do
  echo "=== 加载测试: $f ==="
  $VENV - "$f" <<'PY'
import sys
path = sys.argv[1]
try:
    from ultralytics import YOLO
    m = YOLO(path)
    names = m.names
    n = len(names) if hasattr(names, "__len__") else -1
    print(f"LOAD_OK {path} classes={n} first={list(names.values())[:3] if isinstance(names, dict) else names[:3]}")
except Exception as e:
    print(f"LOAD_FAIL {path}: {type(e).__name__}: {e}")
PY
done
echo "VENV_MODEL_TEST_DONE"
