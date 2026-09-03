#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""摄像头追踪模块 - 支持 YOLO 目标检测 + 颜色追踪 + Picamera2 + 云台控制"""

import cv2
import numpy as np
import threading
import time
from typing import Dict, Optional, Tuple, Callable
from drivers.actuators.servo import PanTiltController
import logging

logger = logging.getLogger(__name__)


class CameraTracker:
    """摄像头追踪器 - 集成 YOLO 目标检测和颜色追踪"""

    def __init__(self, config: Dict = None):
        """
        Args:
            config: 配置参数
        """
        self.config = config or {}
        
        # 摄像头配置
        self._camera_resolution = self.config.get("resolution", (320, 240))
        self._camera_format = self.config.get("format", "RGB888")
        
        # HSV阈值配置
        self._hue_low = self.config.get("hue_low", 96)
        self._hue_up = self.config.get("hue_up", 120)
        self._hue2_low = self.config.get("hue2_low", 50)
        self._hue2_up = self.config.get("hue2_up", 0)
        self._sat_low = self.config.get("sat_low", 157)
        self._sat_high = self.config.get("sat_high", 255)
        self._val_low = self.config.get("val_low", 100)
        self._val_high = self.config.get("val_high", 255)
        
        # 追踪参数
        self._min_area = self.config.get("min_area", 50)
        self._dead_zone = self.config.get("dead_zone", 15)  # 死区（像素）
        self._gain = self.config.get("gain", 75)  # 调节系数
        # 方向反转配置（根据舵机安装方向调整）
        self._pan_inverted = self.config.get("pan_inverted", False)
        self._tilt_inverted = self.config.get("tilt_inverted", False)
        
        # 云台控制
        self._pan_tilt = None
        self._enable_tracking = self.config.get("enable_tracking", True)
        
        # 状态
        self._picamera = None
        self._is_running = False
        self._track_thread = None
        self._lock = threading.Lock()
        
        # 追踪结果回调
        self._on_track_callback = None
        
        # 当前追踪状态
        self._last_detection = None

        # YOLO 检测器（可选，通过 set_yolo_detector() 注入）
        self._yolo_detector = None

    def set_pan_tilt(self, pan_tilt: PanTiltController):
        """设置云台控制器"""
        self._pan_tilt = pan_tilt
        logger.info("云台控制器已设置")

    def set_yolo_detector(self, detector):
        """设置 YOLO 检测器（用于视频流和上传帧的标注）

        Args:
            detector: YOLODetector 实例
        """
        self._yolo_detector = detector
        if detector is not None:
            logger.info("YOLO 检测器已绑定到摄像头")
        else:
            logger.info("YOLO 检测器已解除绑定")

    def set_track_callback(self, callback: Callable):
        """设置追踪结果回调函数"""
        self._on_track_callback = callback

    def initialize(self) -> bool:
        """初始化摄像头"""
        try:
            from picamera2 import Picamera2
            import libcamera
            
            self._picamera = Picamera2()
            width, height = self._camera_resolution
            
            config = self._picamera.create_preview_configuration(
                main={"format": self._camera_format, "size": (width, height)},
                raw={"format": "SRGGB12", "size": (1920, 1080)}
            )
            # 画面翻转
            config["transform"] = libcamera.Transform(
                hflip=self.config.get("hflip", 0),
                vflip=self.config.get("vflip", 1)
            )
            self._picamera.configure(config)
            self._picamera.start()
            
            logger.info(f"摄像头初始化成功: {width}x{height}")
            return True
            
        except ImportError:
            logger.error("picamera2库未安装")
            return False
        except Exception as e:
            logger.error(f"摄像头初始化失败: {e}")
            return False

    def start_tracking(self):
        """启动追踪"""
        if self._is_running:
            logger.warning("追踪已在运行")
            return
            
        self._is_running = True
        self._track_thread = threading.Thread(target=self._tracking_loop, daemon=True)
        self._track_thread.start()
        logger.info("颜色追踪已启动")

    def stop_tracking(self):
        """停止追踪（等待追踪线程释放摄像头锁后返回）
        
        设置 _is_running = False 标志位后，等待追踪线程释放 picam2 锁，
        确保当前帧捕获完成后才返回。这样视频流线程可以立即无竞争地访问摄像头。
        
        使用锁同步替代 join() 的优势：
        1. join() 会阻塞命令处理线程长达 3 秒（等待帧处理完成），延迟 ACK 响应
        2. 锁同步仅等待当前 capture_array() 调用完成（通常 <100ms），延迟极低
        3. 锁同步确保追踪线程不再持有 picam2，避免与视频流线程的缓冲区竞争
        """
        if not self._is_running:
            return
            
        self._is_running = False
        logger.info("颜色追踪正在停止...")
        
        # 等待追踪线程释放 picam2 锁，确保当前帧捕获完成
        # 追踪线程在 capture_array() 返回后会释放锁，然后检查 _is_running 并退出
        with self._lock:
            pass  # 仅等待锁释放，不执行任何操作
        
        logger.info("颜色追踪已停止")

    def _tracking_loop(self):
        """主追踪循环

        所有帧都通过 self.capture_frame() 获取，已统一转换为 OpenCV BGR 格式。
        因此后续 cv2.cvtColor(frame, cv2.COLOR_BGR2HSV) 是正确的。
        
        注意：每帧处理后调用 time.sleep(0) 主动让出 GIL，确保视频流线程
        有足够机会获取 picam2 帧，避免视频流卡顿或断开。
        """
        width, height = self._camera_resolution
        
        while self._is_running:
            try:
                if self._picamera is None:
                    time.sleep(0.1)
                    continue
                    
                # 通过统一入口捕获（内部已做 RGB→BGR 转换）
                frame = self.capture_frame()
                if frame is None:
                    # 快速退出：如果 stop_tracking() 已调用，立即退出
                    if not self._is_running:
                        break
                    continue
                
                # 快速退出：捕获帧后立即检查退出标志
                if not self._is_running:
                    break
                    
                # 转换到HSV
                hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
                
                # 颜色阈值
                lower1 = np.array([self._hue_low, self._sat_low, self._val_low])
                upper1 = np.array([self._hue_up, self._sat_high, self._val_high])
                lower2 = np.array([self._hue2_low, self._sat_low, self._val_low])
                upper2 = np.array([self._hue2_up, self._sat_high, self._val_high])
                
                # 创建掩码
                mask1 = cv2.inRange(hsv, lower1, upper1)
                mask2 = cv2.inRange(hsv, lower2, upper2)
                mask_all = cv2.add(mask1, mask2)
                
                # 查找轮廓
                contours, _ = cv2.findContours(
                    mask_all, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
                )
                contours = sorted(contours, key=lambda x: cv2.contourArea(x), reverse=True)
                
                detection_found = False
                
                for cnt in contours:
                    area = cv2.contourArea(cnt)
                    if area < self._min_area:
                        continue
                        
                    # 获取边界框
                    (x, y, w, h) = cv2.boundingRect(cnt)
                    obj_x = x + w / 2
                    obj_y = y + h / 2
                    
                    # 计算中心点偏差
                    error_pan = obj_x - width / 2
                    error_tilt = obj_y - height / 2
                    
                    detection_result = {
                        "found": True,
                        "x": int(obj_x),
                        "y": int(obj_y),
                        "area": area,
                        "error_pan": error_pan,
                        "error_tilt": error_tilt
                    }
                    
                    # 云台控制
                    if self._enable_tracking and self._pan_tilt:
                        self._update_pan_tilt(error_pan, error_tilt)
                        
                    detection_found = True
                    self._last_detection = detection_result
                    
                    # 回调
                    if self._on_track_callback:
                        self._on_track_callback(detection_result)
                    break
                
                if not detection_found:
                    self._last_detection = {"found": False}
                
                # 主动让出 GIL，确保视频流线程有足够机会获取帧
                time.sleep(0)
                    
            except Exception as e:
                logger.error(f"追踪循环错误: {e}")
                time.sleep(0.1)

    def _update_pan_tilt(self, error_pan: float, error_tilt: float):
        """更新云台位置

        Args:
            error_pan: 水平偏差（像素，正值=目标在右侧）
            error_tilt: 俯仰偏差（像素，正值=目标在下方）
        """
        # 方向系数：inverted=True 时取反（适配反向安装的舵机或翻转的摄像头）
        pan_sign = -1 if self._pan_inverted else 1
        tilt_sign = -1 if self._tilt_inverted else 1

        if abs(error_pan) > self._dead_zone:
            pan_delta = pan_sign * error_pan / self._gain
        else:
            pan_delta = 0

        if abs(error_tilt) > self._dead_zone:
            tilt_delta = tilt_sign * error_tilt / self._gain
        else:
            tilt_delta = 0

        if pan_delta != 0 or tilt_delta != 0:
            self._pan_tilt.move(pan_delta, tilt_delta)

    def capture_frame(self) -> Optional[np.ndarray]:
        """捕获当前帧（线程安全，带重试机制）

        使用 self._lock 保护 picam2.capture_array() 调用，防止追踪线程和视频流
        线程同时访问 picamera2 实例导致 V4L2 缓冲区竞争，造成视频流卡顿/中断。

        Picamera2 配置的是 RGB888，经实测其输出与 OpenCV 约定直接兼容：
        cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)、cv2.imencode('.jpg', frame)
        都可以直接正确工作，无需额外做 RGB↔BGR 转换。

        当 picam2.capture_array() 失败时（如 V4L2 缓冲区暂时不可用），
        等待 50ms 后重试一次，提高帧获取成功率。

        Returns:
            与 OpenCV 直接兼容的图像帧或 None
        """
        try:
            if self._picamera:
                with self._lock:
                    try:
                        return self._picamera.capture_array()
                    except Exception as e:
                        # 第一次失败，等待 50ms 后重试（V4L2 缓冲区可能暂时不可用）
                        logger.debug(f"帧捕获失败（将重试）: {e}")
                        time.sleep(0.05)
                        try:
                            return self._picamera.capture_array()
                        except Exception as e2:
                            logger.debug(f"帧捕获重试仍失败: {e2}")
                            return None
        except Exception as e:
            logger.error(f"帧捕获失败: {e}")
        return None

    def get_jpeg_frame(self, quality: int = 75) -> Optional[bytes]:
        """获取JPEG格式的当前帧（优先使用 YOLO 标注帧）

        如果有 YOLO 检测器，先运行推理并绘制边界框，再编码为 JPEG。
        确保视频流和上传的帧都带有目标检测标注。

        Args:
            quality: JPEG质量 (1-100)
            
        Returns:
            JPEG字节流或None
        """
        try:
            frame = self.capture_frame()
            if frame is not None:
                # 如果配置了 YOLO 检测器，运行推理并标注
                if self._yolo_detector is not None:
                    frame = self._yolo_detector.detect(frame)
                return bytes(cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, quality])[1])
        except Exception as e:
            logger.error(f"JPEG编码失败: {e}")
        return None

    def get_jpeg_frame_raw(self, quality: int = 75) -> Optional[bytes]:
        """获取原始 JPEG 帧（不经过 YOLO 标注，用于颜色追踪等场景）

        Args:
            quality: JPEG质量 (1-100)
            
        Returns:
            JPEG字节流或None
        """
        try:
            frame = self.capture_frame()
            if frame is not None:
                return bytes(cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, quality])[1])
        except Exception as e:
            logger.error(f"JPEG编码失败: {e}")
        return None

    def get_last_detection(self) -> Dict:
        """获取最后一次追踪结果（包含颜色追踪和 YOLO 检测）"""
        result = self._last_detection or {"found": False}
        # 如果有 YOLO 检测器，附加 YOLO 检测结果
        if self._yolo_detector is not None:
            yolo_dets = self._yolo_detector.get_detections()
            if yolo_dets:
                result["yolo_detections"] = yolo_dets
                result["found"] = True  # YOLO 检测到目标时也标记为 found
        return result

    def set_hsv_thresholds(self, 
                           hue_low: int = None, hue_up: int = None,
                           hue2_low: int = None, hue2_up: int = None,
                           sat_low: int = None, sat_high: int = None,
                           val_low: int = None, val_high: int = None):
        """设置HSV阈值
        
        Args:
            hue_low: 色相下限
            hue_up: 色相上限
            hue2_low: 第二色相下限
            hue2_up: 第二色相上限
            sat_low: 饱和度下限
            sat_high: 饱和度上限
            val_low: 明度下限
            val_high: 明度上限
        """
        if hue_low is not None:
            self._hue_low = hue_low
        if hue_up is not None:
            self._hue_up = hue_up
        if hue2_low is not None:
            self._hue2_low = hue2_low
        if hue2_up is not None:
            self._hue2_up = hue2_up
        if sat_low is not None:
            self._sat_low = sat_low
        if sat_high is not None:
            self._sat_high = sat_high
        if val_low is not None:
            self._val_low = val_low
        if val_high is not None:
            self._val_high = val_high

    def set_tracking_enabled(self, enabled: bool):
        """启用/禁用自动追踪"""
        self._enable_tracking = enabled
        logger.info(f"自动追踪: {'启用' if enabled else '禁用'}")

    def cleanup(self):
        """释放资源"""
        self.stop_tracking()
        if self._picamera:
            try:
                self._picamera.stop()
            except:
                pass
            self._picamera = None
        cv2.destroyAllWindows()
        logger.info("摄像头资源已释放")

    def get_status(self) -> Dict:
        """获取状态"""
        status = {
            "initialized": self._picamera is not None,
            "is_running": self._is_running,
            "resolution": self._camera_resolution,
            "tracking_enabled": self._enable_tracking,
            "last_detection": self._last_detection,
        }
        if self._yolo_detector is not None:
            status["yolo"] = self._yolo_detector.get_status()
        return status
