#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""心跳服务 - 向服务器定期发送心跳，汇报设备状态"""

import logging
import threading
import time
from typing import Dict, Any, Optional, Callable
from datetime import datetime

from core.config_manager import ConfigManager

logger = logging.getLogger(__name__)


class HeartbeatService:
    """心跳服务 - 周期性向服务器上报网关运行状态"""

    def __init__(self, config: ConfigManager, upload_service=None):
        """初始化心跳服务

        Args:
            config: 配置管理器
            upload_service: 上传服务实例（用于实际发送心跳）
        """
        self.config = config
        self.upload = upload_service
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._last_heartbeat_time: Optional[datetime] = None
        self._last_heartbeat_status: Optional[str] = None
        self._heartbeat_count: int = 0
        self._lock = threading.Lock()
        self._on_status_change: Optional[Callable[[str], None]] = None
        logger.info("HeartbeatService initialized")

    def set_status_callback(self, callback: Callable[[str], None]):
        """设置状态变化回调"""
        self._on_status_change = callback

    def _is_enabled(self) -> bool:
        """心跳是否启用"""
        return self.config.get("heartbeat.enabled", True)

    def _get_interval(self) -> int:
        """获取心跳间隔（秒）"""
        return self.config.get("heartbeat.interval", 30)

    def build_heartbeat_data(self, sensors: Dict, actuators: Dict) -> Dict[str, Any]:
        """构建心跳数据

        Args:
            sensors: 传感器字典 {id: sensor}
            actuators: 执行器字典 {id: actuator}

        Returns:
            心跳数据
        """
        # 统计设备状态
        online_sensors = 0
        offline_sensors = 0
        online_actuators = 0
        offline_actuators = 0

        for sensor in sensors.values():
            try:
                if hasattr(sensor, "_initialized") and sensor._initialized:
                    online_sensors += 1
                else:
                    offline_sensors += 1
            except Exception:
                offline_sensors += 1

        for actuator in actuators.values():
            try:
                if hasattr(actuator, "_initialized") and actuator._initialized:
                    online_actuators += 1
                else:
                    offline_actuators += 1
            except Exception:
                offline_actuators += 1

        return {
            "type": "heartbeat",
            "gateway_ip": self.config.get("upload.gateway_ip", ""),
            "farm_id": self.config.get("upload.farm_id", 1),
            "timestamp": datetime.now().isoformat(),
            "stats": {
                "sensors_total": len(sensors),
                "sensors_online": online_sensors,
                "sensors_offline": offline_sensors,
                "actuators_total": len(actuators),
                "actuators_online": online_actuators,
                "actuators_offline": offline_actuators,
            },
        }

    def send_heartbeat(self, sensors: Dict, actuators: Dict) -> bool:
        """发送一次心跳

        Args:
            sensors: 传感器字典
            actuators: 执行器字典

        Returns:
            是否发送成功
        """
        if not self._is_enabled():
            return True

        heartbeat_data = self.build_heartbeat_data(sensors, actuators)

        # 通过上传服务发送心跳（如果可用）
        success = True
        if self.upload:
            try:
                # 使用专门的 heartbeat 接口（如果服务器支持），否则复用 device/report
                server_url = self.config.get("upload.server_url", "").rstrip("/")
                if server_url:
                    import requests
                    resp = requests.post(
                        f"{server_url}/api/device/heartbeat",
                        json=heartbeat_data,
                        timeout=self.config.get("upload.timeout", 10),
                    )
                    success = resp.status_code in [200, 201, 404]  # 404 表示服务器未实现，视为成功
                    if resp.status_code == 404:
                        logger.debug("Heartbeat endpoint not implemented on server, skipping")
                        success = True
            except Exception as e:
                logger.warning(f"Heartbeat send failed: {e}")
                success = False

        with self._lock:
            self._last_heartbeat_time = datetime.now()
            self._last_heartbeat_status = "success" if success else "failed"
            self._heartbeat_count += 1

        if self._on_status_change:
            try:
                self._on_status_change(self._last_heartbeat_status)
            except Exception:
                pass

        logger.debug(
            f"Heartbeat #{self._heartbeat_count}: {self._last_heartbeat_status}"
        )
        return success

    def start(self, sensors_provider: Callable[[], Dict], actuators_provider: Callable[[], Dict]):
        """启动心跳服务

        Args:
            sensors_provider: 返回当前传感器字典的回调
            actuators_provider: 返回当前执行器字典的回调
        """
        if self._running:
            return
        self._running = True

        def heartbeat_loop():
            interval = self._get_interval()
            while self._running:
                try:
                    sensors = sensors_provider() or {}
                    actuators = actuators_provider() or {}
                    self.send_heartbeat(sensors, actuators)
                except Exception as e:
                    logger.error(f"Heartbeat loop error: {e}")
                # 动态获取间隔（支持配置热加载）
                time.sleep(self._get_interval())

        self._thread = threading.Thread(target=heartbeat_loop, daemon=True, name="heartbeat")
        self._thread.start()
        logger.info(f"Heartbeat service started (interval={self._get_interval()}s)")

    def stop(self):
        """停止心跳服务"""
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3)
        logger.info("Heartbeat service stopped")

    def get_status(self) -> Dict[str, Any]:
        """获取心跳服务状态"""
        with self._lock:
            return {
                "running": self._running,
                "enabled": self._is_enabled(),
                "interval": self._get_interval(),
                "count": self._heartbeat_count,
                "last_time": self._last_heartbeat_time.isoformat() if self._last_heartbeat_time else None,
                "last_status": self._last_heartbeat_status,
            }
