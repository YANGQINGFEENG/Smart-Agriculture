#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PCA9685 舵机驱动 - 直接使用 SMBus，不依赖 adafruit 库"""

import time
import logging
from typing import Dict, Tuple, Optional
from drivers.actuators.base import BaseActuator, ActuatorState

logger = logging.getLogger(__name__)


# PCA9685 寄存器地址
PCA9685_MODE1 = 0x00
PCA9685_MODE2 = 0x01
PCA9685_PRESCALE = 0xFE
PCA9685_LED0_ON_L = 0x06
PCA9685_LED0_OFF_L = 0x08


class PCA9685Driver:
    """PCA9685 舵机驱动板 - 直接 SMBus 控制"""

    def __init__(self, i2c_bus: int = 1, address: int = 0x40):
        """
        Args:
            i2c_bus: I2C 总线号（树莓派默认为1）
            address: PCA9685 I2C 地址（默认0x40）
        """
        self._bus = None
        self._i2c_bus = i2c_bus
        self._address = address
        self._frequency = 50  # 舵机标准频率 50Hz

    def initialize(self, max_retries: int = 3, retry_delay: float = 0.2) -> bool:
        """初始化 PCA9685（带重试机制）

        针对 I2C 总线瞬时通信故障（如 [Errno 121] Remote I/O error），
        在初始化失败时自动重试，每次重试前重新打开 SMBus 句柄并尝试总线复位。

        Args:
            max_retries: 最大重试次数（默认 3 次）
            retry_delay: 重试间隔（秒，默认 0.2s）

        Returns:
            True 表示初始化成功，False 表示失败
        """
        from smbus2 import SMBus

        last_error = None
        for attempt in range(1, max_retries + 1):
            try:
                # 每次重试前关闭旧句柄，重新打开
                if self._bus is not None:
                    try:
                        self._bus.close()
                    except Exception:
                        pass
                    self._bus = None

                self._bus = SMBus(self._i2c_bus)

                # 读取 MODE1 寄存器验证设备
                mode1 = self._bus.read_byte_data(self._address, PCA9685_MODE1)
                logger.info(f"PCA9685 初始化 (第 {attempt}/{max_retries} 次): MODE1=0x{mode1:02X}")

                # 进入睡眠模式以设置频率
                self._bus.write_byte_data(self._address, PCA9685_MODE1, 0x10)
                time.sleep(0.005)

                # 设置 PWM 频率（50Hz）
                prescale = int(25000000.0 / (4096 * self._frequency) - 1)
                self._bus.write_byte_data(self._address, PCA9685_PRESCALE, prescale)

                # 唤醒
                self._bus.write_byte_data(self._address, PCA9685_MODE1, 0x00)
                time.sleep(0.005)

                # 启用自动递增
                self._bus.write_byte_data(self._address, PCA9685_MODE1, 0x20)

                # 设置 MODE2：推挽输出（与直接测试一致）
                self._bus.write_byte_data(self._address, PCA9685_MODE2, 0x04)
                time.sleep(0.1)  # 等待稳定

                logger.info(f"PCA9685 初始化成功: address=0x{self._address:02X}, freq={self._frequency}Hz"
                            + (f" (第 {attempt} 次尝试)" if attempt > 1 else ""))
                return True

            except Exception as e:
                last_error = e
                logger.warning(f"PCA9685 初始化第 {attempt}/{max_retries} 次失败: {e}")
                if attempt < max_retries:
                    time.sleep(retry_delay)

        logger.error(f"PCA9685 初始化失败（已重试 {max_retries} 次）: {last_error}")
        return False

    def set_pwm(self, channel: int, on: int, off: int) -> bool:
        """设置通道 PWM 值（带重试）
        
        Args:
            channel: 通道号 (0-15)
            on: PWM 开启时间 (0-4095)
            off: PWM 关闭时间 (0-4095)
        """
        if not self._bus or channel < 0 or channel > 15:
            return False
        
        on_reg = PCA9685_LED0_ON_L + 4 * channel
        data = [on & 0xFF, (on >> 8) & 0x0F, off & 0xFF, (off >> 8) & 0x0F]
        
        # 最多重试5次
        for attempt in range(5):
            try:
                self._bus.write_i2c_block_data(self._address, on_reg, data)
                return True
            except Exception as e:
                if attempt < 4:
                    time.sleep(0.05 * (attempt + 1))  # 递增延迟
                else:
                    logger.error(f"设置 PWM 失败 (channel={channel}): {e}")
                    return False

    def set_servo_angle(self, channel: int, angle: float) -> bool:
        """设置舵机角度
        
        Args:
            channel: 通道号 (0-15)
            angle: 角度 (0-180)
        """
        # 舵机控制：50Hz, 周期20ms
        # 0° = 0.5ms = 102, 90° = 1.5ms = 307, 180° = 2.5ms = 512
        angle = max(0, min(180, angle))
        pulse_ms = 0.5 + (angle / 180.0) * 2.0  # 0.5ms ~ 2.5ms
        pulse_value = int(pulse_ms / 20.0 * 4096)  # 转换为 0-4095
        
        return self.set_pwm(channel, 0, pulse_value)

    def set_servo_off(self, channel: int) -> bool:
        """关闭舵机输出"""
        return self.set_pwm(channel, 0, 0)

    def cleanup(self):
        """释放资源"""
        if self._bus:
            try:
                # 所有关闭
                for ch in range(16):
                    self.set_servo_off(ch)
                self._bus.close()
            except:
                pass
            self._bus = None
        logger.info("PCA9685 资源已释放")


class ServoActuator(BaseActuator):
    """舵机执行器"""

    def __init__(self, actuator_id: str = "servo", name: str = "舵机",
                 channel: int = 0, config: Dict = None):
        super().__init__(actuator_id, name, "servo", config)
        self._channel = channel
        self._current_angle = 90
        self._min_angle = 0
        self._max_angle = 180
        self._inverted = False
        self._pca9685 = None  # PCA9685Driver 实例

    def initialize(self) -> bool:
        """初始化舵机"""
        try:
            self._min_angle = self.config.get("min_angle", 0)
            self._max_angle = self.config.get("max_angle", 180)
            self._inverted = self.config.get("inverted", False)
            self._channel = self.config.get("channel", self._channel)
            default_angle = self.config.get("default_angle", 90)
            
            # 获取 I2C 配置
            i2c_bus = self.config.get("i2c_bus", 1)
            i2c_address = self.config.get("i2c_address", 0x40)
            
            # 使用直接 SMBus 驱动
            self._pca9685 = PCA9685Driver(i2c_bus=i2c_bus, address=i2c_address)
            if not self._pca9685.initialize():
                self.logger.error("PCA9685 初始化失败")
                return False
            
            # 设置默认角度
            self._pca9685.set_servo_angle(self._channel, self._get_output_angle(default_angle))
            self._current_angle = default_angle
            time.sleep(0.3)  # 等待舵机就位
            
            self._initialized = True
            self._state = ActuatorState.ON
            self.logger.info(f"舵机初始化成功: channel={self._channel}, angle={default_angle}°")
            return True
            
        except Exception as e:
            self.logger.error(f"舵机初始化失败: {e}")
            return False

    def _get_output_angle(self, angle: float) -> float:
        """获取实际输出角度（考虑反向）"""
        if self._inverted:
            return 180 - angle
        return angle

    def set_angle(self, angle: float) -> bool:
        """设置舵机角度"""
        if not self._initialized or self._pca9685 is None:
            return False
        try:
            angle = max(self._min_angle, min(self._max_angle, angle))
            output_angle = self._get_output_angle(angle)
            self._pca9685.set_servo_angle(self._channel, output_angle)
            self._current_angle = angle
            self._state = ActuatorState.ON
            self.logger.debug(f"舵机角度: {angle}° (输出: {output_angle}°)")
            return True
        except Exception as e:
            self.logger.error(f"舵机角度设置失败: {e}")
            self._state = ActuatorState.ERROR
            return False

    def get_angle(self) -> float:
        """获取当前角度"""
        return self._current_angle

    def turn_on(self) -> bool:
        """打开舵机（保持当前位置）"""
        return self.set_angle(self._current_angle)

    def turn_off(self) -> bool:
        """关闭舵机（回到默认位置）"""
        return self.set_angle(self.config.get("default_angle", 90))

    def get_state(self) -> Dict:
        """获取当前状态"""
        return {
            "state": self._state.value,
            "angle": self._current_angle,
            "channel": self._channel
        }

    def cleanup(self):
        """释放资源"""
        if self._pca9685:
            self._pca9685.set_servo_off(self._channel)
            self._pca9685.cleanup()
        self._initialized = False
        self._state = ActuatorState.UNKNOWN


class PanTiltController:
    """云台控制器 - 双舵机控制"""

    def __init__(self, pan_channel: int = 0, tilt_channel: int = 1,
                 config: Dict = None):
        self.config = config or {}
        
        # 共享同一个 PCA9685 驱动
        i2c_bus = self.config.get("i2c_bus", 1)
        i2c_address = self.config.get("i2c_address", 0x40)
        self._pca9685 = PCA9685Driver(i2c_bus=i2c_bus, address=i2c_address)
        
        # 创建水平舵机（共享驱动）
        self.pan_servo = ServoActuator(
            actuator_id="pan",
            name="水平舵机",
            channel=pan_channel,
            config={
                **self.config,
                "channel": pan_channel,
                "inverted": self.config.get("pan_inverted", True),
                "i2c_bus": i2c_bus,
                "i2c_address": i2c_address
            }
        )
        self.pan_servo._pca9685 = self._pca9685  # 共享驱动实例
        
        # 创建俯仰舵机（共享驱动）
        self.tilt_servo = ServoActuator(
            actuator_id="tilt",
            name="俯仰舵机",
            channel=tilt_channel,
            config={
                **self.config,
                "channel": tilt_channel,
                "inverted": self.config.get("tilt_inverted", True),
                "i2c_bus": i2c_bus,
                "i2c_address": i2c_address
            }
        )
        self.tilt_servo._pca9685 = self._pca9685  # 共享驱动实例

    def initialize(self) -> bool:
        """初始化云台"""
        # 先初始化 PCA9685
        if not self._pca9685.initialize():
            return False
        
        # 初始化两个舵机
        self.pan_servo._initialized = True
        self.tilt_servo._initialized = True
        self.pan_servo._state = ActuatorState.ON
        self.tilt_servo._state = ActuatorState.ON
        
        # 设置默认角度
        default_angle = self.config.get("default_angle", 90)
        self.pan_servo._current_angle = default_angle
        self.tilt_servo._current_angle = default_angle
        
        self._pca9685.set_servo_angle(self.pan_servo._channel,
                                       self.pan_servo._get_output_angle(default_angle))
        self._pca9685.set_servo_angle(self.tilt_servo._channel,
                                       self.tilt_servo._get_output_angle(default_angle))
        time.sleep(0.3)
        
        logger.info(f"云台初始化成功: pan={default_angle}°, tilt={default_angle}°")
        return True

    def move(self, pan_delta: float = 0, tilt_delta: float = 0) -> Tuple[bool, float, float]:
        """移动云台"""
        new_pan = self.pan_servo.get_angle() + pan_delta
        new_tilt = self.tilt_servo.get_angle() + tilt_delta
        success_pan = self.pan_servo.set_angle(new_pan)
        success_tilt = self.tilt_servo.set_angle(new_tilt)
        return success_pan and success_tilt, new_pan, new_tilt

    def set_position(self, pan: float, tilt: float) -> bool:
        """设置云台位置"""
        # 直接调用 PCA9685，避免中间层
        pan = max(0, min(180, pan))
        tilt = max(0, min(180, tilt))
        
        success_pan = self._pca9685.set_servo_angle(
            self.pan_servo._channel, 
            self.pan_servo._get_output_angle(pan)
        )
        time.sleep(0.02)  # 通道间延迟
        success_tilt = self._pca9685.set_servo_angle(
            self.tilt_servo._channel, 
            self.tilt_servo._get_output_angle(tilt)
        )
        
        if success_pan:
            self.pan_servo._current_angle = pan
        if success_tilt:
            self.tilt_servo._current_angle = tilt
            
        return success_pan and success_tilt

    def get_position(self) -> Tuple[float, float]:
        """获取当前位置"""
        return self.pan_servo.get_angle(), self.tilt_servo.get_angle()

    def reset(self) -> bool:
        """重置到默认位置"""
        return self.set_position(90, 90)

    def cleanup(self):
        """释放资源"""
        self._pca9685.cleanup()
