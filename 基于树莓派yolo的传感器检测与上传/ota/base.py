#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""OTA 升级基础类与数据结构"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
from typing import Any, Dict, Optional


class OTAStatus(Enum):
    """OTA 升级状态"""
    IDLE = "idle"                       # 空闲
    CHECKING = "checking"               # 检查更新中
    UPDATE_AVAILABLE = "update_available"  # 有可用更新
    NO_UPDATE = "no_update"             # 无可用更新
    DOWNLOADING = "downloading"         # 下载中
    BACKING_UP = "backing_up"           # 备份中
    INSTALLING = "installing"           # 安装中
    VERIFYING = "verifying"             # 验证中
    SUCCESS = "success"                 # 升级成功
    FAILED = "failed"                    # 升级失败
    ROLLBACK = "rollback"               # 回滚中


@dataclass
class UpdateInfo:
    """更新信息"""
    current_version: str = ""           # 当前版本
    latest_version: str = ""            # 最新版本
    release_notes: str = ""              # 更新说明
    download_url: str = ""              # 下载URL
    file_size: int = 0                  # 文件大小（字节）
    checksum: str = ""                  # 校验和
    published_at: Optional[datetime] = None  # 发布时间
    is_update_available: bool = False    # 是否有可用更新
    raw_info: Dict[str, Any] = field(default_factory=dict)  # 原始信息


class BaseUpdater(ABC):
    """升级器基类"""

    name: str = "base"

    def __init__(self, config: Dict[str, Any]):
        """初始化升级器

        Args:
            config: 升级器配置
        """
        self.config = config

    @abstractmethod
    def check_update(self) -> UpdateInfo:
        """检查是否有可用更新"""
        pass

    @abstractmethod
    def download(self, info: UpdateInfo, progress_callback=None) -> str:
        """下载更新包

        Args:
            info: 更新信息
            progress_callback: 进度回调 (received_bytes, total_bytes)

        Returns:
            下载文件的本地路径
        """
        pass

    @abstractmethod
    def install(self, downloaded_path: str) -> bool:
        """安装下载的更新包

        Args:
            downloaded_path: 下载文件的本地路径

        Returns:
            是否安装成功
        """
        pass

    @abstractmethod
    def verify(self) -> bool:
        """验证当前安装是否完整"""
        pass

    @abstractmethod
    def get_current_version(self) -> str:
        """获取当前版本号"""
        pass
