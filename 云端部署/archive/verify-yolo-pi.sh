#!/bin/bash
cd /home/pi/smart-farm
~/smart-farm/venv/bin/python - <<'EOF'
from ultralytics import YOLO
m = YOLO("models/last.pt")
print("MODEL_OK", list(m.names.values())[:8])
EOF
echo "LOAD_DONE"
