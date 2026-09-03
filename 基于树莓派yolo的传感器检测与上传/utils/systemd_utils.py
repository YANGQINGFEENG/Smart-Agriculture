#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Systemd 服务管理工具 - 用于管理开机自启服务"""

import subprocess
import os
import logging

logger = logging.getLogger(__name__)

SERVICE_NAME = "smart-farm"
SERVICE_FILE = "/etc/systemd/system/smart-farm.service"


def is_systemd_available() -> bool:
    """检查系统是否支持 systemd"""
    try:
        result = subprocess.run(
            ["systemctl", "--version"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def is_service_installed() -> bool:
    """检查服务文件是否已安装"""
    return os.path.exists(SERVICE_FILE)


def is_service_enabled() -> bool:
    """检查服务是否已启用开机自启"""
    if not is_systemd_available():
        return False

    try:
        result = subprocess.run(
            ["systemctl", "is-enabled", SERVICE_NAME],
            capture_output=True,
            text=True,
            timeout=5,
        )
        return result.returncode == 0 and result.stdout.strip() == "enabled"
    except Exception as e:
        logger.error(f"检查服务启用状态失败: {e}")
        return False


def is_service_running() -> bool:
    """检查服务是否正在运行"""
    if not is_systemd_available():
        return False

    try:
        result = subprocess.run(
            ["systemctl", "is-active", SERVICE_NAME],
            capture_output=True,
            text=True,
            timeout=5,
        )
        return result.returncode == 0 and result.stdout.strip() == "active"
    except Exception as e:
        logger.error(f"检查服务运行状态失败: {e}")
        return False


def enable_service() -> bool:
    """启用服务开机自启"""
    if not is_systemd_available():
        logger.warning("系统不支持 systemd")
        return False

    try:
        # 先重新加载 systemd 配置
        subprocess.run(
            ["systemctl", "daemon-reload"],
            capture_output=True,
            timeout=10,
            check=True,
        )
        # 启用开机自启
        result = subprocess.run(
            ["systemctl", "enable", SERVICE_NAME],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            logger.info("服务开机自启已启用")
            return True
        else:
            logger.error(f"启用服务失败: {result.stderr}")
            return False
    except Exception as e:
        logger.error(f"启用服务异常: {e}")
        return False


def disable_service() -> bool:
    """禁用服务开机自启"""
    if not is_systemd_available():
        return False

    try:
        result = subprocess.run(
            ["systemctl", "disable", SERVICE_NAME],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            logger.info("服务开机自启已禁用")
            return True
        else:
            logger.error(f"禁用服务失败: {result.stderr}")
            return False
    except Exception as e:
        logger.error(f"禁用服务异常: {e}")
        return False


def start_service() -> bool:
    """启动服务"""
    if not is_systemd_available():
        return False

    try:
        result = subprocess.run(
            ["systemctl", "start", SERVICE_NAME],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            logger.info("服务已启动")
            return True
        else:
            logger.error(f"启动服务失败: {result.stderr}")
            return False
    except Exception as e:
        logger.error(f"启动服务异常: {e}")
        return False


def stop_service() -> bool:
    """停止服务"""
    if not is_systemd_available():
        return False

    try:
        result = subprocess.run(
            ["systemctl", "stop", SERVICE_NAME],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            logger.info("服务已停止")
            return True
        else:
            logger.error(f"停止服务失败: {result.stderr}")
            return False
    except Exception as e:
        logger.error(f"停止服务异常: {e}")
        return False


def restart_service() -> bool:
    """重启服务"""
    if not is_systemd_available():
        return False

    try:
        result = subprocess.run(
            ["systemctl", "restart", SERVICE_NAME],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            logger.info("服务已重启")
            return True
        else:
            logger.error(f"重启服务失败: {result.stderr}")
            return False
    except Exception as e:
        logger.error(f"重启服务异常: {e}")
        return False


def get_service_status() -> str:
    """获取服务状态描述"""
    if not is_systemd_available():
        return "不支持 systemd"

    if not is_service_installed():
        return "服务未安装"

    if is_service_running():
        return "运行中"

    return "已停止"


def install_service_file(service_template_path: str) -> bool:
    """安装服务文件到系统目录"""
    if not os.path.exists(service_template_path):
        logger.error(f"服务模板文件不存在: {service_template_path}")
        return False

    try:
        # 读取模板内容
        with open(service_template_path, "r", encoding="utf-8") as f:
            content = f.read()

        # 写入系统目录（需要 sudo 权限）
        result = subprocess.run(
            ["sudo", "tee", SERVICE_FILE],
            input=content,
            text=True,
            capture_output=True,
            timeout=10,
        )
        if result.returncode == 0:
            logger.info(f"服务文件已安装到 {SERVICE_FILE}")
            # 设置权限
            subprocess.run(["sudo", "chmod", "644", SERVICE_FILE], timeout=5)
            # 重新加载 systemd
            subprocess.run(["systemctl", "daemon-reload"], timeout=5)
            return True
        else:
            logger.error(f"安装服务文件失败: {result.stderr}")
            return False
    except Exception as e:
        logger.error(f"安装服务文件异常: {e}")
        return False
