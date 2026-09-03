#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""执行器基类"""

from abc import ABC, abstractmethod
from typing import Any, Dict
from enum import Enum
import logging


class ActuatorState(Enum):
    """执行器状态"""
    ON = "on"
    OFF = "off"
    ERROR = "error"
    UNKNOWN = "unknown"


class BaseActuator(ABC):
    """执行器抽象基类"""

    def __init__(self, actuator_id: str, name: str, actuator_type: str, config: Dict = None):
        """
        Args:
            actuator_id: 执行器唯一ID
            name: 执行器名称
            actuator_type: 执行器类型
            config: 配置参数
        """
        self.actuator_id = actuator_id
        self.name = name
        self.actuator_type = actuator_type
        self.config = config or {}
        self._state = ActuatorState.UNKNOWN
        self._initialized = False
        self.logger = logging.getLogger(f"actuator.{actuator_id}")

    @abstractmethod
    def initialize(self) -> bool:
        """初始化执行器"""
        pass

    @abstractmethod
    def turn_on(self) -> bool:
        """打开执行器"""
        pass

    @abstractmethod
    def turn_off(self) -> bool:
        """关闭执行器"""
        pass

    def toggle(self) -> bool:
        """切换状态"""
        if self._state == ActuatorState.ON:
            return self.turn_off()
        else:
            return self.turn_on()

    def execute_command(self, command: str) -> bool:
        """执行控制命令"""
        command = command.lower().strip()
        if command == "on":
            return self.turn_on()
        elif command == "off":
            return self.turn_off()
        elif command == "toggle":
            return self.toggle()
        else:
            self.logger.warning(f"Unknown command: {command}")
            return False

    @abstractmethod
    def cleanup(self):
        """清理资源"""
        pass

    def get_status(self) -> Dict[str, Any]:
        """获取执行器状态"""
        return {
            "id": self.actuator_id,
            "name": self.name,
            "type": self.actuator_type,
            "state": self._state.value,
            "initialized": self._initialized
        }
