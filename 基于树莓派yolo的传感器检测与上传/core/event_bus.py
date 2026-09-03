#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""事件总线 - 解耦组件间通信"""

import threading
import logging
from typing import Callable, Dict, List, Any
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class Event:
    """事件数据类"""
    event_type: str
    source: str
    data: Any = None
    timestamp: datetime = field(default_factory=datetime.now)


class EventBus:
    """事件总线"""

    def __init__(self):
        self._handlers: Dict[str, List[Callable]] = {}
        self._lock = threading.Lock()

    def subscribe(self, event_type: str, handler: Callable):
        """订阅事件"""
        with self._lock:
            if event_type not in self._handlers:
                self._handlers[event_type] = []
            self._handlers[event_type].append(handler)
            logger.debug(f"Subscribed to {event_type}")

    def unsubscribe(self, event_type: str, handler: Callable):
        """取消订阅"""
        with self._lock:
            if event_type in self._handlers:
                self._handlers[event_type].remove(handler)

    def publish(self, event: Event):
        """发布事件"""
        with self._lock:
            handlers = self._handlers.get(event.event_type, [])

        for handler in handlers:
            try:
                handler(event)
            except Exception as e:
                logger.error(f"Handler error for {event.event_type}: {e}")

    def clear(self):
        """清除所有订阅"""
        with self._lock:
            self._handlers.clear()


# 预定义事件类型
class EventTypes:
    """事件类型常量"""
    SENSOR_DATA = "sensor.data"
    ACTUATOR_COMMAND = "actuator.command"
    ACTUATOR_STATE = "actuator.state"
    SYSTEM_START = "system.start"
    SYSTEM_STOP = "system.stop"
    SYSTEM_ERROR = "system.error"
    UPLOAD_SUCCESS = "upload.success"
    UPLOAD_FAILED = "upload.failed"
    HEARTBEAT = "heartbeat"


# 全局事件总线实例
event_bus = EventBus()
