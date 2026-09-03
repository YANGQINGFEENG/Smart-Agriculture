#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""MPU6050 六轴加速度陀螺仪传感器驱动（薄封装版）

基于 pip 库 `mpu6050`（from mpu6050 import mpu6050）做上层封装，
保持项目统一的接口风格（initialize / read / read_angles / cleanup），
并在封装层补充：
    1. 姿态角计算（pitch / roll，atan2 保留正负号）
    2. 互补滤波融合加速度 + 陀螺仪
    3. 零偏校准（静止时多次采样取均值）
    4. I2C 异常重试（底层 pip 库不做重试，封装层补上）

坐标系约定（右手系，MPU6050 芯片定义）：
    - X 轴：沿芯片长边向右
    - Y 轴：沿芯片短边向前
    - Z 轴：垂直芯片平面向上
    - 静止平放时：az ≈ +1g，ax ≈ 0，ay ≈ 0

姿态角计算（纯加速度计）：
    - pitch（俯仰，绕 X 轴）: atan2(ax,  sqrt(ay² + az²))  → [-90°, +90°]
    - roll （横滚，绕 Y 轴）: atan2(-ay,  sqrt(ax² + az²))  → [-90°, +90°]

注意：
    - 保留负号！使用 atan2(y, x) 而非 atan(y/x)
    - 互补滤波公式：angle = alpha * (angle + gyro_rate * dt) + (1-alpha) * accel_angle
      alpha 典型值 0.95 ~ 0.98，dt 为采样周期
    - I2C 与 PCA9685 (0x40) 共享 bus 1，总线互斥锁由上层 system.py 管理
"""

import math
import time
import threading
from datetime import datetime
from typing import Any, Dict, Optional, Tuple, List

from drivers.sensors.base import BaseSensor, DataQuality

try:
    from mpu6050 import mpu6050 as _Mpu6050PipLib
    HAS_PIP_LIB = True
except ImportError:
    HAS_PIP_LIB = False


class MPU6050Sensor(BaseSensor):
    """MPU6050 六轴传感器驱动（封装 pip mpu6050 库）"""

    def __init__(self, sensor_id: str = "mpu6050", name: str = "六轴姿态传感器",
                 address: int = 0x68, accel_range: int = 0, gyro_range: int = 0,
                 use_complementary: bool = True, alpha: float = 0.96,
                 config: Dict = None):
        """
        Args:
            sensor_id: 传感器唯一 ID
            name: 传感器名称
            address: I2C 地址（默认 0x68，AD0 接 GND；AD0 接 VCC → 0x69）
            accel_range: 加速度量程索引（0=±2g, 1=±4g, 2=±8g, 3=±16g）
                        pip mpu6050 库初始化时固定为 ±2g，此字段仅作记录
            gyro_range: 陀螺计量程索引（0=±250, 1=±500, 2=±1000, 3=±2000）
                        pip mpu6050 库初始化时固定为 ±250°/s，此字段仅作记录
            use_complementary: 是否使用互补滤波融合加速度+陀螺仪
            alpha: 互补滤波系数（陀螺仪权重，0.95~0.98 典型值）
            config: 附加配置
        """
        super().__init__(sensor_id, name, "mpu6050", config)
        self.address = address
        self._accel_range = accel_range
        self._gyro_range = gyro_range
        self._use_complementary = use_complementary
        self._alpha = alpha

        # pip 库实例（initialize 时创建）
        self._dev = None

        # 互补滤波状态
        self._comp_pitch: Optional[float] = None
        self._comp_roll: Optional[float] = None
        self._comp_time: Optional[float] = None

        # 零偏校准值（用于消除静止时的小漂移）
        self._accel_bias = [0.0, 0.0, 0.0]

        # 读取锁
        self._read_lock = threading.Lock()

        # 测试模式（pip 库不可用时生成模拟数据）
        self._test_mode = False

    # ------------------------------------------------------------------ #
    # 初始化 / 清理
    # ------------------------------------------------------------------ #

    def initialize(self, max_retries: int = 5, retry_delay: float = 0.2) -> bool:
        """初始化 MPU6050（带重试机制）

        步骤：
            1. 检查 pip 库是否可用
            2. 实例化 mpu6050(address)，内部自动 WHO_AM_I 校验 + 软复位 + PLL 时钟配置
            3. 零偏校准（需要传感器静止）

        Args:
            max_retries: 最大重试次数（默认 5 次）
            retry_delay: 重试间隔（秒，默认 0.2s）

        Returns:
            True 表示初始化成功
        """
        if not HAS_PIP_LIB:
            self.logger.warning(
                "pip mpu6050 库未安装，进入测试模式。"
                "请运行: pip3 install mpu6050"
            )
            self._test_mode = True
            self._initialized = True
            return True

        last_error = None
        for attempt in range(1, max_retries + 1):
            try:
                # pip 库初始化 —— 内部已处理唤醒（写 PWR_MGMT_1=0x00）
                self._dev = _Mpu6050PipLib(self.address)

                # 做一次加速度读确认器件真的活着（pip 库构造函数不校验 WHO_AM_I）
                acc = self._dev.get_accel_data(g=True)
                if not isinstance(acc, dict) or 'x' not in acc:
                    raise RuntimeError("首次读加速度失败，器件无响应")

                # 零偏校准（静止采样）
                self._calibrate_bias()

                self._initialized = True
                self.logger.info(
                    f"MPU6050 初始化成功: address=0x{self.address:02X}"
                    + (f" (第 {attempt} 次尝试)" if attempt > 1 else "")
                )
                return True

            except Exception as e:
                last_error = e
                self._dev = None
                if attempt < max_retries:
                    self.logger.warning(
                        f"MPU6050 初始化第 {attempt}/{max_retries} 次失败: {e}，"
                        f"{retry_delay}s 后重试"
                    )
                    time.sleep(retry_delay)

        self.logger.error(
            f"MPU6050 初始化失败（已重试 {max_retries} 次）: {last_error}"
        )
        return False

    def _calibrate_bias(self, samples: int = 200, delay: float = 0.01) -> None:
        """加速度零偏校准（需保持传感器静止）

        只对水平 XY 轴做零偏校准；Z 轴保留 +1g 重力基准。
        陀螺仪零偏由互补滤波的短时积分自然补偿，无需额外校准。
        """
        self.logger.info("MPU6050 开始零偏校准，请保持传感器静止...")

        ax_list, ay_list, az_list = [], [], []
        for _ in range(samples):
            try:
                acc = self._dev.get_accel_data(g=True)  # 返回 g（默认返回 m/s²！）
                ax_list.append(acc['x'])
                ay_list.append(acc['y'])
                az_list.append(acc['z'])
            except Exception:
                pass
            time.sleep(delay)

        if not ax_list:
            self.logger.warning("零偏校准失败：未读取到有效数据")
            return

        # XY 轴清零，Z 轴减去 1g
        self._accel_bias[0] = sum(ax_list) / len(ax_list)
        self._accel_bias[1] = sum(ay_list) / len(ay_list)
        self._accel_bias[2] = sum(az_list) / len(az_list) - 1.0

        self.logger.info(
            f"零偏校准完成: accel_bias=({self._accel_bias[0]:.3f}, "
            f"{self._accel_bias[1]:.3f}, {self._accel_bias[2]:.3f})g"
        )

    def cleanup(self):
        """释放资源"""
        self._dev = None
        self._initialized = False
        self._comp_pitch = None
        self._comp_roll = None
        self._comp_time = None
        self.logger.info("MPU6050 已清理")

    def recalibrate(self) -> bool:
        """运行时重新校准（需保持传感器静止）

        重置加速度零偏 + 清空互补滤波状态 + 清空内部平滑缓存。
        供"全面复位"命令调用，让陀螺仪重新归零。

        Returns:
            True 表示校准成功；未初始化时返回 False
        """
        if not self._initialized or self._dev is None:
            self.logger.warning("[MPU6050] recalibrate: 未初始化，跳过")
            return False

        logger = self.logger  # noqa
        logger.info("[MPU6050] 开始运行时重新校准，请保持静止...")
        try:
            self.reset_filter()          # 先清掉旧的滤波状态和零偏
            self._calibrate_bias()       # 再重新采样校准
            logger.info("[MPU6050] 重新校准完成")
            return True
        except Exception as e:
            logger.error(f"[MPU6050] 重新校准失败: {e}")
            return False

    def reset_filter(self):
        """清空互补滤波状态 + 加速度零偏，让下次读取从原始值起始

        与 recalibrate 的区别：reset_filter 只清状态不做采样，速度更快，
        适合"快速复位"场景（已知当前静止不需要重新采样时）。
        """
        self._comp_pitch = None
        self._comp_roll = None
        self._comp_time = None
        self._accel_bias = [0.0, 0.0, 0.0]
        self.logger.info("[MPU6050] 滤波状态 + 零偏已清空")

    # ------------------------------------------------------------------ #
    # 原始数据读取
    # ------------------------------------------------------------------ #

    def _read_raw(self, retries: int = 2) -> Optional[Tuple[float, float, float, float, float, float]]:
        """读取原始六轴数据

        封装层自带重试（底层 pip 库不做，I2C 总线瞬时竞争时可能抛异常）。

        Args:
            retries: 重试次数

        Returns:
            (ax, ay, az, gx, gy, gz) 单位分别为 g 和 °/s；失败返回 None
        """
        if self._test_mode:
            import random
            noise = lambda: random.uniform(-0.02, 0.02)
            return (0.0 + noise(), 0.0 + noise(), 1.0 + noise(),
                    0.0 + noise() * 5, 0.0 + noise() * 5, 0.0 + noise() * 5)

        if self._dev is None:
            return None

        last_err = None
        for attempt in range(retries + 1):
            try:
                acc = self._dev.get_accel_data(g=True)  # 返回 g（默认返回 m/s²！）   # {'x','y','z'} 单位 g
                gyro = self._dev.get_gyro_data()   # {'x','y','z'} 单位 °/s
                break
            except Exception as e:
                last_err = e
                if attempt < retries:
                    time.sleep(0.005 * (attempt + 1))
        else:
            self.logger.debug(
                f"MPU6050 读数据失败（已重试 {retries+1} 次）: {last_err}"
            )
            return None

        # 扣零偏
        ax = acc['x'] - self._accel_bias[0]
        ay = acc['y'] - self._accel_bias[1]
        az = acc['z'] - self._accel_bias[2]

        # pip 库返回的 gyro 单位已是 °/s，无需换算
        gx = gyro['x']
        gy = gyro['y']
        gz = gyro['z']

        return (ax, ay, az, gx, gy, gz)

    # ------------------------------------------------------------------ #
    # 姿态角计算
    # ------------------------------------------------------------------ #

    @staticmethod
    def _compute_pitch_roll(ax: float, ay: float, az: float) -> Tuple[float, float]:
        """纯加速度计计算 pitch/roll

        使用 atan2 保留完整象限信息（避免 -90° 被算成 +90°）。

        Args:
            ax: X 轴加速度（g）
            ay: Y 轴加速度（g）
            az: Z 轴加速度（g）

        Returns:
            (pitch, roll) 单位度，区间 [-90°, +90°]
        """
        # pitch：绕 X 轴，ax 对 Y-Z 平面的夹角
        pitch = math.atan2(ax, math.sqrt(ay * ay + az * az)) * 180.0 / math.pi
        # roll：绕 Y 轴，负号让倾斜方向直观（向左倾 → roll 为负）
        roll = math.atan2(-ay, math.sqrt(ax * ax + az * az)) * 180.0 / math.pi
        return pitch, roll

    def _apply_complementary(self, accel_pitch: float, accel_roll: float,
                             gx: float, gy: float, now: float) -> Tuple[float, float]:
        """互补滤波融合加速度 + 陀螺仪

        公式：
            filtered = α * (prev + gyro_rate * dt) + (1-α) * accel_angle

        Args:
            accel_pitch: 加速度计计算的 pitch（°）
            accel_roll: 加速度计计算的 roll（°）
            gx: X 轴角速度（°/s），对应 pitch 变化率
            gy: Y 轴角速度（°/s），对应 roll 变化率
            now: 当前时间戳（秒）

        Returns:
            (filtered_pitch, filtered_roll) 融合后角度
        """
        if self._comp_pitch is None or self._comp_time is None:
            self._comp_pitch = accel_pitch
            self._comp_roll = accel_roll
            self._comp_time = now
            return accel_pitch, accel_roll

        dt = now - self._comp_time
        # dt 异常保护：>0.5s 太离谱，丢弃本次积分，从加速度计值重新起始
        if dt <= 0 or dt > 0.5:
            self._comp_pitch = accel_pitch
            self._comp_roll = accel_roll
            self._comp_time = now
            return accel_pitch, accel_roll

        gyro_pitch = self._comp_pitch + gx * dt
        gyro_roll = self._comp_roll + gy * dt

        self._comp_pitch = self._alpha * gyro_pitch + (1.0 - self._alpha) * accel_pitch
        self._comp_roll = self._alpha * gyro_roll + (1.0 - self._alpha) * accel_roll
        self._comp_time = now

        return self._comp_pitch, self._comp_roll

    # ------------------------------------------------------------------ #
    # 公共 API（与原寄存器版保持一致）
    # ------------------------------------------------------------------ #

    def read(self) -> Dict[str, Any]:
        """读取传感器完整数据

        Returns:
            {
                "value": {
                    "ax", "ay", "az": 加速度 (g),
                    "gx", "gy", "gz": 角速度 (°/s),
                    "pitch": 俯仰角 (°),  # [-90°, +90°]
                    "roll": 横滚角 (°),   # [-90°, +90°]
                },
                "unit": {...},
                "quality": "good"/"error"/"unavailable"
            }
        """
        if not self._initialized:
            return {"value": None, "unit": {}, "quality": DataQuality.UNAVAILABLE}

        with self._read_lock:
            raw = self._read_raw()

        if raw is None:
            return {"value": None, "unit": {}, "quality": DataQuality.ERROR}

        ax, ay, az, gx, gy, gz = raw
        accel_pitch, accel_roll = self._compute_pitch_roll(ax, ay, az)

        if self._use_complementary:
            now = time.time()
            pitch, roll = self._apply_complementary(accel_pitch, accel_roll, gx, gy, now)
        else:
            pitch, roll = accel_pitch, accel_roll

        value = {
            "ax": round(ax, 4), "ay": round(ay, 4), "az": round(az, 4),
            "gx": round(gx, 3), "gy": round(gy, 3), "gz": round(gz, 3),
            "pitch": round(pitch, 2),
            "roll": round(roll, 2),
        }

        self._last_value = value
        self._last_time = datetime.now()

        return {
            "value": value,
            "unit": {
                "ax": "g", "ay": "g", "az": "g",
                "gx": "°/s", "gy": "°/s", "gz": "°/s",
                "pitch": "°", "roll": "°",
            },
            "quality": DataQuality.GOOD,
        }

    def read_angles(self) -> Optional[Tuple[float, float]]:
        """快速读取姿态角（供手势控制高频调用）

        绕过完整 read() 返回结构，只取 pitch/roll，减少序列化开销。

        Returns:
            (pitch, roll) 或 None
        """
        if not self._initialized:
            return None

        with self._read_lock:
            raw = self._read_raw()

        if raw is None:
            return None

        ax, ay, az, gx, gy, gz = raw
        accel_pitch, accel_roll = self._compute_pitch_roll(ax, ay, az)

        if self._use_complementary:
            now = time.time()
            return self._apply_complementary(accel_pitch, accel_roll, gx, gy, now)

        return accel_pitch, accel_roll
