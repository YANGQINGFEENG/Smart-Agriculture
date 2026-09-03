#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""日志管理"""

import os
import logging
import logging.handlers
from datetime import datetime


def setup_logger(
    name: str = "smart_farm",
    log_file: str = None,
    level: str = "INFO",
    max_bytes: int = 10 * 1024 * 1024,
    backup_count: int = 5
) -> logging.Logger:
    """
    配置日志系统

    Args:
        name: 日志器名称（保留参数以兼容旧调用，实际配置根 logger）
        log_file: 日志文件路径
        level: 日志级别
        max_bytes: 单个日志文件最大大小
        backup_count: 保留的日志文件数量
    """
    # 优先从环境变量读取日志级别
    env_level = os.environ.get("LOG_LEVEL", "").upper()
    effective_level = getattr(logging, env_level if env_level else level.upper(), logging.INFO)

    # 配置根 logger，确保所有子模块的 getLogger(__name__) 日志都被捕获
    root_logger = logging.getLogger()
    root_logger.setLevel(effective_level)

    # 防止重复添加 handler
    if root_logger.handlers:
        return root_logger

    # 日志格式 - 包含日期、级别、模块名
    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)-5s] [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # 控制台输出
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # 文件输出
    if log_file:
        os.makedirs(os.path.dirname(log_file), exist_ok=True)
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding="utf-8"
        )
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)

    return root_logger
