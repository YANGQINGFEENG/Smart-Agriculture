from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import uvicorn
import tempfile
import os

app = FastAPI(title="YOLO推理服务")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None


def load_model():
    global model
    if model is None:
        import torch
        model_path = os.environ.get("MODEL_PATH", "/app/models/yolov5n.pt")
        if os.path.exists(model_path):
            model = torch.hub.load(
                "ultralytics/yolov5", "custom", path=model_path, force_reload=False
            )
        else:
            model = torch.hub.load("ultralytics/yolov5", "yolov5n", force_reload=False, trust_repo=True)
        model.conf = 0.1
    return model


@app.post("/detect")
async def detect_objects(file: UploadFile = File(...)):
    import cv2
    import numpy as np

    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return {"success": False, "error": "无法解析图片", "detections": []}

    m = load_model()
    results = m(img)

    detections = []
    for *box, conf, cls in results.xyxy[0].tolist():
        x, y, x2, y2 = box
        detections.append(
            {
                "class": results.names[int(cls)],
                "confidence": float(conf),
                "box": {
                    "x": int(x),
                    "y": int(y),
                    "width": int(x2 - x),
                    "height": int(y2 - y),
                },
            }
        )

    return {"success": True, "detections": detections}


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": model is not None}


if __name__ == "__main__":
    load_model()
    uvicorn.run(app, host="0.0.0.0", port=5000)
