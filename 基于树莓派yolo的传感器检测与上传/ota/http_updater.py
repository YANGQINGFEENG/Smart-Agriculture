#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""HTTP 模式升级器 - 从远程服务器拉取新版本代码包"""

import os
import shutil
import hashlib
import tarfile
import zipfile
import tempfile
import logging
import requests
from typing import Callable, Optional
from datetime import datetime

from ota.base import BaseUpdater, UpdateInfo

logger = logging.getLogger(__name__)


class HTTPUpdater(BaseUpdater):
    """HTTP 模式升级器 - 从配置的 URL 下载新版本代码包并安装"""

    name = "http"

    def __init__(self, config: dict, project_root: str):
        """初始化 HTTP 升级器

        Args:
            config: 配置字典，包含：
                - manifest_url: 版本清单URL（GET 请求获取最新版本信息）
                - timeout: 请求超时
                - verify_ssl: 是否验证 SSL
            project_root: 项目根目录
        """
        super().__init__(config)
        self.project_root = os.path.abspath(project_root)
        self.manifest_url = config.get("manifest_url", "")
        self.timeout = config.get("timeout", 30)
        self.verify_ssl = config.get("verify_ssl", True)
        self.backup_dir = os.path.join(self.project_root, ".backup")
        self.download_dir = os.path.join(self.project_root, ".downloads")
        os.makedirs(self.download_dir, exist_ok=True)

    def get_current_version(self) -> str:
        """获取当前版本号（从 VERSION 文件读取）"""
        version_file = os.path.join(self.project_root, "VERSION")
        if os.path.exists(version_file):
            try:
                with open(version_file, "r", encoding="utf-8") as f:
                    return f.read().strip()
            except Exception:
                pass
        return "1.0.0"

    def check_update(self) -> UpdateInfo:
        """检查是否有可用更新

        Returns:
            UpdateInfo 对象
        """
        info = UpdateInfo(current_version=self.get_current_version())

        if not self.manifest_url:
            logger.warning("Manifest URL not configured, cannot check for updates")
            return info

        try:
            logger.info(f"Checking for updates from {self.manifest_url}")
            resp = requests.get(
                self.manifest_url,
                timeout=self.timeout,
                verify=self.verify_ssl,
            )
            if resp.status_code != 200:
                logger.error(f"Check update failed: status={resp.status_code}")
                return info

            data = resp.json()
            info.latest_version = data.get("version", "")
            info.release_notes = data.get("release_notes", "")
            info.download_url = data.get("download_url", "")
            info.file_size = data.get("file_size", 0)
            info.checksum = data.get("checksum", "")
            published_at = data.get("published_at")
            if published_at:
                try:
                    info.published_at = datetime.fromisoformat(published_at)
                except Exception:
                    pass
            info.raw_info = data

            # 比较版本号（简单字符串比较，建议遵循 semver）
            if info.latest_version and info.latest_version != info.current_version:
                info.is_update_available = True
                logger.info(
                    f"Update available: {info.current_version} -> {info.latest_version}"
                )
            else:
                logger.info(f"No update available (current={info.current_version})")

        except Exception as e:
            logger.error(f"Check update error: {e}")

        return info

    def download(self, info: UpdateInfo,
                 progress_callback: Optional[Callable[[int, int], None]] = None) -> str:
        """下载更新包

        Args:
            info: 更新信息
            progress_callback: 进度回调 (received_bytes, total_bytes)

        Returns:
            下载文件的本地路径
        """
        if not info.download_url:
            logger.error("Download URL not available")
            return ""

        # 清理旧的下载文件
        for f in os.listdir(self.download_dir):
            try:
                os.remove(os.path.join(self.download_dir, f))
            except Exception:
                pass

        # 构造本地文件路径
        url_path = info.download_url.split("/")[-1].split("?")[0]
        if not url_path:
            url_path = "update.tar.gz"
        local_path = os.path.join(self.download_dir, url_path)

        try:
            logger.info(f"Downloading {info.download_url} -> {local_path}")
            resp = requests.get(
                info.download_url,
                stream=True,
                timeout=self.timeout,
                verify=self.verify_ssl,
            )
            if resp.status_code != 200:
                logger.error(f"Download failed: status={resp.status_code}")
                return ""

            total = int(resp.headers.get("Content-Length", info.file_size or 0))
            received = 0
            with open(local_path, "wb") as f:
                for chunk in resp.iter_content(chunk_size=64 * 1024):
                    if chunk:
                        f.write(chunk)
                        received += len(chunk)
                        if progress_callback:
                            try:
                                progress_callback(received, total)
                            except Exception:
                                pass

            # 校验和验证
            if info.checksum:
                actual = self._compute_checksum(local_path)
                if actual != info.checksum:
                    logger.error(
                        f"Checksum mismatch: expected={info.checksum}, actual={actual}"
                    )
                    os.remove(local_path)
                    return ""

            logger.info(f"Download complete: {local_path} ({received} bytes)")
            return local_path

        except Exception as e:
            logger.error(f"Download error: {e}")
            return ""

    def _compute_checksum(self, filepath: str, algorithm: str = "sha256") -> str:
        """计算文件校验和"""
        h = hashlib.new(algorithm)
        with open(filepath, "rb") as f:
            while True:
                chunk = f.read(64 * 1024)
                if not chunk:
                    break
                h.update(chunk)
        return h.hexdigest()

    def install(self, downloaded_path: str) -> bool:
        """安装下载的更新包

        Args:
            downloaded_path: 下载文件的本地路径

        Returns:
            是否安装成功
        """
        if not os.path.exists(downloaded_path):
            logger.error(f"Download file not found: {downloaded_path}")
            return False

        try:
            # 解压到临时目录
            with tempfile.TemporaryDirectory(prefix="ota_install_") as tmp_dir:
                logger.info(f"Extracting {downloaded_path} -> {tmp_dir}")
                if downloaded_path.endswith((".tar.gz", ".tgz")):
                    with tarfile.open(downloaded_path, "r:gz") as tar:
                        tar.extractall(tmp_dir)
                elif downloaded_path.endswith(".zip"):
                    with zipfile.ZipFile(downloaded_path, "r") as zf:
                        zf.extractall(tmp_dir)
                else:
                    logger.error(f"Unsupported archive format: {downloaded_path}")
                    return False

                # 检查解压后的根目录（有些包有顶层目录）
                entries = os.listdir(tmp_dir)
                if not entries:
                    logger.error("Empty archive")
                    return False
                src_dir = tmp_dir
                if len(entries) == 1 and os.path.isdir(os.path.join(tmp_dir, entries[0])):
                    src_dir = os.path.join(tmp_dir, entries[0])

                # 复制新代码到项目目录（覆盖现有文件）
                logger.info(f"Installing files from {src_dir} -> {self.project_root}")
                self._sync_directory(src_dir, self.project_root)

            # 更新版本文件
            version_file = os.path.join(self.project_root, "VERSION")
            try:
                with open(version_file, "r", encoding="utf-8") as f:
                    new_version = f.read().strip()
                logger.info(f"Installed version: {new_version}")
            except Exception:
                pass

            logger.info("Installation complete")
            return True

        except Exception as e:
            logger.error(f"Install error: {e}")
            return False

    def _sync_directory(self, src: str, dst: str):
        """同步目录内容（覆盖目标目录）"""
        for item in os.listdir(src):
            src_path = os.path.join(src, item)
            dst_path = os.path.join(dst, item)

            if os.path.isdir(src_path):
                # 跳过 .git, __pycache__, .backup, .downloads, logs, data 等目录
                if item in [".git", "__pycache__", ".backup", ".downloads", "logs", "data",
                            ".venv", "venv", ".mimocode"]:
                    continue
                if not os.path.exists(dst_path):
                    os.makedirs(dst_path, exist_ok=True)
                self._sync_directory(src_path, dst_path)
            else:
                # 跳过 VERSION 文件（已经在 install 中处理）
                shutil.copy2(src_path, dst_path)

    def verify(self) -> bool:
        """验证当前安装是否完整

        通过尝试导入关键模块来验证
        """
        try:
            # 切换到项目目录
            original_dir = os.getcwd()
            os.chdir(self.project_root)

            # 验证关键文件存在
            required_files = ["main.py", "config/settings.yaml"]
            for f in required_files:
                if not os.path.exists(f):
                    logger.error(f"Required file missing: {f}")
                    return False

            # 验证可以导入关键模块
            import importlib
            try:
                importlib.import_module("core.config_manager")
                importlib.import_module("services.upload_service")
                logger.info("Verification passed")
                return True
            except Exception as e:
                logger.error(f"Module verification failed: {e}")
                return False
        finally:
            os.chdir(original_dir)

    def backup_current(self) -> str:
        """备份当前项目代码

        Returns:
            备份目录路径
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = os.path.join(self.backup_dir, f"backup_{timestamp}")

        os.makedirs(self.backup_dir, exist_ok=True)
        # 清理旧的备份（只保留最近 3 个）
        self._cleanup_old_backups(keep=3)

        logger.info(f"Backing up project to {backup_path}")
        # 复制项目代码到备份目录（排除不需要备份的目录）
        os.makedirs(backup_path, exist_ok=True)
        self._copy_directory(self.project_root, backup_path, exclude=[
            ".git", "__pycache__", ".backup", ".downloads", "logs", "data",
            ".venv", "venv", ".mimocode", "3.程序案例", "7.树莓派电子资料",
        ])
        logger.info(f"Backup complete: {backup_path}")
        return backup_path

    def _copy_directory(self, src: str, dst: str, exclude: list = None):
        """递归复制目录"""
        exclude = set(exclude or [])
        for item in os.listdir(src):
            if item in exclude:
                continue
            src_path = os.path.join(src, item)
            dst_path = os.path.join(dst, item)
            if os.path.isdir(src_path):
                os.makedirs(dst_path, exist_ok=True)
                self._copy_directory(src_path, dst_path, exclude)
            else:
                shutil.copy2(src_path, dst_path)

    def _cleanup_old_backups(self, keep: int = 3):
        """清理旧的备份，仅保留最近 N 个"""
        if not os.path.exists(self.backup_dir):
            return
        backups = [
            (entry, os.path.getmtime(os.path.join(self.backup_dir, entry)))
            for entry in os.listdir(self.backup_dir)
            if entry.startswith("backup_")
        ]
        backups.sort(key=lambda x: x[1], reverse=True)  # 按时间降序
        for entry, _ in backups[keep:]:
            try:
                shutil.rmtree(os.path.join(self.backup_dir, entry))
                logger.info(f"Removed old backup: {entry}")
            except Exception as e:
                logger.warning(f"Remove old backup {entry} failed: {e}")

    def rollback(self, backup_path: str = None) -> bool:
        """从备份回滚

        Args:
            backup_path: 备份目录路径，如不指定则使用最新的备份
        """
        if backup_path is None:
            # 找到最新的备份
            if not os.path.exists(self.backup_dir):
                logger.error("No backup available for rollback")
                return False
            backups = sorted(
                [d for d in os.listdir(self.backup_dir) if d.startswith("backup_")],
                reverse=True,
            )
            if not backups:
                logger.error("No backup available for rollback")
                return False
            backup_path = os.path.join(self.backup_dir, backups[0])

        if not os.path.exists(backup_path):
            logger.error(f"Backup not found: {backup_path}")
            return False

        try:
            logger.info(f"Rolling back from {backup_path}")
            self._copy_directory(backup_path, self.project_root)
            logger.info("Rollback complete")
            return True
        except Exception as e:
            logger.error(f"Rollback error: {e}")
            return False
