import cv2
import torch
import sys
import json
from pathlib import Path

# 加载YOLO模型
def load_model():
    try:
        # 直接使用YOLOv5，因为它已经被缓存
        model = torch.hub.load('ultralytics/yolov5', 'yolov5n', force_reload=False)
        return model
    except Exception as e:
        print(f"加载模型时出错: {e}")
        return None

# 检测函数
def detect_objects(image_path):
    model = load_model()
    if not model:
        return []
    
    try:
        # 读取图片
        img = cv2.imread(image_path)
        if img is None:
            return []
        
        # 设置较低的置信度阈值
        model.conf = 0.1  # 降低置信度阈值
        
        # 推理
        results = model(img)
        
        # 处理结果
        detections = []
        for *box, conf, cls in results.xyxy[0].tolist():
            x, y, x2, y2 = box
            detections.append({
                "class": results.names[int(cls)],
                "confidence": float(conf),
                "box": {
                    "x": int(x),
                    "y": int(y),
                    "width": int(x2 - x),
                    "height": int(y2 - y)
                }
            })
        
        return detections
    except Exception as e:
        return []

# 主函数
if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps([]))
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    # 调试：检查图片是否存在
    import os
    if not os.path.exists(image_path):
        print(f"图片不存在: {image_path}")
        print(json.dumps([]))
        sys.exit(1)
    
    # 调试：检查图片大小
    img = cv2.imread(image_path)
    if img is None:
        print("无法读取图片")
        print(json.dumps([]))
        sys.exit(1)
    print(f"图片大小: {img.shape}")
    
    # 加载模型
    model = load_model()
    if not model:
        print("模型加载失败")
        print(json.dumps([]))
        sys.exit(1)
    print("模型加载成功")
    
    # 推理
    model.conf = 0.1
    results = model(img)
    print(f"推理完成，检测到 {len(results.xyxy[0])} 个目标")
    
    # 处理结果
    detections = []
    for *box, conf, cls in results.xyxy[0].tolist():
        x, y, x2, y2 = box
        detections.append({
            "class": results.names[int(cls)],
            "confidence": float(conf),
            "box": {
                "x": int(x),
                "y": int(y),
                "width": int(x2 - x),
                "height": int(y2 - y)
            }
        })
    
    print(f"处理完成，返回 {len(detections)} 个结果")
    print(json.dumps(detections))
