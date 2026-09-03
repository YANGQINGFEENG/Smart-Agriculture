from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import uvicorn
import tempfile
import logging
import time
import os

log_level = os.environ.get("LOG_LEVEL", "info").upper()
logging.basicConfig(
    level=getattr(logging, log_level, logging.INFO),
    format='[%(asctime)s] [%(levelname)-5s] [%(name)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("inference-service")

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
        logger.info("正在加载模型: %s", model_path)
        t0 = time.time()
        try:
            if os.path.exists(model_path):
                model = torch.hub.load(
                    "ultralytics/yolov5", "custom", path=model_path, force_reload=False
                )
            else:
                model = torch.hub.load("ultralytics/yolov5", "yolov5n", force_reload=False, trust_repo=True)
            model.conf = 0.1
            elapsed = time.time() - t0
            logger.info("模型加载成功，耗时 %.2f 秒", elapsed)
        except Exception as e:
            elapsed = time.time() - t0
            logger.error("模型加载失败（耗时 %.2f 秒）: %s", elapsed, e)
            raise
    return model


@app.post("/detect")
async def detect_objects(file: UploadFile = File(...)):
    import cv2
    import numpy as np

    contents = await file.read()
    logger.info("收到检测请求: 文件=%s, 大小=%d 字节", file.filename, len(contents))

    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        logger.error("无法解析图片: %s", file.filename)
        return {"success": False, "error": "无法解析图片", "detections": []}

    m = load_model()
    t0 = time.time()
    results = m(img)
    infer_elapsed = time.time() - t0
    logger.info("推理完成，耗时 %.2f 秒", infer_elapsed)

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

    logger.info("检测到 %d 个目标", len(detections))
    return {"success": True, "detections": detections}


@app.get("/health")
async def health():
    model_status = "已加载" if model is not None else "未加载"
    logger.debug("健康检查: 模型状态=%s", model_status)
    return {"status": "ok", "model_loaded": model is not None}


if __name__ == "__main__":
    logger.info("推理服务启动中...")
    load_model()
    logger.info("服务监听 0.0.0.0:5000")
    uvicorn.run(app, host="0.0.0.0", port=5000)
