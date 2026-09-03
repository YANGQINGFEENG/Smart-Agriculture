#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""RGB-LED 执行器 - 使用统一 GPIO 管理器，支持颜色调节和亮度控制"""

from typing import Dict, Tuple
from drivers.actuators.base import BaseActuator, ActuatorState
from drivers.gpio_manager import gpio_manager


class RGBLEDActuator(BaseActuator):
    """RGB-LED 执行器 - 支持颜色调节和亮度控制"""

    # 预设颜色映射
    PRESET_COLORS = {
        0: (0.0, 0.0, 0.0),      # 关闭/黑色
        1: (1.0, 0.0, 0.0),      # 红色
        2: (0.0, 1.0, 0.0),      # 绿色
        3: (0.0, 0.0, 1.0),      # 蓝色
        4: (1.0, 1.0, 0.0),      # 黄色
        5: (0.0, 1.0, 1.0),      # 青色
        6: (1.0, 0.0, 1.0),      # 品红色
        7: (1.0, 1.0, 1.0),      # 白色
        8: (1.0, 0.5, 0.0),      # 橙色
        9: (0.5, 0.0, 1.0),      # 紫色
    }

    def __init__(self, actuator_id: str = "rgb_led", name: str = "RGB-LED",
                 red: int = 19, green: int = 17, blue: int = 27,
                 config: Dict = None):
        super().__init__(actuator_id, name, "rgb_led", config)
        self.red_pin = red
        self.green_pin = green
        self.blue_pin = blue
        self._initialized = False
        self._state = ActuatorState.OFF
        # 当前颜色值（0.0-1.0）
        self._current_r = 0.0
        self._current_g = 0.0
        self._current_b = 0.0
        # PWM 频率（Hz）
        self._pwm_freq = 100

    def initialize(self) -> bool:
        """初始化 RGB-LED 执行器 - 使用 GPIO 管理器申请 PWM 引脚"""
        if not gpio_manager.is_initialized():
            gpio_manager.initialize()
        
        # 申请三个 PWM 引脚
        success = True
        success &= gpio_manager.claim_pwm(self.red_pin, self.actuator_id, self._pwm_freq, 0)
        success &= gpio_manager.claim_pwm(self.green_pin, self.actuator_id, self._pwm_freq, 0)
        success &= gpio_manager.claim_pwm(self.blue_pin, self.actuator_id, self._pwm_freq, 0)
        
        if success:
            self._initialized = True
            self._state = ActuatorState.OFF
            self.logger.info(f"RGB-LED initialized: R={self.red_pin}, G={self.green_pin}, B={self.blue_pin}")
            return True
        else:
            self.logger.error(f"RGB-LED init failed")
            return False

    def set_color(self, r: float, g: float, b: float) -> bool:
        """设置颜色 (0.0-1.0)
        
        Args:
            r: 红色分量 (0.0-1.0)
            g: 绿色分量 (0.0-1.0)
            b: 蓝色分量 (0.0-1.0)
        
        Returns:
            是否成功
        """
        if not self._initialized:
            return False
            
        # 限制在有效范围内
        r = max(0.0, min(1.0, r))
        g = max(0.0, min(1.0, g))
        b = max(0.0, min(1.0, b))
        
        try:
            # 将 0.0-1.0 转换为 0-100 的占空比
            r_duty = int(r * 100)
            g_duty = int(g * 100)
            b_duty = int(b * 100)
            
            # 使用 GPIO 管理器设置 PWM 占空比
            success = True
            success &= gpio_manager.set_pwm_duty(self.red_pin, r_duty)
            success &= gpio_manager.set_pwm_duty(self.green_pin, g_duty)
            success &= gpio_manager.set_pwm_duty(self.blue_pin, b_duty)
            
            if success:
                # 更新当前颜色状态
                self._current_r = r
                self._current_g = g
                self._current_b = b
                
                # 更新执行器状态
                if r > 0 or g > 0 or b > 0:
                    self._state = ActuatorState.ON
                else:
                    self._state = ActuatorState.OFF
                
                self.logger.info(f"RGB-LED color set: R={r:.2f}, G={g:.2f}, B={b:.2f}")
                return True
            else:
                self._state = ActuatorState.ERROR
                return False
        except Exception as e:
            self.logger.error(f"RGB-LED set color error: {e}")
            self._state = ActuatorState.ERROR
            return False

    def set_color_rgb(self, r: int, g: int, b: int) -> bool:
        """设置颜色 (0-255)
        
        Args:
            r: 红色分量 (0-255)
            g: 绿色分量 (0-255)
            b: 蓝色分量 (0-255)
        
        Returns:
            是否成功
        """
        return self.set_color(r / 255.0, g / 255.0, b / 255.0)

    def turn_on(self) -> bool:
        """打开 (白色)"""
        return self.set_color(1.0, 1.0, 1.0)

    def turn_off(self) -> bool:
        """关闭 (熄灭所有颜色)"""
        return self.set_color(0.0, 0.0, 0.0)

    def set_value(self, value: int) -> bool:
        """设置控制值（支持预设颜色选择）
        
        Args:
            value: 控制值（0-100）
                   0-9: 选择预设颜色
                   10-100: 白色亮度百分比
        
        Returns:
            是否成功
        """
        if not self._initialized:
            return False
        
        try:
            # 根据值选择预设颜色或亮度
            if value in self.PRESET_COLORS:
                # 使用预设颜色
                r, g, b = self.PRESET_COLORS[value]
                success = self.set_color(r, g, b)
                color_name = self._get_color_name(value)
                self.logger.info(f"RGB-LED preset color: {color_name}")
            elif value >= 10 and value <= 100:
                # 使用白色亮度
                brightness = value / 100.0
                success = self.set_color(brightness, brightness, brightness)
                self.logger.info(f"RGB-LED white brightness: {value}%")
            else:
                # 默认使用白色亮度
                brightness = max(0.0, min(1.0, value / 100.0))
                success = self.set_color(brightness, brightness, brightness)
                self.logger.info(f"RGB-LED brightness: {value}%")
            
            return success
        except Exception as e:
            self.logger.error(f"RGB-LED set value error: {e}")
            self._state = ActuatorState.ERROR
            return False

    def _get_color_name(self, value: int) -> str:
        """获取预设颜色名称"""
        color_names = {
            0: "off",
            1: "red",
            2: "green",
            3: "blue",
            4: "yellow",
            5: "cyan",
            6: "magenta",
            7: "white",
            8: "orange",
            9: "purple",
        }
        return color_names.get(value, "unknown")

    def set_preset_color(self, color_name: str) -> bool:
        """设置预设颜色
        
        Args:
            color_name: 颜色名称（red/green/blue/yellow/cyan/magenta/white/orange/purple/off）
        
        Returns:
            是否成功
        """
        color_map = {
            "red": (1.0, 0.0, 0.0),
            "green": (0.0, 1.0, 0.0),
            "blue": (0.0, 0.0, 1.0),
            "yellow": (1.0, 1.0, 0.0),
            "cyan": (0.0, 1.0, 1.0),
            "magenta": (1.0, 0.0, 1.0),
            "white": (1.0, 1.0, 1.0),
            "orange": (1.0, 0.5, 0.0),
            "purple": (0.5, 0.0, 1.0),
            "off": (0.0, 0.0, 0.0),
        }
        
        color_name = color_name.lower().strip()
        if color_name in color_map:
            r, g, b = color_map[color_name]
            return self.set_color(r, g, b)
        else:
            self.logger.warning(f"Unknown color: {color_name}")
            return False

    def get_state(self) -> Dict:
        """获取当前状态"""
        return {
            "state": self._state.value,
            "color": {
                "r": int(self._current_r * 255),
                "g": int(self._current_g * 255),
                "b": int(self._current_b * 255),
            },
            "brightness": int(max(self._current_r, self._current_g, self._current_b) * 100),
        }

    def cleanup(self):
        """释放引脚资源"""
        gpio_manager.release(self.red_pin, self.actuator_id)
        gpio_manager.release(self.green_pin, self.actuator_id)
        gpio_manager.release(self.blue_pin, self.actuator_id)
        self._initialized = False
        self._state = ActuatorState.UNKNOWN
