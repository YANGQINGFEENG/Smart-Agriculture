#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""系统主控 - 整合所有模块，统一调度"""

import os
import sys
import time
import signal
import logging
import threading
from typing import Dict, Any, Optional, Callable, List
from datetime import datetime

# 确保项目根目录在 sys.path 中
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from core.config_manager import ConfigManager
from core.event_bus import EventBus, Event, EventTypes, event_bus
from core.logger import setup_logger
from services.upload_service import UploadService
from services.cache_service import CacheService
from services.heartbeat_service import HeartbeatService
from ota.manager import OTAManager
from scanner.device_scanner import DeviceScanner

logger = logging.getLogger(__name__)


class System:
    """系统主控 - 整合所有模块

    负责初始化、调度、协调各模块工作：
    - 配置管理（热加载）
    - 日志系统
    - 缓存服务
    - 上传服务（与服务器通信）
    - 心跳服务（设备状态上报）
    - OTA 升级（自动检查、备份、回滚）
    - 设备扫描（自动发现）
    - 传感器/执行器驱动
    - 数据采集与上传循环
    """

    VERSION = "2.0.0"

    def __init__(self, config_dir: str = None, enable_ui: bool = False):
        """初始化系统

        Args:
            config_dir: 配置目录路径
            enable_ui: 是否启动触摸屏 UI（已废弃，使用终端界面）
        """
        self.project_root = PROJECT_ROOT
        self.enable_ui = enable_ui  # 保留参数以兼容旧代码，实际不再使用

        # 1. 初始化配置管理器
        self.config = ConfigManager(config_dir)

        # 2. 初始化日志系统
        log_level = self.config.get("system.log_level", "INFO")
        log_file = self.config.get("system.log_file", "logs/system.log")
        setup_logger("smart_farm", log_file, log_level)
        # 同时配置根日志
        root_logger = logging.getLogger()
        root_logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

        logger.info("=" * 60)
        logger.info(f"智慧农业硬件系统 v{self.VERSION} 启动中...")
        logger.info(f"项目路径: {self.project_root}")
        logger.info(f"配置目录: {self.config.config_dir}")
        logger.info("=" * 60)

        # 3. 初始化事件总线
        self.event_bus = event_bus

        # 4. 初始化缓存服务
        cache_path = self.config.get("cache.db_path", "data/cache.db")
        self.cache = CacheService(cache_path)

        # 5. 初始化上传服务
        self.upload = UploadService(self.config, self.cache)

        # 6. 初始化心跳服务
        self.heartbeat = HeartbeatService(self.config, self.upload)

        # 7. 初始化 OTA 管理器
        self.ota_manager = OTAManager(self.config, self.project_root)
        # 设置重启回调
        self.ota_manager.set_restart_callback(self._restart_service)

        # 8. 初始化设备扫描器
        scanner_config = self.config.get("scanner", {})
        self.scanner = DeviceScanner(scanner_config)

        # 9. 设备注册表
        self.sensors: Dict[str, Any] = {}
        self.actuators: Dict[str, Any] = {}

        # 10. 设备 ID 映射（传感器ID -> 服务器节点ID/类型）
        self.device_mapping = self.config.get("device_mapping", {}) or {}

        # 11. 运行时状态
        self.running = False
        self._threads: List[threading.Thread] = []
        self._stop_event = threading.Event()
        self._main_thread: Optional[threading.Thread] = None

        # 12. UI 引用（延迟初始化）
        self.ui = None
        self._ui_thread: Optional[threading.Thread] = None

        # 13. WebSocket 状态
        self._websocket_connected = False
        self._websocket_service = None
        
        # 14. 导入 WebSocket 服务（延迟导入避免循环依赖）
        try:
            from services.websocket_service import WebSocketService
            self._websocket_class = WebSocketService
        except ImportError:
            logger.warning("WebSocketService import failed")
            self._websocket_class = None

        # 14. 命令去重（已执行的 command_id，缓存5分钟）
        self._executed_commands = set()
        self._command_lock = threading.Lock()
        
        # 15. 命令队列和线程池（异步执行命令）
        self._command_queue = []
        self._command_queue_lock = threading.Lock()
        self._command_executor = None
        self._command_executor_running = False

        # 16. 设备初始化状态追踪（支持中途加入的设备）
        self._failed_sensors: Dict[str, float] = {}  # sensor_id -> 上次重试时间
        self._failed_actuators: Dict[str, float] = {}  # actuator_id -> 上次重试时间
        self._retry_interval = 10  # 重试间隔（秒）

        # 17. 监听配置变化
        self.config.on_change(self._on_config_changed)

        # 18. 摄像头和云台控制器（延迟初始化）
        self._camera = None
        self._pan_tilt = None
        self._camera_initialized = False
        # 摄像头运行时状态（受服务端命令影响，需在上报数据中反映）
        self._camera_power = False           # 摄像头开关状态（on=True/off=False）
        self._camera_current_color = "blue"  # 当前追踪颜色名称（运行时可被 color 命令切换）

        # 19. 视频流服务和帧上传
        self._video_stream_service = None  # MJPEG 实时流服务
        self._frame_upload_thread = None   # 帧上传线程
        self._last_frame_upload_time = 0   # 上次帧上传时间戳

        # 20. 手势控制（MPU6050 加速度→云台控制）
        self._mpu6050 = None                    # MPU6050 驱动实例
        self._gesture_control_enabled = False   # 手势控制运行标志
        self._gesture_control_thread = None     # 手势控制线程
        self._urgent_upload_needed = False      # 紧急上传标志（手势自停等场景触发）
        self._pan_tilt_lock = threading.Lock()  # I2C 总线锁（保护 PCA9685 写入 + MPU6050 读取）
        # 舵机输出平滑状态（低通滤波缓存）
        self._smooth_pan: Optional[float] = None
        self._smooth_tilt: Optional[float] = None

        # 20a. 智能养护 Agent（环境自动控制 + YOLO 病虫害诊疗）
        self.agent = None

        # 20b. YOLO 模型管理器（云端下发切换识别模型）
        self.model_manager = None

        # 21. 注册信号处理
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

        logger.info("System initialized")

    def _on_config_changed(self, changed_files: List[str]):
        """配置变更回调 - 通知各模块重新加载"""
        logger.info(f"Config changed: {changed_files}, notifying modules")
        # 发布事件
        self.event_bus.publish(Event(
            event_type=EventTypes.SYSTEM_START,
            source="system",
            data={"changed_files": changed_files}
        ))

    def load_devices(self):
        """加载所有已配置的传感器和执行器"""
        self._load_sensors()
        self._load_actuators()
        logger.info(f"Loaded {len(self.sensors)} sensors, {len(self.actuators)} actuators")

    def _load_sensors(self):
        """加载传感器驱动"""
        sensor_map = self._get_sensor_driver_map()

        for sensor_conf in self.config.get_sensors():
            if not sensor_conf.get("enabled", True):
                continue
            sensor_type = sensor_conf.get("type")
            sensor_class = sensor_map.get(sensor_type)
            if not sensor_class:
                logger.warning(f"Unknown sensor type: {sensor_type}, skip")
                continue

            try:
                sensor = sensor_class(
                    sensor_id=sensor_conf["id"],
                    name=sensor_conf.get("name", sensor_conf["id"]),
                    config=sensor_conf.get("config", {}),
                    **(sensor_conf.get("config") or {}),
                )
                self.register_sensor(sensor)
            except Exception as e:
                logger.error(f"Load sensor {sensor_conf.get('id')} failed: {e}")

    def _load_actuators(self):
        """加载执行器驱动"""
        actuator_map = self._get_actuator_driver_map()

        for actuator_conf in self.config.get_actuators():
            if not actuator_conf.get("enabled", True):
                continue
            actuator_type = actuator_conf.get("type")
            actuator_class = actuator_map.get(actuator_type)
            if not actuator_class:
                logger.warning(f"Unknown actuator type: {actuator_type}, skip")
                continue

            try:
                actuator = actuator_class(
                    actuator_id=actuator_conf["id"],
                    name=actuator_conf.get("name", actuator_conf["id"]),
                    config=actuator_conf.get("config", {}),
                    **(actuator_conf.get("config") or {}),
                )
                self.register_actuator(actuator)
            except Exception as e:
                logger.error(f"Load actuator {actuator_conf.get('id')} failed: {e}")

    def _get_sensor_driver_map(self) -> Dict[str, type]:
        """获取传感器类型->驱动类映射"""
        from drivers.sensors.dht import DHTSensor
        from drivers.sensors.bmp280 import BMP280Sensor
        from drivers.sensors.vibration import VibrationSensor
        from drivers.sensors.light import LightSensor

        return {
            "dht": DHTSensor,
            "bmp280": BMP280Sensor,
            "vibration": VibrationSensor,
            "light": LightSensor,
        }

    def _get_actuator_driver_map(self) -> Dict[str, type]:
        """获取执行器类型->驱动类映射"""
        from drivers.actuators.relay import RelayActuator
        from drivers.actuators.laser import LaserActuator
        from drivers.actuators.rgb_led import RGBLEDActuator
        from drivers.actuators.fan import FanActuator
        from drivers.actuators.buzzer import BuzzerActuator
        from drivers.actuators.servo import ServoActuator

        return {
            "relay": RelayActuator,
            "laser": LaserActuator,
            "rgb_led": RGBLEDActuator,
            "fan": FanActuator,
            "buzzer": BuzzerActuator,
            "servo": ServoActuator,
        }

    def register_sensor(self, sensor):
        """注册传感器"""
        self.sensors[sensor.sensor_id] = sensor
        logger.info(f"Sensor registered: {sensor.sensor_id}")

    def register_actuator(self, actuator):
        """注册执行器"""
        self.actuators[actuator.actuator_id] = actuator
        logger.info(f"Actuator registered: {actuator.actuator_id}")

    def initialize_devices(self):
        """初始化所有设备（GPIO/I2C 等）
        
        支持设备中途加入：
        - 初始化失败的设备会被记录到 _failed_sensors/_failed_actuators
        - 后续的数据采集循环会定期重试初始化失败的设备
        """
        # DHT 类传感器最后初始化（避免 GPIO 冲突）
        dht_sensors = []
        for sensor_id, sensor in self.sensors.items():
            if sensor.sensor_type == "dht":
                dht_sensors.append(sensor)
                continue
            try:
                result = sensor.initialize()
                if not result:
                    logger.warning(f"Sensor {sensor_id} initialization failed")
                    self._failed_sensors[sensor_id] = time.time()
            except Exception as e:
                logger.error(f"Sensor {sensor_id} init error: {e}")
                self._failed_sensors[sensor_id] = time.time()

        # 初始化执行器
        for actuator_id, actuator in self.actuators.items():
            try:
                result = actuator.initialize()
                if not result:
                    logger.warning(f"Actuator {actuator_id} initialization failed")
                    self._failed_actuators[actuator_id] = time.time()
            except Exception as e:
                logger.error(f"Actuator {actuator_id} init error: {e}")
                self._failed_actuators[actuator_id] = time.time()

        # 最后初始化 DHT（等待其他 GPIO 稳定）
        if dht_sensors:
            time.sleep(2)
            for sensor in dht_sensors:
                try:
                    result = sensor.initialize()
                    if not result:
                        logger.warning(f"DHT {sensor.sensor_id} initialization failed")
                        self._failed_sensors[sensor.sensor_id] = time.time()
                except Exception as e:
                    logger.error(f"DHT {sensor.sensor_id} init error: {e}")
                    self._failed_sensors[sensor.sensor_id] = time.time()

        # 打印初始化结果统计
        total_sensors = len(self.sensors)
        total_actuators = len(self.actuators)
        failed_sensors = len(self._failed_sensors)
        failed_actuators = len(self._failed_actuators)
        logger.info(f"设备初始化完成: 传感器 {total_sensors - failed_sensors}/{total_sensors} 成功, 执行器 {total_actuators - failed_actuators}/{total_actuators} 成功")
        
        if self._failed_sensors or self._failed_actuators:
            logger.info(f"将每 {self._retry_interval} 秒重试初始化失败的设备...")

    def _init_camera_and_tracking(self):
        """初始化摄像头和云台追踪系统

        按配置顺序初始化：
        1. 云台控制器（如果 servo.enabled=true）
        2. 摄像头追踪器（如果 camera.enabled=true），注入云台控制器
        3. 视频流服务（如果 video_stream.enabled=true），提供 MJPEG 实时流
        """
        camera_config = self.config.get("camera", {})
        servo_config = self.config.get("servo", {})
        video_stream_config = self.config.get("video_stream", {})

        # 检查是否启用
        if not camera_config.get("enabled", False) and not servo_config.get("enabled", False):
            logger.info("摄像头和云台均未启用，跳过初始化")
            return

        try:
            from drivers.camera_tracker import CameraTracker
            from drivers.actuators.servo import PanTiltController

            # 初始化云台控制器
            if servo_config.get("enabled", False):
                self._pan_tilt = PanTiltController(
                    pan_channel=servo_config.get("pan_channel", 0),
                    tilt_channel=servo_config.get("tilt_channel", 1),
                    config=servo_config
                )
                if self._pan_tilt.initialize():
                    logger.info("云台控制器初始化成功")
                else:
                    logger.warning("云台控制器初始化失败")
                    self._pan_tilt = None

            # 初始化摄像头追踪器
                if camera_config.get("enabled", False):
                    self._camera = CameraTracker(config=camera_config)

                    # 设置云台控制器（如果可用）
                    if self._pan_tilt:
                        self._camera.set_pan_tilt(self._pan_tilt)

                    # 设置追踪回调
                    self._camera.set_track_callback(self._on_camera_detection)

                    # 初始化摄像头
                    if self._camera.initialize():
                        self._camera_initialized = True

                        # 初始化 YOLO 检测器（如果启用）
                        yolo_config = self.config.get("yolo", {})
                        if yolo_config.get("enabled", False):
                            self._init_yolo_detector(yolo_config)

                        # 自动启动追踪（如果启用）
                        tracking_config = camera_config.get("tracking", {})
                        if tracking_config.get("enabled", False):
                            self._camera.set_tracking_enabled(True)
                            self._camera.start_tracking()
                            self._camera_power = True  # 标记摄像头已开启
                            logger.info("摄像头追踪已启动")

                        logger.info("摄像头初始化成功")

                        # 启动视频流服务（如果启用）
                        if video_stream_config.get("enabled", False):
                            self._start_video_stream_service(video_stream_config)
                else:
                    logger.warning("摄像头初始化失败")
                    self._camera = None

        except ImportError as e:
            logger.warning(f"摄像头/云台依赖库缺失: {e}")
        except Exception as e:
            logger.error(f"摄像头/云台初始化异常: {e}")

        # ---- MPU6050 手势控制初始化（依赖云台已就绪） ----
        self._init_gesture_control()

    def _init_gesture_control(self):
        """初始化 MPU6050 手势控制模块

        流程：
        1. 读取 gesture_control 配置
        2. 初始化 MPU6050 驱动（I2C 地址 0x68）
        3. 启动手势控制后台线程（读取→死区→低通滤波→映射→set_position）
        """
        camera_config = self.config.get("camera", {})
        gc_config = camera_config.get("gesture_control", {})

        if not gc_config.get("enabled", False):
            logger.info("[手势控制] 未启用（gesture_control.enabled=false）")
            return

        if not self._pan_tilt:
            logger.warning("[手势控制] 云台控制器未初始化，无法启动手势控制")
            return

        try:
            from drivers.sensors.mpu6050 import MPU6050Sensor

            mpu_address = gc_config.get("mpu_address", 0x68)
            mpu_address = int(mpu_address, 16) if isinstance(mpu_address, str) else mpu_address

            self._mpu6050 = MPU6050Sensor(
                sensor_id="mpu6050",
                name="六轴姿态传感器",
                address=mpu_address,
                accel_range=gc_config.get("accel_range", 0),
                gyro_range=gc_config.get("gyro_range", 0),
                use_complementary=gc_config.get("use_complementary", True),
                alpha=gc_config.get("complementary_alpha", 0.96),
                config={"i2c_bus": self.config.get("scanner.i2c.bus_number", 1)},
            )

            # 初始化 MPU6050（I2C 可能失败，不影响主流程）
            with self._pan_tilt_lock:
                init_ok = self._mpu6050.initialize()

            if init_ok:
                # 启动手势控制线程
                self._gesture_control_enabled = True
                self._gesture_control_thread = threading.Thread(
                    target=self._gesture_control_loop,
                    args=(gc_config,),
                    name="GestureControl",
                    daemon=True,
                )
                self._gesture_control_thread.start()
                self._threads.append(self._gesture_control_thread)
                logger.info(
                    f"[手势控制] 已启动: MPU6050@0x{mpu_address:02X}, "
                    f"interval={gc_config.get('update_interval', 0.05)}s, "
                    f"sensitivity={gc_config.get('sensitivity', 1.2)}, "
                    f"deadzone={gc_config.get('deadzone', 3.0)}°"
                )
            else:
                logger.warning("[手势控制] MPU6050 初始化失败，手势控制不可用")
                self._mpu6050 = None

        except ImportError as e:
            logger.warning(f"[手势控制] MPU6050 驱动缺失: {e}")
        except Exception as e:
            logger.error(f"[手势控制] 初始化异常: {e}")
            self._mpu6050 = None
            self._gesture_control_enabled = False

    def _mpu_angle_to_servo(self, mpu_angle: float, sensitivity: float,
                            deadzone: float, reverse: bool = False) -> Optional[float]:
        """MPU6050 姿态角 → 舵机角度映射

        映射公式：
            servo_angle = 90 + mpu_angle * sensitivity

        其中 mpu_angle ∈ [-90°, +90°]，映射到 servo_angle ∈ [90-sensitivity*90, 90+sensitivity*90]。
        当 sensitivity=1.0 时，MPU ±90° 对应舵机 0°~180°（线性全幅）。
        当 sensitivity<1.0 时，缩小映射范围（更温和）。
        当 sensitivity>1.0 时，放大映射范围（更灵敏），会被 clamp 到 [0,180]。

        Args:
            mpu_angle: MPU6050 姿态角（°），范围 [-90°, +90°]
            sensitivity: 灵敏度系数（<1 缩小，>1 放大）
            deadzone: 死区阈值（°），绝对值小于此值的 mpu_angle 视为 0
            reverse: 是否反转方向

        Returns:
            舵机目标角度（°，范围 [0,180]）；死区内返回 None（表示不移动）
        """
        # 1. 死区判断
        if abs(mpu_angle) < deadzone:
            return None

        # 2. 可选反转
        if reverse:
            mpu_angle = -mpu_angle

        # 3. 线性映射到舵机角度
        target = 90.0 + mpu_angle * sensitivity

        # 4. 限幅
        return max(0.0, min(180.0, target))

    def _gesture_control_loop(self, gc_config: Dict):
        """手势控制后台线程主循环

        每周期执行：
            1. 读 MPU6050 姿态角（pitch/roll）
            2. 分别做 deadzone + 角度→舵机映射
            3. 对舵机目标角度做低通滤波平滑输出
            4. 加锁调用 pan_tilt.set_position(pan, tilt)

        坐标系约定：
            - MPU pitch（绕 X 轴倾斜）→ Tilt 舵机（俯仰）
            - MPU roll （绕 Y 轴倾斜）→ Pan  舵机（水平）

        Args:
            gc_config: gesture_control 配置字典
        """
        deadzone = gc_config.get("deadzone", 3.0)
        sensitivity = gc_config.get("sensitivity", 1.2)
        update_interval = gc_config.get("update_interval", 0.05)
        smooth_alpha = gc_config.get("smooth_alpha", 0.3)
        reverse_pan = gc_config.get("reverse_pan", False)
        reverse_tilt = gc_config.get("reverse_tilt", False)

        # 低通滤波状态初始化
        self._smooth_pan = None
        self._smooth_tilt = None

        consecutive_errors = 0
        MAX_CONSECUTIVE_ERRORS = 10

        logger.info("[手势控制] 线程启动，开始读取 MPU6050 姿态数据")

        while self._gesture_control_enabled and not self._stop_event.is_set():
            try:
                # 1. 读取姿态角（加锁保护 I2C 总线）
                with self._pan_tilt_lock:
                    angles = self._mpu6050.read_angles()

                if angles is None:
                    consecutive_errors += 1
                    if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
                        logger.warning(
                            f"[手势控制] 连续 {MAX_CONSECUTIVE_ERRORS} 次读取失败，"
                            f"暂停手势控制"
                        )
                        self._gesture_control_enabled = False
                        # 立即触发上行数据上报，通知服务端手势控制已自动关闭
                        self._urgent_upload_needed = True
                    time.sleep(update_interval)
                    continue

                consecutive_errors = 0
                mpu_pitch, mpu_roll = angles

                # 2. pitch → Tilt 舵机，roll → Pan 舵机（分别映射）
                target_tilt = self._mpu_angle_to_servo(
                    mpu_pitch, sensitivity, deadzone, reverse_tilt
                )
                target_pan = self._mpu_angle_to_servo(
                    mpu_roll, sensitivity, deadzone, reverse_pan
                )

                # 3. 低通滤波（只对有变化的轴滤波，死区内保持上次值）
                now_pan, now_tilt = self._pan_tilt.get_position() if self._pan_tilt else (90.0, 90.0)

                if target_pan is not None:
                    if self._smooth_pan is None:
                        self._smooth_pan = now_pan
                    self._smooth_pan += smooth_alpha * (target_pan - self._smooth_pan)
                    out_pan = self._smooth_pan
                else:
                    # 死区内，输出保持当前位置（不移动）
                    out_pan = now_pan

                if target_tilt is not None:
                    if self._smooth_tilt is None:
                        self._smooth_tilt = now_tilt
                    self._smooth_tilt += smooth_alpha * (target_tilt - self._smooth_tilt)
                    out_tilt = self._smooth_tilt
                else:
                    out_tilt = now_tilt

                # 4. 加锁写入舵机（与服务端命令路径互斥）
                with self._pan_tilt_lock:
                    self._pan_tilt.set_position(out_pan, out_tilt)

                time.sleep(update_interval)

            except threading.ThreadError:
                break
            except Exception as e:
                consecutive_errors += 1
                if consecutive_errors % 10 == 0:
                    logger.warning(f"[手势控制] 线程异常: {e}")
                time.sleep(update_interval)

        logger.info("[手势控制] 线程退出")

    def _start_video_stream_service(self, video_stream_config: Dict):
        """启动 MJPEG 视频流服务

        Args:
            video_stream_config: video_stream 配置段
        """
        try:
            from services.video_stream_service import VideoStreamService

            port = video_stream_config.get("port", 8081)
            host = video_stream_config.get("host", "0.0.0.0")
            stream_fps = video_stream_config.get("stream_fps", 15)
            jpeg_quality = video_stream_config.get("jpeg_quality", 70)

            # 帧提供者：调用摄像头的 get_jpeg_frame 方法
            def frame_provider():
                if self._camera:
                    return self._camera.get_jpeg_frame(quality=jpeg_quality)
                return None

            self._video_stream_service = VideoStreamService(
                port=port,
                host=host,
                frame_provider=frame_provider,
                stream_fps=stream_fps,
                jpeg_quality=jpeg_quality,
            )
            self._video_stream_service.start()

            # 等待服务启动后获取实际 URL
            status = self._video_stream_service.get_status()
            logger.info(f"[视频流] MJPEG 流地址: {status['stream_url']}")
            logger.info(f"[视频流] 快照地址: {status['snapshot_url']}")

        except ImportError as e:
            logger.warning(f"[视频流] 视频流服务模块缺失: {e}")
        except Exception as e:
            logger.error(f"[视频流] 视频流服务启动异常: {e}")
            self._video_stream_service = None

    def _init_yolo_detector(self, yolo_config: Dict):
        """初始化 YOLO 目标检测器并绑定到摄像头

        加载训练好的 .pt 模型，将检测器注入 CameraTracker，
        使 get_jpeg_frame() 自动在每一帧上运行 YOLO 推理并绘制边界框。

        Args:
            yolo_config: YOLO 配置字典
        """
        try:
            from drivers.yolo_detector import YOLODetector

            model_path = yolo_config.get("model_path", "models/last.pt")
            conf_threshold = yolo_config.get("conf_threshold", 0.5)
            iou_threshold = yolo_config.get("iou_threshold", 0.45)
            max_det = yolo_config.get("max_det", 20)
            img_size = yolo_config.get("img_size", 320)
            device = yolo_config.get("device", "cpu")

            logger.info(f"[YOLO] 初始化检测器: model={model_path}, conf={conf_threshold}, img_size={img_size}")

            self._yolo_detector = YOLODetector(
                model_path=model_path,
                conf_threshold=conf_threshold,
                iou_threshold=iou_threshold,
                max_det=max_det,
                img_size=img_size,
                device=device,
            )

            if self._yolo_detector.load():
                # 绑定到摄像头，使视频流和上传帧自动标注
                if self._camera:
                    self._camera.set_yolo_detector(self._yolo_detector)
                logger.info("[YOLO] 检测器已初始化并绑定到摄像头，视频流将显示检测标注")

                # 初始化模型管理器（支持云端切换识别模型）
                self._init_model_manager()
            else:
                logger.warning("[YOLO] 检测器加载失败，视频流将使用原始帧")
                self._yolo_detector = None

        except ImportError as e:
            logger.warning(f"[YOLO] ultralytics 库未安装: {e}")
            self._yolo_detector = None
        except Exception as e:
            logger.error(f"[YOLO] 初始化异常: {e}")
            self._yolo_detector = None

    def _init_model_manager(self):
        """初始化 YOLO 模型管理器

        职责：
        - 后台确保官方通用模型（yolov8n.pt 等）已下载到本地 models/
        - 恢复上次云端选择的模型（重启后保持）
        - 向云端上报当前模型状态，供网页端展示（并周期性补报实时指标）
        """
        try:
            from services.model_manager import ModelManager

            self.model_manager = ModelManager(
                self.config,
                detector=self._yolo_detector,
                project_root=self.project_root,
            )
            logger.info(
                f"[模型管理] 已初始化: 模型目录={self.model_manager.models_dir}, "
                f"官方模型={self.model_manager.official_models}"
            )

            # 下载/恢复/上报放到后台线程，避免阻塞启动（官方模型下载可能较慢）
            def prepare():
                try:
                    ready = self.model_manager.ensure_official_models()
                    logger.info(f"[模型管理] 官方通用模型就位: {ready or '无'}")
                    # 云端期望模型优先；云端未指定时恢复本地上次选择
                    if not self.model_manager.reconcile_with_cloud():
                        self.model_manager.restore_last_model()
                    self.model_manager.report_status()
                    # 周期补报：让网页端的推理次数/耗时等指标持续刷新
                    self.model_manager.start_periodic_report()
                except Exception as e:
                    logger.error(f"[模型管理] 后台准备异常: {e}")

            threading.Thread(target=prepare, daemon=True, name="model-prepare").start()

        except ImportError as e:
            logger.warning(f"[模型管理] 模块缺失，跳过初始化: {e}")
            self.model_manager = None
        except Exception as e:
            logger.error(f"[模型管理] 初始化异常: {e}")
            self.model_manager = None

    def _on_model_switch(self, data: Dict):
        """处理云端下发的识别模型切换指令

        Args:
            data: {"request_id", "filename", "file_url", "model_id"}

        Returns:
            (是否成功, 说明信息) —— 由 WebSocketService 回报给云端
        """
        filename = data.get("filename") or ""
        if not self.model_manager:
            return False, "模型管理器未初始化"
        if not filename:
            return False, "指令缺少 filename"

        logger.info(f"[模型管理] 云端请求切换识别模型: {filename}")
        return self.model_manager.switch_to(
            filename,
            file_url=data.get("file_url"),
            request_id=data.get("request_id"),
        )

    def _on_camera_detection(self, detection_result: Dict):
        """摄像头追踪结果回调

        Args:
            detection_result: 追踪结果字典
        """
        if detection_result.get("found"):
            logger.debug(
                f"[摄像头] 检测到目标: x={detection_result['x']}, "
                f"y={detection_result['y']}, 面积={detection_result['area']:.0f}"
            )

    def _build_camera_node(self) -> Optional[Dict]:
        """构造摄像头设备节点数据

        摄像头作为"特殊执行器"上报（依据《硬件通信协议.md》2.6 节，
        节点ID形如 CAM-1-001，control_type 为 string）。
        节点数据包含：
        - 执行器字段：state, mode, control_value, control_type, control_range
        - 兼容字段：value, unit（部分前端按传感器读取）
        - feedback 字段：检测结果、云台角度、视频流地址等

        Returns:
            节点数据字典；摄像头未初始化时返回 None
        """
        if not self._camera:
            return None

        camera_mapping = self.device_mapping.get("camera", {})
        node_id = camera_mapping.get("node_id", "CAM-1-001")
        name = camera_mapping.get("name", "颜色追踪摄像头")
        location = camera_mapping.get("location", "")
        area = self.config.get("upload.area", "")

        # 获取追踪结果
        detection = self._camera.get_last_detection()
        status = self._camera.get_status()

        # 获取云台当前角度（get_position 返回 (pan, tilt) 元组）
        pan_angle = None
        tilt_angle = None
        if self._pan_tilt:
            try:
                pan_angle, tilt_angle = self._pan_tilt.get_position()
                pan_angle = round(pan_angle, 1)
                tilt_angle = round(tilt_angle, 1)
            except Exception:
                pass

        # 获取视频流地址
        stream_url = ""
        snapshot_url = ""
        if self._video_stream_service:
            vs_status = self._video_stream_service.get_status()
            stream_url = vs_status.get("stream_url", "")
            snapshot_url = vs_status.get("snapshot_url", "")

        # 获取可用颜色预设列表（供服务端展示可选项）
        camera_config = self.config.get("camera", {})
        tracking_config = camera_config.get("tracking", {})
        color_presets = tracking_config.get("color_presets", {})
        available_colors = list(color_presets.keys()) if color_presets else ["blue"]

        # 检测结果元数据（使用运行时状态，反映服务端命令的最新效果）
        feedback = {
            "power": self._camera_power,                  # 摄像头开关状态（on/off 命令控制）
            "found": detection.get("found", False),       # 是否检测到目标
            "resolution": list(status.get("resolution", (320, 240))),
            "tracking_enabled": status.get("tracking_enabled", False),  # 是否启用自动追踪
            "is_running": status.get("is_running", False), # 追踪线程是否运行
            "color_preset": self._camera_current_color,    # 当前追踪颜色（color 命令切换后的值）
            "available_colors": available_colors,          # 可用颜色预设列表
            "pan_angle": pan_angle,
            "tilt_angle": tilt_angle,
            "stream_url": stream_url,
            "snapshot_url": snapshot_url,
            # 陀螺仪/手势控制状态（gyro 命令运行时开关）
            "gyro_available": self._mpu6050 is not None and self._mpu6050._initialized,  # 硬件是否可用
            "gesture_control_enabled": self._gesture_control_enabled,  # 手势控制是否开启
        }

        # 如果检测到目标，添加详细位置信息
        if detection.get("found"):
            feedback.update({
                "target_x": detection.get("x", 0),
                "target_y": detection.get("y", 0),
                "target_area": round(detection.get("area", 0), 2),
                "error_pan": round(detection.get("error_pan", 0), 2),
                "error_tilt": round(detection.get("error_tilt", 0), 2),
            })

        # value 字段逻辑（兼容旧前端，按传感器读取时使用）：
        # - 摄像头关闭（power=False）→ value=0
        # - 摄像头开启且检测到目标 → value=1
        # - 摄像头开启但未检测到目标 → value=0
        if not self._camera_power:
            value = 0
        else:
            value = 1 if detection.get("found") else 0

        # state 字段：执行器格式要求，反映摄像头电源状态
        state = "on" if self._camera_power else "off"

        node = {
            # 基础字段
            "node_id": node_id,
            "name": name,
            "type": "camera",
            "location": location,
            "area": area,
            # 执行器格式字段（协议规定摄像头为特殊执行器，control_type=string）
            "state": state,
            "mode": "manual",
            "control_value": "",
            "control_type": "string",
            "control_range": {
                "min": 0,
                "max": 180,
                "step": 1,
                "default": 90,
            },
            # 兼容字段（部分前端按传感器格式读取）
            "value": value,
            "unit": "boolean",
            # feedback 字段：视频流地址、云台角度、检测结果等
            "feedback": feedback,
        }
        return node

    def start(self):
        """启动系统"""
        if self.running:
            logger.warning("System already running")
            return
        self.running = True
        self._stop_event.clear()

        logger.info("System starting...")

        # 发布系统启动事件
        self.event_bus.publish(Event(
            event_type=EventTypes.SYSTEM_START,
            source="system",
            data={"version": self.VERSION}
        ))

        # 加载并初始化设备
        self.load_devices()
        self.initialize_devices()

        # 初始化摄像头和云台（如果启用）
        self._init_camera_and_tracking()

        # 启动配置热加载监控
        self.config.start_watching(interval=5.0)

        # 启动心跳服务
        self.heartbeat.start(
            sensors_provider=lambda: self.sensors,
            actuators_provider=lambda: self.actuators,
        )

        # 启动 OTA 自动检查
        if self.config.get("ota.auto_check_enabled", False):
            self.ota_manager.start_auto_check()

        # 启动数据采集与上传线程
        data_thread = threading.Thread(target=self._data_loop, daemon=True, name="data-collector")
        data_thread.start()
        self._threads.append(data_thread)

        # 启动缓存重传线程
        cache_thread = threading.Thread(target=self._cache_retry_loop, daemon=True, name="cache-retry")
        cache_thread.start()
        self._threads.append(cache_thread)

        # 启动命令轮询线程（从服务器获取待执行的控制指令）
        command_thread = threading.Thread(target=self._command_poll_loop, daemon=True, name="command-poll")
        command_thread.start()
        self._threads.append(command_thread)

        # 启动命令异步执行器
        self._start_command_executor()

        # 启动 WebSocket 服务（实时接收服务器推送的命令）
        self._start_websocket_service()

        # 启动摄像头帧上传线程（独立于数据采集，按配置间隔上传 JPEG 帧）
        if self._camera and self._camera_initialized:
            frame_upload_config = self.config.get("frame_upload", {})
            if frame_upload_config.get("enabled", False):
                frame_thread = threading.Thread(
                    target=self._camera_frame_upload_loop,
                    daemon=True,
                    name="camera-frame-upload"
                )
                frame_thread.start()
                self._threads.append(frame_thread)
                logger.info(
                    f"[帧上传] 已启动，间隔 {frame_upload_config.get('interval', 30)} 秒"
                )

        # 启动智能养护 Agent（环境自动控制 + YOLO 病虫害诊疗）
        agent_config = self.config.get("agent", {})
        if agent_config.get("enabled", False):
            try:
                from agent.agent_service import AgentService

                self.agent = AgentService(self, agent_config)
                self.agent.start()
            except Exception as e:
                logger.error(f"Agent 服务启动失败: {e}")
                self.agent = None
        else:
            logger.info("Agent 服务未启用（agent.enabled=false）")

        # 启动 UI（如果启用）
        if self.enable_ui:
            self._start_ui()

        logger.info("System started successfully")

        # 主循环：当没有 UI 时，进入后台运行模式
        # 如果有终端界面（CLI），由调用方负责交互循环
        if not self.enable_ui:
            self._main_loop()

    def _main_loop(self):
        """主循环（命令行模式）"""
        logger.info("Entering main loop (Ctrl+C to stop)")
        try:
            while self.running:
                self._stop_event.wait(timeout=1)
        except KeyboardInterrupt:
            logger.info("KeyboardInterrupt received")
        finally:
            self.stop()

    def _data_loop(self):
        """数据采集与上传循环
        
        支持设备热插拔：
        - 每次采集前检查是否有失败的设备需要重试初始化
        - 设备初始化成功后自动加入数据采集流程
        - 手势控制自停等紧急事件触发即时上传
        """
        logger.info("Data collection loop started")
        upload_interval = self._get_upload_interval()
        last_upload = 0
        last_retry = 0

        while self.running:
            try:
                current_time = time.time()
                
                # 定期重试初始化失败的设备（每 retry_interval 秒）
                if current_time - last_retry >= self._retry_interval:
                    self._retry_failed_devices()
                    last_retry = current_time
                
                # 紧急上传：手势控制自停等场景触发即时数据上报
                # 确保服务端和前端在 1 秒内感知到硬件状态变化
                if self._urgent_upload_needed:
                    logger.info("[上传] 紧急上传触发（手势控制自停等），立即上报数据")
                    self._collect_and_upload()
                    last_upload = current_time
                    self._urgent_upload_needed = False
                elif current_time - last_upload >= upload_interval:
                    self._collect_and_upload()
                    last_upload = current_time
                # 短暂休眠，便于响应停止
                self._stop_event.wait(timeout=1)
                # 动态获取间隔（支持配置热加载）
                upload_interval = self._get_upload_interval()
            except Exception as e:
                logger.error(f"Data loop error: {e}")
                self.event_bus.publish(Event(
                    event_type=EventTypes.SYSTEM_ERROR,
                    source="data_loop",
                    data={"error": str(e)}
                ))
                self._stop_event.wait(timeout=5)

    def _retry_failed_devices(self):
        """重试初始化失败的设备
        
        遍历所有失败的传感器和执行器，尝试重新初始化。
        初始化成功的设备会从失败列表中移除，并自动加入数据采集流程。
        """
        if not self._failed_sensors and not self._failed_actuators:
            return  # 没有失败的设备，跳过
        
        now = time.time()
        retry_count = 0
        success_count = 0

        # 重试传感器
        for sensor_id, last_attempt in list(self._failed_sensors.items()):
            if now - last_attempt < self._retry_interval:
                continue  # 未到重试时间
            
            if sensor_id not in self.sensors:
                del self._failed_sensors[sensor_id]
                continue
            
            sensor = self.sensors[sensor_id]
            retry_count += 1
            
            try:
                result = sensor.initialize()
                if result:
                    logger.info(f"[重试] 传感器 {sensor_id} 初始化成功！已加入数据采集")
                    del self._failed_sensors[sensor_id]
                    success_count += 1
                else:
                    self._failed_sensors[sensor_id] = now
            except Exception as e:
                logger.debug(f"[重试] 传感器 {sensor_id} 重试失败: {e}")
                self._failed_sensors[sensor_id] = now

        # 重试执行器
        for actuator_id, last_attempt in list(self._failed_actuators.items()):
            if now - last_attempt < self._retry_interval:
                continue
            
            if actuator_id not in self.actuators:
                del self._failed_actuators[actuator_id]
                continue
            
            actuator = self.actuators[actuator_id]
            retry_count += 1
            
            try:
                result = actuator.initialize()
                if result:
                    logger.info(f"[重试] 执行器 {actuator_id} 初始化成功！已加入数据采集")
                    del self._failed_actuators[actuator_id]
                    success_count += 1
                else:
                    self._failed_actuators[actuator_id] = now
            except Exception as e:
                logger.debug(f"[重试] 执行器 {actuator_id} 重试失败: {e}")
                self._failed_actuators[actuator_id] = now

        # 打印重试结果（仅在有设备被重试时）
        if retry_count > 0:
            remaining = len(self._failed_sensors) + len(self._failed_actuators)
            logger.info(f"[重试] 重试了 {retry_count} 个设备，成功 {success_count} 个，剩余 {remaining} 个待重试")

    def _get_upload_interval(self) -> int:
        """获取上传间隔（动态读取配置）"""
        return self.config.get("upload.interval", 30)

    def _read_sensor_data(self, sensor_id: str, sensor, sensors_mapping: Dict, area: str) -> List[Dict]:
        """读取单个传感器数据（供线程池使用）
        
        Args:
            sensor_id: 传感器ID
            sensor: 传感器实例
            sensors_mapping: 传感器映射配置
            area: 区域名
        
        Returns:
            节点数据列表
        """
        nodes = []
        try:
            logger.debug(f"[采集] 读取传感器: {sensor_id} ({sensor.name})")
            
            # 直接读取（传感器内部已有缓存和超时保护）
            data = sensor.read()
            
            if not data or data.get("value") is None:
                logger.warning(f"[采集] 传感器 {sensor_id} 返回空数据，跳过")
                return nodes

            value = data.get("value")
            quality = data.get("quality", "unknown")

            # WARNING 级别也接受（使用缓存数据）
            if quality not in ["good", "GOOD", "warning", "WARNING"]:
                logger.warning(f"[采集] 传感器 {sensor_id} 数据质量差: {quality}，跳过")
                return nodes

            logger.info(f"[采集] 传感器 {sensor_id} 数据: {value} {data.get('unit', '')}")

            # 处理多值传感器（如 DHT11 同时返回温度和湿度）
            if isinstance(value, dict):
                for key, val in value.items():
                    map_key = f"{sensor_id}_{key}"
                    mapping = sensors_mapping.get(map_key, {})
                    node_id = mapping.get("node_id", f"{sensor_id}_{key}")
                    api_type = mapping.get("type", key)
                    name = mapping.get("name", f"{sensor.name}_{key}")
                    location = mapping.get("location", "")
                    unit = data.get("unit", {})
                    if isinstance(unit, dict):
                        unit = unit.get(key, "")
                    nodes.append({
                        "node_id": node_id,
                        "type": api_type,
                        "name": name,
                        "value": val,
                        "unit": unit,
                        "location": location,
                        "area": area,
                    })
            else:
                mapping = sensors_mapping.get(sensor_id, {})
                node_id = mapping.get("node_id", sensor_id)
                api_type = mapping.get("type", sensor.sensor_type)
                name = mapping.get("name", sensor.name)
                location = mapping.get("location", "")
                unit = data.get("unit", "")
                nodes.append({
                    "node_id": node_id,
                    "type": api_type,
                    "name": name,
                    "value": value,
                    "unit": unit,
                    "location": location,
                    "area": area,
                })
        except Exception as e:
            logger.error(f"[采集] 传感器 {sensor_id} 读取错误: {e}")
        
        return nodes

    def _collect_and_upload(self):
        """采集所有传感器数据并上传（并行读取优化）"""
        nodes = []
        sensors_mapping = self.device_mapping.get("sensors", {})
        area = self.config.get("upload.area", "")

        logger.info(f"[采集] 开始采集数据，共 {len(self.sensors)} 个传感器，{len(self.actuators)} 个执行器")

        # 并行读取所有传感器数据（使用线程池）
        if self.sensors:
            import concurrent.futures
            try:
                with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                    # 提交所有读取任务
                    futures = {
                        executor.submit(
                            self._read_sensor_data,
                            sensor_id,
                            sensor,
                            sensors_mapping,
                            area
                        ): sensor_id
                        for sensor_id, sensor in self.sensors.items()
                    }

                    # 收集结果
                    for future in concurrent.futures.as_completed(futures):
                        sensor_id = futures[future]
                        try:
                            result_nodes = future.result()
                            nodes.extend(result_nodes)
                        except Exception as e:
                            logger.error(f"[采集] 传感器 {sensor_id} 读取异常: {e}")
            except Exception as e:
                logger.error(f"[采集] 并行读取失败: {e}")
                # 降级为串行读取
                for sensor_id, sensor in self.sensors.items():
                    nodes.extend(self._read_sensor_data(sensor_id, sensor, sensors_mapping, area))

        # 采集执行器状态（按协议规范格式）
        logger.info(f"[采集] 采集执行器状态，共 {len(self.actuators)} 个执行器")
        actuators_mapping = self.device_mapping.get("actuators", {})
        area = self.config.get("upload.area", "")
        for actuator_id, actuator in self.actuators.items():
            try:
                mapping = actuators_mapping.get(actuator_id, {})
                node_id = mapping.get("node_id", actuator_id)
                api_type = mapping.get("type", actuator.actuator_type)
                name = mapping.get("name", actuator.name)

                # 获取执行器状态
                state = "off"
                if hasattr(actuator, "_state"):
                    state = actuator._state.value if hasattr(actuator._state, "value") else str(actuator._state)
                    if state == "unknown":
                        state = "off"

                # 获取控制参数（按协议规范）
                control_value = 0
                control_type = "boolean"  # 默认布尔控制
                control_min = 0
                control_max = 0
                control_step = 0
                control_default = 0

                # 根据执行器类型设置控制参数
                if actuator.actuator_type in ["rgb_led", "motor", "fan", "heater"]:
                    control_type = "integer"
                    control_min = 0
                    control_max = 100
                    control_step = 1
                    control_default = 0

                location = mapping.get("location", "")

                nodes.append({
                    "node_id": node_id,
                    "type": api_type,
                    "name": name,
                    "state": state,
                    "mode": "manual",
                    "control_value": control_value,
                    "control_type": control_type,
                    "control_min": control_min,
                    "control_max": control_max,
                    "control_step": control_step,
                    "control_default": control_default,
                    "location": location,
                    "area": area,
                })
                logger.info(f"[采集] 执行器 {actuator_id} 状态: {state}")
            except Exception as e:
                logger.error(f"Actuator {actuator_id} status error: {e}")

        # 采集摄像头追踪数据（作为特殊传感器节点上报）
        if self._camera and self._camera_initialized:
            try:
                camera_node = self._build_camera_node()
                if camera_node:
                    nodes.append(camera_node)
                    found = camera_node.get("feedback", {}).get("found", False)
                    logger.info(
                        f"[采集] 摄像头节点: {camera_node['node_id']} "
                        f"({'检测到目标' if found else '未检测到目标'})"
                    )
            except Exception as e:
                logger.error(f"[采集] 摄像头节点构造失败: {e}")

        # 上传
        if nodes:
            try:
                logger.info(f"[上传] 准备上传 {len(nodes)} 个设备节点")
                success = self.upload.upload_batch(nodes)
                if success:
                    logger.info(f"[上传] 上传成功，共 {len(nodes)} 个设备节点")
                    self.event_bus.publish(Event(
                        event_type=EventTypes.UPLOAD_SUCCESS,
                        source="upload",
                        data={"count": len(nodes)}
                    ))
                else:
                    logger.error(f"[上传] 上传失败，共 {len(nodes)} 个设备节点")
                    self.event_bus.publish(Event(
                        event_type=EventTypes.UPLOAD_FAILED,
                        source="upload",
                        data={"count": len(nodes)}
                    ))
            except Exception as e:
                logger.error(f"[上传] 上传异常: {e}")
        else:
            logger.info(f"[上传] 没有可上传的设备节点")

    def _camera_frame_upload_loop(self):
        """摄像头帧上传循环 - 按配置间隔抓取 JPEG 帧上传到服务器

        与数据采集循环独立运行，因为：
        1. 帧上传间隔通常比传感器数据上报间隔长（10-60秒 vs 30秒）
        2. 帧上传使用 multipart/form-data，与传感器数据上报接口不同
        3. 帧上传失败不影响传感器数据上报
        4. 可单独配置仅在检测到目标时上传（节省带宽和存储）
        """
        logger.info("[帧上传] 摄像头帧上传循环已启动")
        frame_upload_config = self.config.get("frame_upload", {})
        interval = frame_upload_config.get("interval", 30)
        upload_only_on_detection = frame_upload_config.get(
            "upload_only_on_detection", False
        )
        jpeg_quality = frame_upload_config.get("jpeg_quality", 70)

        # 获取摄像头节点ID（用于服务器端识别）
        camera_mapping = self.device_mapping.get("camera", {})
        node_id = camera_mapping.get("node_id", "CAM-1-001")

        while self.running:
            try:
                self._stop_event.wait(timeout=interval)
                if not self.running or not self._camera:
                    break

                # 如果配置仅检测到目标时上传，先检查追踪结果
                if upload_only_on_detection:
                    detection = self._camera.get_last_detection()
                    if not detection.get("found", False):
                        logger.debug("[帧上传] 未检测到目标，跳过本次上传")
                        continue

                # 抓取当前帧 JPEG
                frame_data = self._camera.get_jpeg_frame(quality=jpeg_quality)
                if not frame_data:
                    logger.warning("[帧上传] 帧抓取失败，跳过本次上传")
                    continue

                # 获取检测结果元数据
                detection = self._camera.get_last_detection()

                # 调用上传服务上传帧
                result = self.upload.upload_camera_frame(
                    node_id=node_id,
                    frame_data=frame_data,
                    detection=detection if detection.get("found") else None,
                )

                if result.get("success"):
                    file_path = result.get("file_path", "未知路径")
                    logger.info(
                        f"[帧上传] 成功: {node_id} -> {file_path} "
                        f"({len(frame_data)} bytes)"
                    )
                else:
                    logger.warning(
                        f"[帧上传] 失败: {result.get('error', '未知错误')}"
                    )

            except Exception as e:
                logger.error(f"[帧上传] 循环异常: {e}")
                self._stop_event.wait(timeout=interval)

    def _cache_retry_loop(self):
        """缓存重传循环 - 网络恢复后重传缓存的数据"""
        logger.info("Cache retry loop started")
        while self.running:
            try:
                self._stop_event.wait(timeout=60)  # 每 60 秒重试一次
                if not self.running:
                    break
                uploaded = self.upload.upload_cached_data()
                if uploaded > 0:
                    logger.info(f"Retry uploaded {uploaded} cached records")
            except Exception as e:
                logger.error(f"Cache retry error: {e}")

    def _command_poll_loop(self):
        """命令轮询循环 - 定期从服务器获取待执行的控制指令
        
        策略：始终保持 3 秒轮询间隔，确保命令快速获取
        - 即使 WebSocket 在线，也需要频繁轮询（服务器可能通过 HTTP 下发命令）
        - WebSocket 作为实时回执通道，HTTP 轮询作为命令获取通道
        """
        logger.info("Command poll loop started")
        while self.running:
            try:
                # 更新 WebSocket 连接状态
                self._update_websocket_status()
                
                # 统一使用 3 秒轮询间隔（快速响应命令）
                # 如果 WebSocket 断开，日志会提示，但轮询间隔不变
                if not self._websocket_connected:
                    logger.debug("[命令] WebSocket 离线，仍保持 3 秒轮询")
                
                poll_interval = 3
                self._stop_event.wait(timeout=poll_interval)
                if not self.running:
                    break

                # 从服务器获取待执行命令（使用映射后的节点ID）
                # 注意：摄像头（CAM-1-001）不在 self.actuators 字典中（作为特殊传感器节点上报），
                # 但仍需通过 HTTP 轮询拉取其待执行命令，因此单独追加摄像头节点 ID。
                actuator_ids = []
                actuators_mapping = self.device_mapping.get("actuators", {})
                for actuator_id in self.actuators.keys():
                    mapping = actuators_mapping.get(actuator_id, {})
                    node_id = mapping.get("node_id", actuator_id)
                    actuator_ids.append(node_id)

                # 追加摄像头节点（如果已初始化），确保能拉取到摄像头命令
                if self._camera and self._camera_initialized:
                    camera_mapping = self.device_mapping.get("camera", {})
                    camera_node_id = camera_mapping.get("node_id", "CAM-1-001")
                    if camera_node_id not in actuator_ids:
                        actuator_ids.append(camera_node_id)

                # 调试日志：记录轮询时间（DEBUG级别，需要时启用）
                now = time.strftime("%H:%M:%S")
                logger.debug(f"[命令轮询] {now} 获取待执行命令，共 {len(actuator_ids)} 个执行器")
                
                commands = self.upload.fetch_pending_commands(actuator_ids)
                if commands:
                    self._execute_commands(commands)
                else:
                    logger.debug(f"[命令轮询] {now} 无待执行命令")
            except Exception as e:
                logger.error(f"Command poll error: {e}")

    def _is_command_executed(self, command_id: int) -> bool:
        """检查命令是否已执行过（去重）

        Args:
            command_id: 命令ID

        Returns:
            True表示已执行过，False表示未执行
        """
        with self._command_lock:
            return command_id in self._executed_commands

    def _mark_command_executed(self, command_id: int):
        """标记命令已执行

        Args:
            command_id: 命令ID
        """
        with self._command_lock:
            self._executed_commands.add(command_id)

    def _cleanup_executed_commands(self):
        """清理已过期的命令记录（每5分钟清理一次）"""
        # 当前实现简单，保留所有记录
        # 如需清理，可添加时间戳记录并定期删除过期条目
        pass

    def _execute_single_command(self, cmd: Dict):
        """执行单条控制指令（支持去重，供 WebSocket 和 HTTP 共用）

        Args:
            cmd: 指令数据
        """
        try:
            actuator_node_id = cmd.get("actuator_id", "")
            command = cmd.get("command", "")
            command_id = cmd.get("id", 0)
            control_value = cmd.get("control_value")
            # 服务端将 pan/tilt 等结构化参数放在 command_data 字段
            # 例如：{"pan": 119, "tilt": 90, "type": "value"}
            command_data = cmd.get("command_data")

            # 命令去重检查
            if self._is_command_executed(command_id):
                logger.debug(f"[命令] 跳过已执行的命令: {command_id}")
                return

            # 反向映射：从节点ID找到原始执行器ID
            actuator_id = actuator_node_id
            actuators_mapping = self.device_mapping.get("actuators", {})
            for orig_id, mapping in actuators_mapping.items():
                if mapping.get("node_id") == actuator_node_id:
                    actuator_id = orig_id
                    break

            logger.info(f"[命令] 硬件端查询指令 - 执行器: {actuator_id}, 指令: {command}, 控制值: {control_value}, 命令数据: {command_data}, 命令ID: {command_id}")

            # 摄像头命令分支（摄像头不在 self.actuators 中，单独处理）
            camera_mapping = self.device_mapping.get("camera", {})
            camera_node_id = camera_mapping.get("node_id", "CAM-1-001")
            if actuator_node_id == camera_node_id:
                # 摄像头命令同时传入 command_data 和 control_value，由下游决定优先级
                success, state = self._handle_camera_command(command, control_value, command_data)
                self._mark_command_executed(command_id)
                if success:
                    logger.info(f"[命令] 摄像头命令执行成功: {command} @ {time.strftime('%H:%M:%S')}")
                    self._send_command_ack_fast(actuator_node_id, command_id, "executed", control_value, state)
                else:
                    logger.error(f"[命令] 摄像头命令执行失败: {command}")
                    self._send_command_ack_fast(actuator_node_id, command_id, "failed", control_value)
                return

            # 查找执行器
            actuator = self.actuators.get(actuator_id)
            if not actuator:
                logger.warning(f"[命令] 未找到执行器: {actuator_id} (节点ID: {actuator_node_id})")
                # 发送失败回执（使用节点ID）
                self.upload.send_ack(actuator_node_id, command_id, "failed")
                return

            # 执行命令
            success = False
            state = "off"

            if command == "on":
                success = actuator.turn_on()
                state = "on"
            elif command == "off":
                success = actuator.turn_off()
                state = "off"
            elif command == "value" and control_value is not None:
                # 设置控制值（支持多种格式）
                success, state = self._handle_value_command(actuator, actuator_id, control_value)
            elif command == "color" and control_value is not None:
                # RGB 自定义颜色控制
                success, state = self._handle_color_command(actuator, actuator_id, control_value)
            elif command == "preset" and control_value is not None:
                # 预设颜色名称控制
                success, state = self._handle_preset_command(actuator, actuator_id, control_value)
            elif command == "pattern" and control_value is not None:
                # 执行器模式控制（蜂鸣器等）
                success, state = self._handle_pattern_command(actuator, actuator_id, control_value)

            if success:
                exec_time = time.strftime("%H:%M:%S")
                logger.info(f"[命令] 执行成功: {actuator_id} -> {command} @ {exec_time}")
                # 标记命令已执行（防止重复）
                self._mark_command_executed(command_id)
                # 立即发送回执（使用独立方法，确保零延迟）
                # 传递执行器实际状态 state（on/off），让服务器正确更新状态
                ack_time = time.strftime("%H:%M:%S")
                logger.info(f"[回执] 准备发送: {actuator_node_id} cmd={command_id} state={state} @ {ack_time}")
                self._send_command_ack_fast(actuator_node_id, command_id, "executed", control_value, state)
            else:
                exec_time = time.strftime("%H:%M:%S")
                logger.error(f"[命令] 执行失败: {actuator_id} -> {command} @ {exec_time}")
                # 标记命令已执行（防止重复）
                self._mark_command_executed(command_id)
                # 立即发送失败回执
                ack_time = time.strftime("%H:%M:%S")
                logger.info(f"[回执] 准备发送失败: {actuator_node_id} cmd={command_id} @ {ack_time}")
                self._send_command_ack_fast(actuator_node_id, command_id, "failed", control_value)

        except Exception as e:
            logger.error(f"[命令] 执行指令异常: {e}")

    def _handle_camera_command(self, command: str, control_value, command_data=None) -> tuple:
        """处理摄像头控制命令（服务端单独控制摄像头）

        支持的命令：
        - on: 打开摄像头（启动追踪 + 视频流）
        - off: 关闭摄像头（停止追踪）
        - value: 设置云台角度，参数优先级：command_data（dict）> control_value
                 command_data 格式 {"pan":90,"tilt":90,"type":"value"}
                 control_value 兼容旧协议（dict 或字符串）
        - track: 开启/关闭自动跟踪，control_value 为 "on"/"off"/1/0/true/false
        - color: 切换追踪颜色，control_value 为颜色名称 "red"/"blue"/"green" 等
        - reset: 云台复位到 90°,90°

        Args:
            command: 命令类型
            control_value: 控制值（旧协议字段，兼容保留）
            command_data: 结构化命令数据（新协议字段，服务端 pan/tilt 等参数存放于此）

        Returns:
            (success, state) 元组，state 为 "on" 或 "off"
        """
        if not self._camera:
            logger.warning("[摄像头] 摄像头未初始化，无法执行命令")
            return False, "off"

        try:
            # on: 打开摄像头（启动追踪）
            if command == "on":
                self._camera.set_tracking_enabled(True)
                self._camera.start_tracking()
                self._camera_power = True  # 更新电源状态
                logger.info("[摄像头] 已打开（追踪已启动）")
                return True, "on"

            # off: 关闭摄像头（停止追踪）
            elif command == "off":
                self._camera.stop_tracking()
                self._camera.set_tracking_enabled(False)
                self._camera_power = False  # 更新电源状态
                logger.info("[摄像头] 已关闭（追踪已停止）")
                return True, "off"

            # value: 设置云台角度
            # 优先使用 command_data（新协议，服务端 pan/tilt 字段）
            # 其次回退到 control_value（旧协议兼容）
            elif command == "value":
                move_param = command_data if isinstance(command_data, dict) else control_value
                if move_param is None:
                    logger.warning("[摄像头] value 命令缺少移动参数（command_data 与 control_value 均为空）")
                    return False, "off"
                return self._handle_camera_move(move_param)

            # track: 开启/关闭跟踪
            elif command == "track" and (control_value is not None or command_data is not None):
                # 解包 command_data dict 中的实际 value（服务器格式: {type:'track', value:'on'}）
                track_param = self._extract_command_param(command_data, control_value, 'value')
                return self._handle_camera_track(track_param)

            # color: 切换追踪颜色
            elif command == "color" and (control_value is not None or command_data is not None):
                # 解包 command_data dict 中的实际颜色名（服务器格式: {type:'color', color:'red'}）
                color_param = self._extract_command_param(command_data, control_value, 'color')
                return self._handle_camera_color(color_param)

            # gyro: 运行时开启/关闭陀螺仪手势控制
            elif command == "gyro" and (control_value is not None or command_data is not None):
                gyro_param = self._extract_command_param(command_data, control_value, 'value')
                return self._handle_camera_gyro(gyro_param)

            # reset: 全面复位（云台 90°,90° + 陀螺仪归零 + 手势缓存清零）
            elif command == "reset":
                return self._full_reset_camera()

            else:
                logger.warning(f"[摄像头] 不支持的命令: {command}")
                return False, "off"

        except Exception as e:
            logger.error(f"[摄像头] 命令执行异常: {e}")
            return False, "off"

    @staticmethod
    def _extract_command_param(command_data, control_value, key: str = 'value'):
        """从 command_data dict 或 control_value 中提取实际参数值

        服务器下发的 command_data 格式:
        - track: {type:'track', value:'on'}
        - color: {type:'color', color:'red'}
        - gyro:  {type:'gyro', value:'off'}

        优先从 command_data[key] 取值，回退到 control_value。

        Args:
            command_data: 服务器下发的结构化命令数据（dict 或 None）
            control_value: 兼容旧协议的控制值
            key: 要从 dict 中提取的字段名（默认 'value'，color 命令用 'color'）

        Returns:
            提取到的实际参数值（str/bool/int 等）
        """
        # 优先从 dict 中按 key 取值
        if isinstance(command_data, dict):
            if key in command_data:
                return command_data[key]
            # 兜底：dict 里有 value 字段也取
            if 'value' in command_data and key != 'value':
                return command_data['value']
        # 回退到 control_value
        if control_value is not None:
            return control_value
        # 最后尝试 command_data 本身（可能是裸值）
        return command_data

    def _handle_camera_gyro(self, control_value) -> tuple:
        """处理陀螺仪手势控制开关命令

        control_value 支持格式：
        - "on"/"off"  字符串
        - 1/0  整数
        - true/false  布尔值

        Returns:
            (success, state) 元组
        """
        try:
            # 解析开关值
            if isinstance(control_value, bool):
                enable = control_value
            elif isinstance(control_value, (int, float)):
                enable = bool(control_value)
            elif isinstance(control_value, str):
                enable = control_value.lower() in ("on", "1", "true", "enable", "start")
            else:
                logger.warning(f"[陀螺仪] 无效的参数: {control_value}")
                return False, "off"

            if enable:
                # 开启手势控制
                if self._mpu6050 and self._pan_tilt:
                    if not self._gesture_control_enabled:
                        self._gesture_control_enabled = True
                        # 如果手势线程因为异常退出过，重新启动
                        if self._gesture_control_thread is None or not self._gesture_control_thread.is_alive():
                            gc_config = self.config.get("camera.gesture_control", {}) or {}
                            self._gesture_control_thread = threading.Thread(
                                target=self._gesture_control_loop,
                                args=(gc_config,),
                                name="GestureControl",
                                daemon=True,
                            )
                            self._gesture_control_thread.start()
                            self._threads.append(self._gesture_control_thread)
                            logger.info("[陀螺仪] 手势控制线程已重新启动")
                        logger.info("[陀螺仪] 手势控制已开启")
                    else:
                        logger.info("[陀螺仪] 手势控制已在开启状态")
                    return True, "on"
                else:
                    logger.warning("[陀螺仪] MPU6050 或云台未初始化，无法开启手势控制")
                    return False, "off"
            else:
                # 关闭手势控制（线程循环会自动检测标志位并退出）
                self._gesture_control_enabled = False
                logger.info("[陀螺仪] 手势控制已关闭")
                state = "on" if self._camera_power else "off"
                return True, state

        except Exception as e:
            logger.error(f"[陀螺仪] 手势控制开关异常: {e}")
            return False, "off"

    def _full_reset_camera(self) -> tuple:
        """摄像头全面复位（reset 命令入口）

        复位流程：
        1. 临时暂停手势控制（避免和舵机复位打架）
        2. 舵机回 90°, 90°
        3. 清空手势控制平滑缓存
        4. MPU6050 重新校准（加速度零偏 + 互补滤波状态）
        5. 恢复手势控制

        Returns:
            (success, state) 元组
        """
        logger.info("[全面复位] 开始...")

        # Step 1: 暂停手势控制
        gesture_was_running = self._gesture_control_enabled
        if gesture_was_running:
            self._gesture_control_enabled = False
            logger.info("[全面复位] 手势控制已暂停")

        # Step 2: 舵机回中位
        servo_ok = True
        if self._pan_tilt:
            try:
                with self._pan_tilt_lock:
                    servo_ok = self._pan_tilt.reset()
                logger.info(
                    f"[全面复位] 舵机复位: {'成功' if servo_ok else '失败'}"
                )
            except Exception as e:
                logger.error(f"[全面复位] 舵机复位异常: {e}")
                servo_ok = False
        else:
            logger.warning("[全面复位] 云台未初始化，跳过舵机复位")

        # Step 3: 清空手势平滑缓存
        self._smooth_pan = None
        self._smooth_tilt = None
        logger.info("[全面复位] 手势平滑缓存已清空")

        # Step 4: MPU6050 重新校准（需保持静止！）
        mpu_ok = True
        if self._mpu6050 and self._mpu6050._initialized:
            try:
                with self._pan_tilt_lock:
                    mpu_ok = self._mpu6050.recalibrate()
                logger.info(
                    f"[全面复位] 陀螺仪重新校准: {'成功' if mpu_ok else '失败'}"
                )
            except Exception as e:
                logger.error(f"[全面复位] 陀螺仪校准异常: {e}")
                mpu_ok = False
        else:
            logger.info("[全面复位] MPU6050 未初始化，跳过陀螺仪校准")

        # Step 5: 恢复手势控制
        if gesture_was_running:
            self._gesture_control_enabled = True
            logger.info("[全面复位] 手势控制已恢复")

        all_ok = servo_ok or not self._pan_tilt
        state = "on" if self._camera_power else "off"
        logger.info(
            f"[全面复位] 完成: 舵机={'OK' if servo_ok else 'FAIL'}, "
            f"陀螺仪={'OK' if mpu_ok else 'FAIL'}, state={state}"
        )
        return all_ok, state

    def _handle_camera_move(self, control_value) -> tuple:
        """处理摄像头云台移动命令

        control_value 支持格式（兼容协议文档与历史调用）：
        - {"pan": 90, "tilt": 90}                 绝对角度（dict）
        - {"pan_delta": 10, "tilt_delta": -5}     增量移动（dict）
        - "pan=90,tilt=45"                        绝对角度（协议规范字符串）
        - "pan_delta=-10,tilt_delta=5"            增量移动（协议规范字符串）
        - "90,45"                                 简化字符串（pan,tilt）

        Returns:
            (success, state) 元组
        """
        if not self._pan_tilt:
            logger.warning("[摄像头] 云台未初始化，无法移动")
            return False, "off"

        try:
            # 加锁保护 I2C 总线（与手势控制线程的 MPU6050 读取 + PCA9685 写入互斥）
            with self._pan_tilt_lock:
                if isinstance(control_value, dict):
                    # 绝对角度
                    if "pan" in control_value or "tilt" in control_value:
                        pan = float(control_value.get("pan", 90))
                        tilt = float(control_value.get("tilt", 90))
                        success = self._pan_tilt.set_position(pan, tilt)
                        # 手势控制启用时，同步舵机平滑缓存（避免下次手势控制时跳变）
                        if self._gesture_control_enabled:
                            self._smooth_pan = pan
                            self._smooth_tilt = tilt
                        logger.info(f"[摄像头] 云台设置角度: pan={pan}°, tilt={tilt}°")
                        return success, "on"
                    # 增量移动
                    elif "pan_delta" in control_value or "tilt_delta" in control_value:
                        pan_delta = float(control_value.get("pan_delta", 0))
                        tilt_delta = float(control_value.get("tilt_delta", 0))
                        success, new_pan, new_tilt = self._pan_tilt.move(pan_delta, tilt_delta)
                        if self._gesture_control_enabled:
                            self._smooth_pan = new_pan
                            self._smooth_tilt = new_tilt
                        logger.info(f"[摄像头] 云台增量移动: pan={new_pan}°, tilt={new_tilt}°")
                        return success, "on"

                elif isinstance(control_value, str):
                    # 解析字符串格式
                    parsed = self._parse_move_string(control_value)
                    if parsed is None:
                        logger.warning(f"[摄像头] 无法解析的移动参数: {control_value}")
                        return False, "off"

                    mode, pan_val, tilt_val = parsed
                    if mode == "absolute":
                        success = self._pan_tilt.set_position(pan_val, tilt_val)
                        if self._gesture_control_enabled:
                            self._smooth_pan = pan_val
                            self._smooth_tilt = tilt_val
                        logger.info(f"[摄像头] 云台设置角度: pan={pan_val}°, tilt={tilt_val}°")
                        return success, "on"
                    else:  # delta
                        success, new_pan, new_tilt = self._pan_tilt.move(pan_val, tilt_val)
                        if self._gesture_control_enabled:
                            self._smooth_pan = new_pan
                            self._smooth_tilt = new_tilt
                        logger.info(f"[摄像头] 云台增量移动: pan={new_pan}°, tilt={new_tilt}°")
                        return success, "on"

            logger.warning(f"[摄像头] 无效的移动参数: {control_value}")
            return False, "off"
        except Exception as e:
            logger.error(f"[摄像头] 云台移动异常: {e}")
            return False, "off"

    @staticmethod
    def _parse_move_string(text: str):
        """解析云台移动字符串参数

        支持格式：
        - "pan=90,tilt=45"               -> ("absolute", 90.0, 45.0)
        - "pan_delta=-10,tilt_delta=5"   -> ("delta", -10.0, 5.0)
        - "90,45"                        -> ("absolute", 90.0, 45.0)  # 简化兼容格式

        Returns:
            (mode, pan, tilt) 元组；解析失败返回 None
        """
        try:
            text = text.strip()
            # 检查是否为 "key=value,key=value" 格式
            if "=" in text:
                kv = {}
                for part in text.split(","):
                    key, _, value = part.partition("=")
                    kv[key.strip().lower()] = float(value.strip())
                if "pan_delta" in kv or "tilt_delta" in kv:
                    return ("delta", kv.get("pan_delta", 0), kv.get("tilt_delta", 0))
                if "pan" in kv or "tilt" in kv:
                    return ("absolute", kv.get("pan", 90), kv.get("tilt", 90))
                return None
            # 简化格式 "pan,tilt"
            parts = text.split(",")
            if len(parts) == 2:
                return ("absolute", float(parts[0].strip()), float(parts[1].strip()))
            return None
        except (ValueError, AttributeError):
            return None

    def _handle_camera_track(self, control_value) -> tuple:
        """处理摄像头跟踪开关命令

        control_value 支持格式：
        - "on"/"off"  字符串
        - 1/0  整数
        - true/false  布尔值

        Returns:
            (success, state) 元组
        """
        try:
            if isinstance(control_value, bool):
                enable = control_value
            elif isinstance(control_value, (int, float)):
                enable = bool(control_value)
            elif isinstance(control_value, str):
                enable = control_value.lower() in ("on", "1", "true", "enable", "start")
            else:
                logger.warning(f"[摄像头] 无效的跟踪参数: {control_value}")
                return False, "off"

            self._camera.set_tracking_enabled(enable)
            if enable:
                self._camera.start_tracking()
                self._camera_power = True  # 跟踪开启时摄像头视为开启
                logger.info("[摄像头] 自动跟踪已开启")
                return True, "on"
            else:
                self._camera.stop_tracking()
                logger.info("[摄像头] 自动跟踪已关闭")
                # 关键修复：关闭追踪时摄像头仍处于开启状态，state 应为 "on" 而非 "off"
                # 返回 "off" 会导致前端误判摄像头已关闭，隐藏视频流
                state = "on" if self._camera_power else "off"
                return True, state
        except Exception as e:
            logger.error(f"[摄像头] 跟踪开关异常: {e}")
            return False, "off"

    def _handle_camera_color(self, control_value) -> tuple:
        """处理摄像头颜色切换命令

        从 settings.yaml 的 camera.tracking.color_presets 读取对应颜色的 HSV 阈值。

        control_value 支持格式：
        - "red"/"blue"/"green"/"yellow"/"orange"  颜色名称

        Returns:
            (success, state) 元组
        """
        try:
            color_name = str(control_value).strip().lower()

            # 从配置读取颜色预设
            camera_config = self.config.get("camera", {})
            tracking_config = camera_config.get("tracking", {})
            color_presets = tracking_config.get("color_presets", {})

            if color_name not in color_presets:
                available = list(color_presets.keys())
                logger.warning(f"[摄像头] 未知颜色预设: {color_name}，可用: {available}")
                return False, "off"

            preset = color_presets[color_name]
            self._camera.set_hsv_thresholds(
                hue_low=preset.get("hue_low"),
                hue_up=preset.get("hue_up"),
                hue2_low=preset.get("hue2_low"),
                hue2_up=preset.get("hue2_up"),
                sat_low=preset.get("sat_low"),
                sat_high=preset.get("sat_high"),
                val_low=preset.get("val_low"),
                val_high=preset.get("val_high"),
            )
            self._camera_current_color = color_name  # 更新当前颜色名称
            logger.info(f"[摄像头] 追踪颜色已切换: {color_name}")
            return True, "on"
        except Exception as e:
            logger.error(f"[摄像头] 颜色切换异常: {e}")
            return False, "off"

    def _handle_value_command(self, actuator, actuator_id: str, control_value) -> tuple:
        """处理 value 命令（支持整数/字符串/颜色名）
        
        Args:
            actuator: 执行器对象
            actuator_id: 执行器ID
            control_value: 控制值
            
        Returns:
            (success, state) 元组
        """
        try:
            # 尝试转换为整数
            int_value = int(float(control_value))
            
            # RGB-LED: 0-9 预设颜色, 10-100 白色亮度
            if hasattr(actuator, "set_value"):
                success = actuator.set_value(int_value)
                state = "on" if int_value > 0 else "off"
                logger.info(f"[命令] value={int_value} -> {actuator_id} (预设颜色/亮度)")
                return success, state
            else:
                # 其他执行器：使用 set_value 或 turn_on/turn_off
                if int_value > 0 and hasattr(actuator, "turn_on"):
                    success = actuator.turn_on()
                    return success, "on"
                elif int_value == 0 and hasattr(actuator, "turn_off"):
                    success = actuator.turn_off()
                    return success, "off"
                elif hasattr(actuator, "set_value"):
                    success = actuator.set_value(int_value)
                    return success, "on" if int_value > 0 else "off"
                else:
                    logger.warning(f"[命令] 执行器 {actuator_id} 不支持 value 命令")
                    return False, "off"
        except (ValueError, TypeError):
            # 非数值类型，尝试作为颜色名称或 "r,g,b" 格式
            str_value = str(control_value).strip()
            
            # 尝试解析 "r,g,b" 格式（如 "255,128,0"）
            if "," in str_value and hasattr(actuator, "set_color_rgb"):
                try:
                    parts = [int(x.strip()) for x in str_value.split(",")]
                    if len(parts) == 3:
                        success = actuator.set_color_rgb(parts[0], parts[1], parts[2])
                        state = "on" if any(parts) else "off"
                        logger.info(f"[命令] RGB({parts[0]},{parts[1]},{parts[2]}) -> {actuator_id}")
                        return success, state
                except (ValueError, TypeError):
                    pass
            
            # 尝试作为颜色名称
            if hasattr(actuator, "set_preset_color"):
                success = actuator.set_preset_color(str_value)
                state = "on" if success else "off"
                logger.info(f"[命令] 颜色'{str_value}' -> {actuator_id}")
                return success, state
            
            logger.warning(f"[命令] 无法解析控制值: {control_value}")
            return False, "off"

    def _handle_color_command(self, actuator, actuator_id: str, control_value) -> tuple:
        """处理 color 命令（自定义 RGB 颜色）
        
        Args:
            actuator: 执行器对象
            actuator_id: 执行器ID
            control_value: 控制值（JSON字符串或dict，包含 r/g/b）
            
        Returns:
            (success, state) 元组
        """
        if not hasattr(actuator, "set_color_rgb"):
            logger.warning(f"[命令] 执行器 {actuator_id} 不支持 color 命令")
            return False, "off"
        
        try:
            # 支持 JSON 字符串: '{"r":255,"g":128,"b":0}'
            import json
            if isinstance(control_value, str):
                color_data = json.loads(control_value)
            elif isinstance(control_value, dict):
                color_data = control_value
            else:
                logger.warning(f"[命令] 不支持的 color 格式: {type(control_value)}")
                return False, "off"
            
            r = int(color_data.get("r", 0))
            g = int(color_data.get("g", 0))
            b = int(color_data.get("b", 0))
            
            success = actuator.set_color_rgb(r, g, b)
            state = "on" if (r > 0 or g > 0 or b > 0) else "off"
            logger.info(f"[命令] RGB color({r},{g},{b}) -> {actuator_id}")
            return success, state
            
        except Exception as e:
            logger.error(f"[命令] color 命令执行失败: {e}")
            return False, "off"

    def _handle_preset_command(self, actuator, actuator_id: str, control_value) -> tuple:
        """处理 preset 命令（预设颜色名称）
        
        Args:
            actuator: 执行器对象
            actuator_id: 执行器ID
            control_value: 颜色名称 (red/green/blue/cyan/magenta/yellow/white/orange/purple/off)
            
        Returns:
            (success, state) 元组
        """
        if not hasattr(actuator, "set_preset_color"):
            logger.warning(f"[命令] 执行器 {actuator_id} 不支持 preset 命令")
            return False, "off"
        
        color_name = str(control_value).strip().lower()
        success = actuator.set_preset_color(color_name)
        state = "on" if color_name != "off" and success else "off"
        logger.info(f"[命令] preset '{color_name}' -> {actuator_id}")
        return success, state

    def _handle_pattern_command(self, actuator, actuator_id: str, control_value) -> tuple:
        """处理 pattern 命令（执行器模式，如蜂鸣器蜂鸣模式）
        
        Args:
            actuator: 执行器对象
            actuator_id: 执行器ID
            control_value: 模式名称 (click/success/warning/alarm)
            
        Returns:
            (success, state) 元组
        """
        if hasattr(actuator, "beep_pattern"):
            # 蜂鸣器模式
            pattern = str(control_value).strip().lower()
            success = actuator.beep_pattern(pattern)
            state = "on" if success else "off"
            logger.info(f"[命令] pattern '{pattern}' -> {actuator_id}")
            return success, state
        elif hasattr(actuator, "set_mode"):
            # 通用模式
            mode = str(control_value).strip().lower()
            success = actuator.set_mode(mode)
            state = "on" if success else "off"
            logger.info(f"[命令] mode '{mode}' -> {actuator_id}")
            return success, state
        else:
            logger.warning(f"[命令] 执行器 {actuator_id} 不支持 pattern 命令")
            return False, "off"

    def _send_command_ack_fast(self, actuator_node_id: str, command_id: int,
                                status: str, control_value=None, state: str = None):
        """快速发送命令回执（优先 WebSocket，降级 HTTP）
        
        命令执行成功后立即调用此方法发送回执，确保服务器实时收到反馈。
        同时发送 WebSocket 和 HTTP 两种方式，确保服务器端快速更新状态。
        
        按协议规范，回执包含：command_id, status, control_value, state
        
        Args:
            actuator_node_id: 执行器节点ID
            command_id: 命令ID
            status: 执行状态 (executed/failed)
            control_value: 控制值
            state: 执行器实际状态 (on/off)
        """
        ack_start = time.strftime("%H:%M:%S")
        
        # 1. 优先使用 WebSocket 发送（零延迟）
        ws_success = False
        if self._websocket_service and self._websocket_service.is_connected():
            try:
                result = self._websocket_service.send_command_ack(
                    actuator_node_id, command_id, status, control_value, state
                )
                if result:
                    ws_success = True
                    logger.info(f"[回执] WebSocket 发送成功: {actuator_node_id} cmd={command_id} @ {ack_start}")
                else:
                    logger.warning(f"[回执] WebSocket 发送失败，同时发送 HTTP")
            except Exception as e:
                logger.warning(f"[回执] WebSocket 异常: {e}")
        
        # 2. 同时通过 HTTP 发送（冗余保障，确保服务器状态更新）
        try:
            http_start = time.strftime("%H:%M:%S")
            self.upload.send_ack(actuator_node_id, command_id, status, control_value, state)
            http_end = time.strftime("%H:%M:%S")
            logger.info(f"[回执] HTTP 发送成功: {actuator_node_id} cmd={command_id} @ {http_end} (开始: {http_start})")
        except Exception as e:
            logger.error(f"[回执] HTTP 发送失败: {e}")
        
        return ws_success

    def _start_command_executor(self):
        """启动命令异步执行器"""
        if self._command_executor_running:
            return
            
        self._command_executor_running = True
        self._command_executor = threading.Thread(
            target=self._command_executor_loop, 
            daemon=True, 
            name="command-executor"
        )
        self._command_executor.start()
        logger.info("Command executor started (async mode)")

    def _stop_command_executor(self):
        """停止命令异步执行器"""
        self._command_executor_running = False
        
    def _command_executor_loop(self):
        """命令执行器主循环 - 异步处理命令队列"""
        while self._command_executor_running:
            try:
                # 从队列中取出命令
                cmd = None
                with self._command_queue_lock:
                    if self._command_queue:
                        cmd = self._command_queue.pop(0)
                
                if cmd:
                    cmd_id = cmd.get("id", 0)
                    queue_time = cmd.get("_queue_time", "unknown")
                    exec_start = time.strftime("%H:%M:%S")
                    logger.info(f"[执行器] 命令出队: cmd={cmd_id}, 入队时间={queue_time}, 开始执行={exec_start}")
                    self._execute_single_command(cmd)
                    exec_end = time.strftime("%H:%M:%S")
                    logger.info(f"[执行器] 命令完成: cmd={cmd_id}, 完成时间={exec_end}")
                else:
                    # 队列为空，短暂休眠
                    self._stop_event.wait(timeout=0.1)
            except Exception as e:
                logger.error(f"Command executor loop error: {e}")

    def _execute_commands(self, commands: List[Dict]):
        """执行从服务器获取的控制指令列表（异步模式）

        Args:
            commands: 指令列表
        """
        queue_time = time.strftime("%H:%M:%S")
        for cmd in commands:
            cmd["_queue_time"] = queue_time  # 记录入队时间
        with self._command_queue_lock:
            self._command_queue.extend(commands)
        logger.info(f"[命令] 已加入 {len(commands)} 条命令到执行队列 @ {queue_time}")

    def _execute_single_command_sync(self, cmd: Dict):
        """同步执行单条命令（供特殊场景使用）"""
        self._execute_single_command(cmd)

    def _start_websocket_service(self):
        """启动 WebSocket 服务（实时接收服务器推送的命令）
        
        关键：获取所有执行器的 node_id 列表，注册到服务器，
        这样服务器才能将命令正确推送到对应的执行器。
        """
        if self._websocket_class:
            try:
                # 获取所有执行器的 node_id 列表（用于注册到服务器）
                actuator_node_ids = []
                actuators_mapping = self.device_mapping.get("actuators", {})
                for actuator_id in self.actuators.keys():
                    mapping = actuators_mapping.get(actuator_id, {})
                    node_id = mapping.get("node_id", actuator_id)
                    actuator_node_ids.append(node_id)

                # 摄像头节点也加入注册列表（接收服务端单独控制命令）
                if self._camera and self._camera_initialized:
                    camera_mapping = self.device_mapping.get("camera", {})
                    camera_node_id = camera_mapping.get("node_id", "CAM-1-001")
                    actuator_node_ids.append(camera_node_id)

                logger.info(f"[WebSocket] 注册执行器列表: {actuator_node_ids}")
                
                # 创建 WebSocket 服务，注册命令处理回调和执行器 ID
                self._websocket_service = self._websocket_class(
                    config=self.config.to_dict(),
                    upload_service=self.upload,
                    command_handler=self._on_websocket_command,
                    actuator_ids=actuator_node_ids,  # 传递执行器 ID 列表
                    model_handler=self._on_model_switch,  # 识别模型切换回调
                )
                self._websocket_service.start()
                logger.info("[WebSocket] WebSocket 服务已启动")
            except Exception as e:
                logger.error(f"[WebSocket] 启动失败: {e}")
        else:
            logger.info("[WebSocket] WebSocketService 不可用，跳过启动")

    def _on_websocket_command(self, cmd: Dict):
        """处理 WebSocket 收到的命令

        Args:
            cmd: 命令数据
        """
        logger.info(f"[WebSocket] 收到命令: {cmd}")
        # 使用公共方法执行命令（自动去重）
        self._execute_single_command(cmd)

    def _update_websocket_status(self):
        """更新 WebSocket 连接状态"""
        if self._websocket_service:
            self._websocket_connected = self._websocket_service.is_connected()
        else:
            self._websocket_connected = False

    def _start_ui(self):
        """启动触摸屏 UI"""
        def ui_main():
            try:
                from ui.main_window import MainWindow
                self.ui = MainWindow(app_container=self, fullscreen=True)
                self.ui.run()
            except ImportError as e:
                logger.error(f"UI import error: {e}")
            except Exception as e:
                logger.error(f"UI error: {e}")

        self._ui_thread = threading.Thread(target=ui_main, daemon=True, name="ui")
        self._ui_thread.start()
        logger.info("UI started in separate thread")

    def _restart_service(self):
        """重启服务（OTA 升级成功后调用）"""
        logger.info("Restarting service after OTA update...")
        try:
            self.stop()
        except Exception:
            pass
        # 通过重启主进程来加载新代码
        # 注意：这里使用 os.execv 重启当前进程
        time.sleep(1)
        python = sys.executable
        os.execv(python, [python] + sys.argv)

    def _signal_handler(self, sig, frame):
        """信号处理"""
        logger.info(f"Received signal {sig}, shutting down...")
        self.running = False
        self._stop_event.set()

    def stop(self):
        """停止系统"""
        if not self.running:
            return
        logger.info("System stopping...")
        self.running = False
        self._stop_event.set()

        # 停止配置监控
        try:
            self.config.stop_watching()
        except Exception:
            pass

        # 停止智能养护 Agent
        try:
            if self.agent:
                self.agent.stop()
        except Exception:
            pass

        # 停止心跳
        try:
            self.heartbeat.stop()
        except Exception:
            pass

        # 停止 OTA 自动检查
        try:
            self.ota_manager.stop_auto_check()
        except Exception:
            pass

        # 停止 WebSocket 服务
        try:
            if self._websocket_service:
                self._websocket_service.stop()
        except Exception:
            pass

        # 停止命令执行器
        try:
            self._stop_command_executor()
        except Exception:
            pass

        # 停止摄像头追踪
        try:
            if self._camera:
                self._camera.stop_tracking()
                self._camera.cleanup()
        except Exception:
            pass

        # 停止视频流服务
        try:
            if self._video_stream_service:
                self._video_stream_service.stop()
                self._video_stream_service = None
        except Exception:
            pass

        # 释放 YOLO 检测器
        try:
            if hasattr(self, '_yolo_detector') and self._yolo_detector:
                self._yolo_detector.unload()
                self._yolo_detector = None
        except Exception:
            pass

        # 清理云台控制器
        try:
            if self._pan_tilt:
                self._pan_tilt.cleanup()
        except Exception:
            pass

        # 等待线程结束
        for thread in self._threads:
            try:
                if thread.is_alive():
                    thread.join(timeout=5)
            except Exception:
                pass

        # 清理设备
        for sensor in self.sensors.values():
            try:
                sensor.cleanup()
            except Exception:
                pass

        for actuator in self.actuators.values():
            try:
                actuator.cleanup()
            except Exception:
                pass

        # 发布停止事件
        self.event_bus.publish(Event(
            event_type=EventTypes.SYSTEM_STOP,
            source="system"
        ))

        logger.info("System stopped")

    def get_status(self) -> Dict[str, Any]:
        """获取系统状态"""
        return {
            "version": self.VERSION,
            "running": self.running,
            "project_root": self.project_root,
            "uptime": self._get_uptime(),
            "sensors": {k: self._safe_get_status(v) for k, v in self.sensors.items()},
            "actuators": {k: self._safe_get_status(v) for k, v in self.actuators.items()},
            "upload": self.upload.get_status() if self.upload else None,
            "heartbeat": self.heartbeat.get_status() if self.heartbeat else None,
            "ota": self.ota_manager.get_status() if self.ota_manager else None,
            "agent": self.agent.get_status() if self.agent else None,
            "yolo_models": (
                self.model_manager.get_manager_status() if self.model_manager else None
            ),
            "cache_count": self.cache.get_count() if self.cache else 0,
            "camera": self._camera.get_status() if self._camera else None,
            "video_stream": (
                self._video_stream_service.get_status()
                if self._video_stream_service
                else None
            ),
        }

    def _safe_get_status(self, device) -> Dict[str, Any]:
        """安全获取设备状态"""
        try:
            return device.get_status()
        except Exception as e:
            return {"error": str(e)}

    def _get_uptime(self) -> Optional[str]:
        """获取运行时长"""
        # 简单实现：返回 None，实际可记录启动时间
        return None

    def scan_devices(self):
        """执行设备扫描"""
        return self.scanner.scan_all()
