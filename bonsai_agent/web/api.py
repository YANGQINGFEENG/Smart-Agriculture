from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse

from database.repository import (
    get_latest_sensor_record,
    get_latest_detection_record,
    get_latest_diagnosis_record,
    get_latest_device_log
)


# ==================================================
# 路径
# ==================================================

BASE_DIR = Path(__file__).resolve().parent

INDEX_FILE = BASE_DIR / "static" / "index.html"


# ==================================================
# 创建FastAPI应用
# ==================================================

app = FastAPI(
    title="天工慧眼 API",
    description="川派盆景智能监测与自主养护平台",
    version="1.0"
)


# ==================================================
# Web首页
# ==================================================

@app.get("/")
def home():

    return FileResponse(
        INDEX_FILE
    )


# ==================================================
# 最新传感器数据
# ==================================================

@app.get("/api/sensors")
def get_sensors():

    data = get_latest_sensor_record()

    if data is None:

        return {
            "success": False,
            "message": "暂无传感器数据"
        }

    return {
        "success": True,
        "data": data
    }


# ==================================================
# 最新YOLO识别数据
# ==================================================

@app.get("/api/detection")
def get_detection():

    data = get_latest_detection_record()

    if data is None:

        return {
            "success": False,
            "message": "暂无YOLO识别数据"
        }

    return {
        "success": True,
        "data": data
    }


# ==================================================
# 最新Agent诊疗结果
# ==================================================

@app.get("/api/diagnosis")
def get_diagnosis():

    data = get_latest_diagnosis_record()

    if data is None:

        return {
            "success": False,
            "message": "暂无诊疗数据"
        }

    return {
        "success": True,
        "data": data
    }


# ==================================================
# 最新设备执行记录
# ==================================================

@app.get("/api/device/latest")
def get_device_latest():

    data = get_latest_device_log()

    if data is None:

        return {
            "success": False,
            "message": "暂无设备执行记录"
        }

    return {
        "success": True,
        "data": data
    }


# ==================================================
# 系统运行状态
# ==================================================

@app.get("/api/status")
def get_status():

    return {
        "success": True,
        "system": "天工慧眼",
        "server": "online",
        "database": "SQLite",
        "vision": "YOLO",
        "ai": "DeepSeek + Ollama",
        "control": "规则控制"
    }