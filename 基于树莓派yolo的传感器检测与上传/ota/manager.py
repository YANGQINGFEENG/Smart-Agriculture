#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""OTA 管理器 - 统一调度升级流程，支持自动备份和回滚"""

import logging
import threading
import time
import os
import sys
from typing import Callable, Optional, Dict, Any, List
from datetime import datetime

from core.config_manager import ConfigManager
from ota.base import BaseUpdater, OTAStatus, UpdateInfo
from ota.http_updater import HTTPUpdater
from ota.git_updater import GitUpdater

logger = logging.getLogger(__name__)


class OTAManager:
    """OTA 升级管理器 - 统一管理升级流程

    支持两种升级模式：
    1. HTTP 模式：从配置的 manifest URL 下载新版本代码包
    2. Git 模式：通过 git pull 拉取最新代码

    工作流程：
    1. 检查更新 (check_update)
    2. 备份当前版本 (backup)
    3. 下载新版本 (download, 仅 HTTP 模式)
    4. 安装新版本 (install)
    5. 验证安装 (verify)
    6. 如果验证失败，自动回滚 (rollback)
    """

    def __init__(self, config: ConfigManager, project_root: str = None):
        """初始化 OTA 管理器

        Args:
            config: 配置管理器
            project_root: 项目根目录（默认为当前文件所在目录的上一级）
        """
        self.config = config
        self.project_root = os.path.abspath(project_root or os.path.dirname(os.path.dirname(__file__)))

        # 初始化升级器
        self._updaters: Dict[str, BaseUpdater] = {}
        self._init_updaters()

        # 状态
        self._status: OTAStatus = OTAStatus.IDLE
        self._last_update_info: Optional[UpdateInfo] = None
        self._last_error: Optional[str] = None
        self._last_success_time: Optional[datetime] = None
        self._lock = threading.Lock()

        # 自动检查更新线程
        self._auto_check_thread: Optional[threading.Thread] = None
        self._auto_checking = False

        # 进度回调
        self._progress_callbacks: List[Callable[[str, str, Dict], None]] = []

        # 重启回调
        self._restart_callback: Optional[Callable[[], None]] = None

        logger.info(
            f"OTAManager initialized, enabled updaters: {list(self._updaters.keys())}"
        )

    def _init_updaters(self):
        """初始化升级器"""
        ota_config = self.config.get("ota", {}) or {}
        primary_mode = ota_config.get("mode", "http")  # 默认 HTTP 模式

        # 初始化 HTTP 升级器
        http_config = ota_config.get("http", {})
        if http_config.get("manifest_url"):
            self._updaters["http"] = HTTPUpdater(http_config, self.project_root)
            logger.info("HTTP updater initialized")

        # 初始化 Git 升级器
        git_config = ota_config.get("git", {})
        git_enabled = git_config.get("enabled", False)
        if git_enabled:
            # 检查是否为 git 仓库
            test_updater = GitUpdater(git_config, self.project_root)
            if test_updater._is_git_repo():
                self._updaters["git"] = test_updater
                logger.info("Git updater initialized")
            else:
                logger.warning("Git updater enabled but not a git repository, skip")

        # 设置默认升级器
        if primary_mode in self._updaters:
            self._primary_mode = primary_mode
        elif self._updaters:
            self._primary_mode = next(iter(self._updaters.keys()))
        else:
            self._primary_mode = None
            logger.warning("No updater available, OTA will not work")

    def add_progress_callback(self, callback: Callable[[str, str, Dict], None]):
        """添加进度回调

        Args:
            callback: 回调函数 (status, message, data)
        """
        self._progress_callbacks.append(callback)

    def set_restart_callback(self, callback: Callable[[], None]):
        """设置重启回调

        Args:
            callback: 升级成功后的重启回调
        """
        self._restart_callback = callback

    def _notify_progress(self, message: str, data: Dict = None):
        """通知进度"""
        data = data or {}
        for callback in self._progress_callbacks:
            try:
                callback(self._status.value, message, data)
            except Exception as e:
                logger.error(f"Progress callback error: {e}")

    def _set_status(self, status: OTAStatus):
        """设置状态"""
        self._status = status
        logger.info(f"OTA status: {status.value}")

    def get_status(self) -> Dict[str, Any]:
        """获取当前 OTA 状态"""
        with self._lock:
            return {
                "status": self._status.value,
                "primary_mode": self._primary_mode,
                "enabled_modes": list(self._updaters.keys()),
                "current_version": self.get_current_version(),
                "last_error": self._last_error,
                "last_success_time": self._last_success_time.isoformat() if self._last_success_time else None,
                "last_update_info": self._last_update_info.__dict__ if self._last_update_info else None,
                "auto_check_enabled": self._auto_checking,
                "auto_check_interval": self.config.get("ota.auto_check_interval", 3600),
            }

    def get_current_version(self) -> str:
        """获取当前版本号"""
        if self._primary_mode and self._primary_mode in self._updaters:
            return self._updaters[self._primary_mode].get_current_version()
        return "unknown"

    def check_update(self) -> UpdateInfo:
        """检查更新"""
        with self._lock:
            self._set_status(OTAStatus.CHECKING)
            self._last_error = None

        if not self._primary_mode or self._primary_mode not in self._updaters:
            self._last_error = "No updater available"
            self._set_status(OTAStatus.IDLE)
            return UpdateInfo()

        try:
            updater = self._updaters[self._primary_mode]
            self._notify_progress("正在检查更新...")
            info = updater.check_update()
            self._last_update_info = info

            if info.is_update_available:
                self._set_status(OTAStatus.UPDATE_AVAILABLE)
                self._notify_progress(
                    f"发现新版本: {info.latest_version}",
                    {"version": info.latest_version, "notes": info.release_notes[:500]},
                )
            else:
                self._set_status(OTAStatus.NO_UPDATE)
                self._notify_progress("当前已是最新版本")
            return info
        except Exception as e:
            self._last_error = str(e)
            logger.error(f"Check update error: {e}")
            self._set_status(OTAStatus.FAILED)
            self._notify_progress(f"检查更新失败: {e}")
            return UpdateInfo()
        finally:
            with self._lock:
                if self._status in [OTAStatus.UPDATE_AVAILABLE, OTAStatus.NO_UPDATE]:
                    # 短暂等待后回到 IDLE
                    pass

    def perform_update(self, info: UpdateInfo = None) -> bool:
        """执行完整的升级流程

        Args:
            info: 更新信息，如不指定则先 check_update

        Returns:
            是否升级成功
        """
        with self._lock:
            if self._status not in [
                OTAStatus.IDLE,
                OTAStatus.UPDATE_AVAILABLE,
                OTAStatus.NO_UPDATE,
                OTAStatus.FAILED,
            ]:
                logger.warning(f"Cannot start update, current status: {self._status.value}")
                return False

        if not self._primary_mode or self._primary_mode not in self._updaters:
            self._last_error = "No updater available"
            return False

        updater = self._updaters[self._primary_mode]

        try:
            # 1. 检查更新
            if info is None or not info.is_update_available:
                self._notify_progress("正在检查更新...")
                info = updater.check_update()
                self._last_update_info = info
                if not info.is_update_available:
                    self._notify_progress("没有可用更新")
                    self._set_status(OTAStatus.NO_UPDATE)
                    return True

            # 2. 备份当前版本
            self._set_status(OTAStatus.BACKING_UP)
            self._notify_progress("正在备份当前版本...")
            backup_path = updater.backup_current()
            if not backup_path:
                logger.warning("Backup failed, continuing anyway")
                self._notify_progress("备份失败，继续升级...")

            # 3. 下载新版本（仅 HTTP 模式需要）
            downloaded_path = ""
            if self._primary_mode == "http":
                self._set_status(OTAStatus.DOWNLOADING)
                self._notify_progress("正在下载新版本...")

                def progress_cb(received, total):
                    if total > 0:
                        percent = int(received * 100 / total)
                        self._notify_progress(
                            f"下载中: {percent}% ({received}/{total} 字节)",
                            {"received": received, "total": total, "percent": percent},
                        )

                downloaded_path = updater.download(info, progress_callback=progress_cb)
                if not downloaded_path:
                    self._last_error = "Download failed"
                    self._set_status(OTAStatus.FAILED)
                    self._notify_progress("下载失败")
                    return False

            # 4. 安装新版本
            self._set_status(OTAStatus.INSTALLING)
            self._notify_progress("正在安装新版本...")
            if not updater.install(downloaded_path):
                self._last_error = "Install failed"
                self._set_status(OTAStatus.FAILED)
                self._notify_progress("安装失败")
                # 自动回滚
                if backup_path:
                    self._set_status(OTAStatus.ROLLBACK)
                    self._notify_progress("正在回滚...")
                    updater.rollback(backup_path)
                return False

            # 5. 验证安装
            self._set_status(OTAStatus.VERIFYING)
            self._notify_progress("正在验证安装...")
            if not updater.verify():
                self._last_error = "Verification failed"
                self._set_status(OTAStatus.FAILED)
                self._notify_progress("验证失败，正在回滚...")
                if backup_path:
                    updater.rollback(backup_path)
                return False

            # 6. 升级成功
            self._set_status(OTAStatus.SUCCESS)
            self._last_success_time = datetime.now()
            self._last_error = None
            self._notify_progress(
                f"升级成功，新版本: {self.get_current_version()}"
            )

            # 7. 通知重启（如果有回调）
            if self._restart_callback:
                self._notify_progress("即将重启服务...")
                # 在新线程中执行重启，避免阻塞当前流程
                threading.Timer(2.0, self._restart_callback).start()

            return True

        except Exception as e:
            self._last_error = str(e)
            self._set_status(OTAStatus.FAILED)
            logger.error(f"Update failed: {e}")
            self._notify_progress(f"升级失败: {e}")
            return False
        finally:
            # 回到 IDLE 状态
            if self._status in [OTAStatus.SUCCESS, OTAStatus.FAILED]:
                threading.Timer(5.0, lambda: self._set_status(OTAStatus.IDLE)).start()

    def rollback(self) -> bool:
        """手动触发回滚"""
        if not self._primary_mode or self._primary_mode not in self._updaters:
            return False

        updater = self._updaters[self._primary_mode]
        self._set_status(OTAStatus.ROLLBACK)
        self._notify_progress("正在回滚...")
        try:
            success = updater.rollback()
            if success:
                self._notify_progress("回滚成功")
                self._set_status(OTAStatus.IDLE)
                if self._restart_callback:
                    threading.Timer(2.0, self._restart_callback).start()
            else:
                self._last_error = "Rollback failed"
                self._set_status(OTAStatus.FAILED)
                self._notify_progress("回滚失败")
            return success
        except Exception as e:
            self._last_error = str(e)
            logger.error(f"Rollback error: {e}")
            return False

    def start_auto_check(self):
        """启动自动检查更新"""
        if self._auto_checking:
            return
        self._auto_checking = True
        interval = self.config.get("ota.auto_check_interval", 3600)

        def check_loop():
            while self._auto_checking:
                try:
                    if self._status == OTAStatus.IDLE:
                        info = self.check_update()
                        if info.is_update_available:
                            # 通知用户有新版本（不自动升级）
                            self._notify_progress(
                                f"发现新版本: {info.latest_version}",
                                {"auto_check": True},
                            )
                            # 如果配置了自动升级，则自动执行
                            if self.config.get("ota.auto_update", False):
                                logger.info("Auto-update enabled, starting update...")
                                self.perform_update(info)
                except Exception as e:
                    logger.error(f"Auto check error: {e}")
                # 等待下一次检查
                for _ in range(int(interval)):
                    if not self._auto_checking:
                        return
                    time.sleep(1)

        self._auto_check_thread = threading.Thread(target=check_loop, daemon=True, name="ota-checker")
        self._auto_check_thread.start()
        logger.info(f"OTA auto-check started (interval={interval}s)")

    def stop_auto_check(self):
        """停止自动检查"""
        self._auto_checking = False
        if self._auto_check_thread and self._auto_check_thread.is_alive():
            self._auto_check_thread.join(timeout=3)
        logger.info("OTA auto-check stopped")
