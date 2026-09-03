#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""YOLO 目标检测模块 - 基于 ultralytics 在树莓派上运行推理

功能：
    1. 加载 YOLO 模型（.pt 文件）
    2. 对摄像头帧进行目标检测推理
    3. 在帧上绘制边界框和标签
    4. 返回标注后的帧供视频流和上传使用

使用方式：
    detector = YOLODetector(model_path="models/last.pt", conf_threshold=0.5)
    detector.load()
    annotated_frame = detector.detect(frame)  # frame 是 numpy BGR 图像
"""

import logging
import threading
import time
from typing import Optional, List, Dict, Any
import numpy as np

logger = logging.getLogger(__name__)


class YOLODetector:
    """YOLO 目标检测器 - 封装 ultralytics YOLO 模型推理"""

    def __init__(
        self,
        model_path: str = "models/last.pt",
        conf_threshold: float = 0.5,
        iou_threshold: float = 0.45,
        max_det: int = 20,
        img_size: int = 320,
        device: str = "cpu",
    ):
        """初始化 YOLO 检测器

        Args:
            model_path: 模型文件路径（.pt）
            conf_threshold: 置信度阈值（低于此值的结果被过滤）
            iou_threshold: NMS IoU 阈值
            max_det: 最大检测目标数
            img_size: 推理图像尺寸（树莓派建议 320，平衡速度与精度）
            device: 推理设备（cpu 或 cuda）
        """
        self.model_path = model_path
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        self.max_det = max_det
        self.img_size = img_size
        self.device = device

        self._model = None
        self._loaded = False
        self._lock = threading.Lock()
        self._class_names: List[str] = []
        self._switch_count = 0
        self._last_switch_time: Optional[float] = None

        # 统计信息
        self._total_inferences = 0
        self._total_inference_time = 0.0
        self._last_inference_time = 0.0
        self._last_detection_count = 0
        self._last_detections: List[Dict[str, Any]] = []

    def load(self) -> bool:
        """加载 YOLO 模型

        Returns:
            是否加载成功
        """
        try:
            from ultralytics import YOLO

            logger.info(f"[YOLO] 正在加载模型: {self.model_path}")
            t0 = time.time()

            self._model = YOLO(self.model_path)
            self._class_names = list(self._model.names.values()) if self._model.names else []

            load_time = time.time() - t0
            self._loaded = True
            logger.info(
                f"[YOLO] 模型加载成功 ({load_time:.1f}s) "
                f"类别数: {len(self._class_names)}, "
                f"推理尺寸: {self.img_size}, "
                f"设备: {self.device}"
            )
            if self._class_names:
                logger.info(f"[YOLO] 检测类别: {', '.join(self._class_names[:10])}"
                           f"{'...' if len(self._class_names) > 10 else ''}")
            return True

        except ImportError:
            logger.error("[YOLO] ultralytics 库未安装，请执行: pip install ultralytics")
            return False
        except FileNotFoundError:
            logger.error(f"[YOLO] 模型文件不存在: {self.model_path}")
            return False
        except Exception as e:
            logger.error(f"[YOLO] 模型加载失败: {e}")
            return False

    def switch_model(self, model_path: str) -> bool:
        """运行时热切换 YOLO 模型（供云端下发模型切换指令使用）

        先在锁外加载新模型（避免阻塞正在进行的推理），加载成功后再原子替换；
        加载失败时保留原模型继续工作，不影响视频流与检测。

        Args:
            model_path: 新模型文件路径（.pt）或 ultralytics 官方模型名（如 yolo11n.pt）

        Returns:
            是否切换成功
        """
        if not model_path:
            logger.error("[YOLO] 切换失败：模型路径为空")
            return False

        if model_path == self.model_path and self._loaded:
            logger.info(f"[YOLO] 已是当前模型，无需切换: {model_path}")
            return True

        try:
            from ultralytics import YOLO

            logger.info(f"[YOLO] 正在切换模型: {self.model_path} -> {model_path}")
            t0 = time.time()

            # 锁外加载新模型（首次加载官方模型名会触发自动下载）
            new_model = YOLO(model_path)
            new_class_names = list(new_model.names.values()) if new_model.names else []
            load_time = time.time() - t0

            # 原子替换，推理线程不会读到半成品状态
            with self._lock:
                old_path = self.model_path
                self._model = new_model
                self._class_names = new_class_names
                self.model_path = model_path
                self._loaded = True
                self._switch_count += 1
                self._last_switch_time = time.time()
                # 切换后清空历史统计，避免新旧模型数据混淆
                self._total_inferences = 0
                self._total_inference_time = 0.0
                self._last_detections = []
                self._last_detection_count = 0

            logger.info(
                f"[YOLO] 模型切换成功 ({load_time:.1f}s): {old_path} -> {model_path}, "
                f"类别数: {len(new_class_names)}"
            )
            if new_class_names:
                logger.info(f"[YOLO] 新模型检测类别: {', '.join(new_class_names[:10])}"
                           f"{'...' if len(new_class_names) > 10 else ''}")
            return True

        except ImportError:
            logger.error("[YOLO] 切换失败：ultralytics 库未安装")
            return False
        except FileNotFoundError:
            logger.error(f"[YOLO] 切换失败：模型文件不存在 {model_path}")
            return False
        except Exception as e:
            logger.error(f"[YOLO] 切换失败（保留原模型 {self.model_path}）: {e}")
            return False

    def detect(self, frame: np.ndarray) -> np.ndarray:
        """对单帧图像进行目标检测并绘制标注

        Args:
            frame: OpenCV BGR 格式的 numpy 图像数组

        Returns:
            标注后的 BGR 图像（直接在原图上绘制，同时返回引用）
        """
        if not self._loaded or self._model is None:
            return frame

        with self._lock:
            try:
                t0 = time.time()

                results = self._model.predict(
                    frame,
                    conf=self.conf_threshold,
                    iou=self.iou_threshold,
                    max_det=self.max_det,
                    imgsz=self.img_size,
                    device=self.device,
                    verbose=False,
                )

                inference_time = time.time() - t0
                self._total_inferences += 1
                self._total_inference_time += inference_time
                self._last_inference_time = inference_time

                # 解析检测结果
                detections = []
                if results and len(results) > 0:
                    result = results[0]
                    boxes = result.boxes
                    if boxes is not None and len(boxes) > 0:
                        for box in boxes:
                            cls_id = int(box.cls[0])
                            conf = float(box.conf[0])
                            xyxy = box.xyxy[0].tolist()
                            detections.append({
                                "class_id": cls_id,
                                "class_name": self._class_names[cls_id] if cls_id < len(self._class_names) else f"class_{cls_id}",
                                "confidence": round(conf, 3),
                                "bbox": [round(x, 1) for x in xyxy],
                            })

                self._last_detection_count = len(detections)
                self._last_detections = detections

                # 在帧上绘制标注
                annotated = self._draw_detections(frame, detections)

                if detections:
                    names = [d["class_name"] for d in detections]
                    logger.debug(
                        f"[YOLO] 检测到 {len(detections)} 个目标: {names} "
                        f"({inference_time*1000:.0f}ms)"
                    )

                return annotated

            except Exception as e:
                logger.error(f"[YOLO] 推理失败: {e}")
                return frame

    def _draw_detections(self, frame: np.ndarray, detections: List[Dict]) -> np.ndarray:
        """在帧上绘制检测结果（边界框 + 标签 + 置信度）

        Args:
            frame: 原始 BGR 图像
            detections: 检测结果列表

        Returns:
            标注后的图像
        """
        import cv2

        # 颜色表（BGR格式，每个类别固定颜色）
        colors = [
            (0, 255, 0),    # 绿色
            (255, 0, 0),    # 蓝色
            (0, 0, 255),    # 红色
            (255, 255, 0),  # 青色
            (255, 0, 255),  # 品红
            (0, 255, 255),  # 黄色
            (128, 0, 128),  # 紫色
            (128, 128, 0),  # 橄榄色
            (0, 128, 128),  # 深青色
            (128, 0, 0),    # 深蓝
        ]

        for det in detections:
            cls_id = det["class_id"]
            name = det["class_name"]
            conf = det["confidence"]
            x1, y1, x2, y2 = [int(v) for v in det["bbox"]]

            color = colors[cls_id % len(colors)]

            # 绘制边界框
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

            # 绘制标签
            label = f"{name} {conf:.2f}"
            (label_w, label_h), baseline = cv2.getTextSize(
                label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1
            )
            # 标签背景
            cv2.rectangle(
                frame,
                (x1, y1 - label_h - 8),
                (x1 + label_w + 4, y1),
                color,
                -1,
            )
            # 标签文字（白色）
            cv2.putText(
                frame,
                label,
                (x1 + 2, y1 - 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (255, 255, 255),
                1,
                cv2.LINE_AA,
            )

        # 左上角显示推理时间
        if self._last_inference_time > 0:
            fps_text = f"YOLO {self._last_inference_time*1000:.0f}ms"
            cv2.putText(
                frame,
                fps_text,
                (8, 20),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 255, 0),
                1,
                cv2.LINE_AA,
            )

        return frame

    def get_detections(self) -> List[Dict[str, Any]]:
        """获取最后一次检测结果

        Returns:
            检测结果列表，每项包含 class_id, class_name, confidence, bbox
        """
        return self._last_detections

    def get_status(self) -> Dict[str, Any]:
        """获取检测器状态

        Returns:
            状态字典
        """
        avg_time = (
            self._total_inference_time / self._total_inferences
            if self._total_inferences > 0
            else 0
        )
        return {
            "loaded": self._loaded,
            "model_path": self.model_path,
            "class_count": len(self._class_names),
            "class_names": self._class_names,
            "conf_threshold": self.conf_threshold,
            "img_size": self.img_size,
            "device": self.device,
            "total_inferences": self._total_inferences,
            "avg_inference_time_ms": round(avg_time * 1000, 1),
            "last_inference_time_ms": round(self._last_inference_time * 1000, 1),
            "last_detection_count": self._last_detection_count,
            "switch_count": self._switch_count,
            "last_switch_at": (
                time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(self._last_switch_time))
                if self._last_switch_time else None
            ),
        }

    def unload(self):
        """释放模型资源"""
        self._loaded = False
        self._model = None
        logger.info("[YOLO] 模型已释放")