#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""OTA 升级模块 - 支持 HTTP 拉取和 Git Pull 双模式"""

from ota.manager import OTAManager, OTAStatus, UpdateInfo
from ota.http_updater import HTTPUpdater
from ota.git_updater import GitUpdater

__all__ = [
    "OTAManager",
    "OTAStatus",
    "UpdateInfo",
    "HTTPUpdater",
    "GitUpdater",
]
