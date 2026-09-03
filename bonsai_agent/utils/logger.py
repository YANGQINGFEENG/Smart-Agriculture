"""bonsai_agent 统一日志模块"""
import os
import logging


def get_logger(name: str = "bonsai_agent") -> logging.Logger:
    """获取配置好的 logger"""
    log_level = os.environ.get("LOG_LEVEL", "info").upper()
    logging.basicConfig(
        level=getattr(logging, log_level, logging.INFO),
        format='[%(asctime)s] [%(levelname)-5s] [%(name)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    return logging.getLogger(name)
