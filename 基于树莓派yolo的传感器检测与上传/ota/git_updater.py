#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Git Pull 模式升级器 - 通过 git pull 拉取最新代码"""

import os
import subprocess
import logging
from typing import Callable, Optional
from datetime import datetime

from ota.base import BaseUpdater, UpdateInfo

logger = logging.getLogger(__name__)


class GitUpdater(BaseUpdater):
    """Git Pull 模式升级器 - 通过 git 命令更新项目代码"""

    name = "git"

    def __init__(self, config: dict, project_root: str):
        """初始化 Git 升级器

        Args:
            config: 配置字典，包含：
                - branch: 要拉取的分支 (默认 main)
                - remote: 远程仓库名 (默认 origin)
                - reset_to_remote: 是否强制重置到远程 (默认 True，避免冲突)
            project_root: 项目根目录
        """
        super().__init__(config)
        self.project_root = os.path.abspath(project_root)
        self.branch = config.get("branch", "main")
        self.remote = config.get("remote", "origin")
        self.reset_to_remote = config.get("reset_to_remote", True)

    def _git(self, *args, cwd=None) -> subprocess.CompletedProcess:
        """执行 git 命令"""
        cmd = ["git"] + list(args)
        cwd = cwd or self.project_root
        logger.debug(f"Executing: {' '.join(cmd)} (cwd={cwd})")
        return subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=120,
        )

    def _is_git_repo(self) -> bool:
        """检查是否为 git 仓库"""
        result = self._git("rev-parse", "--is-inside-work-tree")
        return result.returncode == 0 and result.stdout.strip() == "true"

    def get_current_version(self) -> str:
        """获取当前版本号

        优先级：
        1. VERSION 文件
        2. git commit hash
        """
        # 优先读取 VERSION 文件
        version_file = os.path.join(self.project_root, "VERSION")
        if os.path.exists(version_file):
            try:
                with open(version_file, "r", encoding="utf-8") as f:
                    version = f.read().strip()
                    if version:
                        return version
            except Exception:
                pass

        # 否则使用 git commit hash
        if self._is_git_repo():
            result = self._git("rev-parse", "--short", "HEAD")
            if result.returncode == 0:
                return result.stdout.strip()
        return "unknown"

    def check_update(self) -> UpdateInfo:
        """检查是否有可用更新

        通过 git fetch + 比较 commit hash 判断是否有更新
        """
        info = UpdateInfo(current_version=self.get_current_version())

        if not self._is_git_repo():
            logger.warning("Not a git repository, cannot check for updates via git")
            return info

        # 获取当前 commit
        result = self._git("rev-parse", "HEAD")
        if result.returncode != 0:
            logger.error(f"Get current commit failed: {result.stderr}")
            return info
        current_commit = result.stdout.strip()
        info.raw_info["current_commit"] = current_commit

        # 拉取远程更新（仅 fetch，不合并）
        logger.info(f"Fetching from {self.remote}/{self.branch}")
        result = self._git("fetch", self.remote, self.branch)
        if result.returncode != 0:
            logger.error(f"Git fetch failed: {result.stderr}")
            return info

        # 比较本地和远程的 commit
        result = self._git("rev-parse", f"{self.remote}/{self.branch}")
        if result.returncode != 0:
            logger.error(f"Get remote commit failed: {result.stderr}")
            return info
        remote_commit = result.stdout.strip()
        info.raw_info["remote_commit"] = remote_commit

        if remote_commit != current_commit:
            info.is_update_available = True
            info.latest_version = remote_commit[:7]

            # 获取 commit log 作为 release notes
            log_result = self._git(
                "log", "--oneline", f"HEAD..{self.remote}/{self.branch}"
            )
            if log_result.returncode == 0:
                info.release_notes = log_result.stdout.strip()
            logger.info(f"Update available: {current_commit[:7]} -> {remote_commit[:7]}")
        else:
            logger.info("No update available (already up to date)")

        return info

    def download(self, info: UpdateInfo,
                 progress_callback: Optional[Callable[[int, int], None]] = None) -> str:
        """下载更新（git 模式下不需要单独下载）

        Args:
            info: 更新信息
            progress_callback: 进度回调（git 模式忽略）

        Returns:
            空字符串（git 模式不需要）
        """
        # git 模式下 fetch 已经在 check_update 中完成
        # 不需要单独的下载步骤
        return ""

    def install(self, downloaded_path: str = "") -> bool:
        """安装更新（执行 git pull / reset）

        Args:
            downloaded_path: 忽略（git 模式不需要）

        Returns:
            是否安装成功
        """
        if not self._is_git_repo():
            logger.error("Not a git repository, cannot install via git")
            return False

        try:
            if self.reset_to_remote:
                # 强制重置到远程分支（避免本地修改冲突）
                logger.info(f"Resetting to {self.remote}/{self.branch}")
                result = self._git("reset", "--hard", f"{self.remote}/{self.branch}")
                if result.returncode != 0:
                    logger.error(f"Git reset failed: {result.stderr}")
                    return False
            else:
                # 普通合并
                logger.info(f"Pulling {self.remote}/{self.branch}")
                result = self._git("pull", self.remote, self.branch)
                if result.returncode != 0:
                    logger.error(f"Git pull failed: {result.stderr}")
                    return False

            # 更新子模块（如果有）
            result = self._git("submodule", "update", "--init", "--recursive")
            if result.returncode != 0:
                logger.warning(f"Submodule update warning: {result.stderr}")

            logger.info("Git install complete")
            return True
        except Exception as e:
            logger.error(f"Git install error: {e}")
            return False

    def verify(self) -> bool:
        """验证当前安装是否完整"""
        try:
            original_dir = os.getcwd()
            os.chdir(self.project_root)

            # 检查关键文件
            required_files = ["main.py", "config/settings.yaml"]
            for f in required_files:
                if not os.path.exists(f):
                    logger.error(f"Required file missing: {f}")
                    return False

            # 尝试导入关键模块
            import importlib
            try:
                importlib.import_module("core.config_manager")
                importlib.import_module("services.upload_service")
                logger.info("Git verification passed")
                return True
            except Exception as e:
                logger.error(f"Module verification failed: {e}")
                return False
        finally:
            os.chdir(original_dir)

    def backup_current(self) -> str:
        """备份当前代码（git 模式下使用 stash 或 commit hash）"""
        if not self._is_git_repo():
            logger.warning("Not a git repository, skip backup")
            return ""

        # 记录当前 commit hash，用于回滚
        result = self._git("rev-parse", "HEAD")
        if result.returncode == 0:
            backup_commit = result.stdout.strip()
            backup_path = os.path.join(self.project_root, ".backup", "git_backup_commit.txt")
            os.makedirs(os.path.dirname(backup_path), exist_ok=True)
            with open(backup_path, "w", encoding="utf-8") as f:
                f.write(backup_commit)
            logger.info(f"Backup current commit: {backup_commit}")
            return backup_commit
        return ""

    def rollback(self, backup_path: str = None) -> bool:
        """从备份回滚（git reset 到备份的 commit）"""
        if not self._is_git_repo():
            logger.error("Not a git repository, cannot rollback")
            return False

        if backup_path is None:
            # 从文件读取备份的 commit
            backup_file = os.path.join(self.project_root, ".backup", "git_backup_commit.txt")
            if not os.path.exists(backup_file):
                logger.error("No backup commit found")
                return False
            with open(backup_file, "r", encoding="utf-8") as f:
                backup_path = f.read().strip()

        if not backup_path:
            logger.error("Invalid backup commit")
            return False

        try:
            logger.info(f"Rolling back to commit: {backup_path}")
            result = self._git("reset", "--hard", backup_path)
            if result.returncode != 0:
                logger.error(f"Git rollback failed: {result.stderr}")
                return False
            logger.info("Git rollback complete")
            return True
        except Exception as e:
            logger.error(f"Git rollback error: {e}")
            return False
