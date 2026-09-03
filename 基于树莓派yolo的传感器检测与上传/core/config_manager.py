#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配置管理器 - 统一配置加载与热加载"""

import os
import threading
import logging
import time
from typing import Any, Dict, List, Callable, Optional
import yaml

logger = logging.getLogger(__name__)


class ConfigManager:
    """配置管理器 - 支持热加载和回调通知"""

    def __init__(self, config_dir: str = None):
        """初始化配置管理器

        Args:
            config_dir: 配置目录路径，默认为项目根目录下的 config/
        """
        if config_dir is None:
            config_dir = os.path.join(os.path.dirname(__file__), "..", "config")
        self.config_dir = os.path.abspath(config_dir)
        self._config: Dict[str, Any] = {}
        self._file_mtimes: Dict[str, float] = {}
        self._change_callbacks: List[Callable[[List[str]], None]] = []
        self._watch_thread: Optional[threading.Thread] = None
        self._watching = False
        self._watch_interval = 5.0  # 配置文件监控间隔（秒）
        self._lock = threading.RLock()
        self._load_all()
        logger.info(f"ConfigManager initialized: dir={self.config_dir}")

    def _load_all(self):
        """加载所有配置文件"""
        config_files = ["settings.yaml", "sensors.yaml", "actuators.yaml"]

        for filename in config_files:
            filepath = os.path.join(self.config_dir, filename)
            if os.path.exists(filepath):
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        data = yaml.safe_load(f)
                    if data:
                        with self._lock:
                            self._config.update(data)
                        self._file_mtimes[filepath] = os.path.getmtime(filepath)
                        logger.info(f"Loaded config: {filename}")
                except Exception as e:
                    logger.error(f"Failed to load {filename}: {e}")

    def get(self, key: str, default: Any = None) -> Any:
        """获取配置值，支持点号分隔的嵌套键

        Args:
            key: 配置键，如 "upload.server_url" 或 "system.log_level"
            default: 默认值
        """
        with self._lock:
            keys = key.split(".")
            value = self._config
            for k in keys:
                if isinstance(value, dict) and k in value:
                    value = value[k]
                else:
                    return default
            return value

    def set(self, key: str, value: Any) -> bool:
        """设置配置值（仅内存，不持久化）

        Args:
            key: 配置键
            value: 配置值
        """
        with self._lock:
            keys = key.split(".")
            config = self._config
            for k in keys[:-1]:
                if k not in config or not isinstance(config[k], dict):
                    config[k] = {}
                config = config[k]
            config[keys[-1]] = value
            return True

    def update(self, key: str, value: Any) -> bool:
        """更新配置并持久化到对应文件

        Args:
            key: 顶级配置键（如 upload/server/system）
            value: 配置值
        """
        with self._lock:
            self._config[key] = value
            return self._save_section(key)

    def _save_section(self, section: str) -> bool:
        """保存配置段到对应的YAML文件"""
        section_to_file = {
            "system": "settings.yaml",
            "upload": "settings.yaml",
            "heartbeat": "settings.yaml",
            "cache": "settings.yaml",
            "device_mapping": "settings.yaml",
            "scanner": "settings.yaml",
            "ota": "settings.yaml",
            "ui": "settings.yaml",
            "sensors": "sensors.yaml",
            "actuators": "actuators.yaml",
        }
        filename = section_to_file.get(section, "settings.yaml")
        filepath = os.path.join(self.config_dir, filename)

        try:
            # 加载原始文件内容（避免覆盖其他段）
            existing = {}
            if os.path.exists(filepath):
                with open(filepath, "r", encoding="utf-8") as f:
                    existing = yaml.safe_load(f) or {}

            # 仅更新对应段
            existing[section] = self._config.get(section)

            with open(filepath, "w", encoding="utf-8") as f:
                yaml.dump(existing, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

            self._file_mtimes[filepath] = os.path.getmtime(filepath)
            logger.info(f"Config section '{section}' saved to {filename}")
            return True
        except Exception as e:
            logger.error(f"Failed to save section {section}: {e}")
            return False

    def get_sensors(self) -> List[Dict]:
        """获取传感器配置列表"""
        with self._lock:
            return self._config.get("sensors", [])

    def get_actuators(self) -> List[Dict]:
        """获取执行器配置列表"""
        with self._lock:
            return self._config.get("actuators", [])

    def reload(self) -> List[str]:
        """重新加载所有配置文件

        Returns:
            发生变化的配置段列表
        """
        changed = []
        with self._lock:
            for filepath, old_mtime in list(self._file_mtimes.items()):
                if not os.path.exists(filepath):
                    continue
                new_mtime = os.path.getmtime(filepath)
                if new_mtime != old_mtime:
                    changed.append(os.path.basename(filepath))
                    self._file_mtimes[filepath] = new_mtime

            if changed:
                self._config.clear()
                self._load_all()
                logger.info(f"Config reloaded, changed files: {changed}")

        # 触发回调
        if changed:
            for callback in self._change_callbacks:
                try:
                    callback(changed)
                except Exception as e:
                    logger.error(f"Config change callback error: {e}")

        return changed

    def on_change(self, callback: Callable[[List[str]], None]):
        """注册配置变更回调

        Args:
            callback: 回调函数，参数为发生变化的文件名列表
        """
        self._change_callbacks.append(callback)

    def start_watching(self, interval: float = 5.0):
        """启动配置文件监控（自动热加载）

        Args:
            interval: 检查间隔（秒）
        """
        if self._watching:
            return
        self._watching = True
        self._watch_interval = interval

        def watch_loop():
            while self._watching:
                try:
                    self.reload()
                except Exception as e:
                    logger.error(f"Config watch error: {e}")
                time.sleep(self._watch_interval)

        self._watch_thread = threading.Thread(target=watch_loop, daemon=True, name="config-watcher")
        self._watch_thread.start()
        logger.info(f"Config watching started (interval={interval}s)")

    def stop_watching(self):
        """停止配置文件监控"""
        self._watching = False
        if self._watch_thread and self._watch_thread.is_alive():
            self._watch_thread.join(timeout=2)
        logger.info("Config watching stopped")

    def to_dict(self) -> dict:
        """导出为字典"""
        with self._lock:
            import copy
            return copy.deepcopy(self._config)
