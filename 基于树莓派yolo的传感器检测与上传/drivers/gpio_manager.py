#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""GPIO 资源管理器 - 统一管理 lgpio 句柄和引脚资源

解决当前问题：
- 每个设备独立打开 lgpio 句柄，资源浪费
- 多设备同时操作 GPIO 可能冲突
- 缺少引脚占用检测，防止重复分配
"""

import logging
from typing import Dict, Optional, Set, Tuple

try:
    import lgpio
    HAS_LGPIO = True
except ImportError:
    HAS_LGPIO = False

try:
    import RPi.GPIO as GPIO
    HAS_GPIO = True
except ImportError:
    HAS_GPIO = False

logger = logging.getLogger(__name__)


class GPIOManager:
    """GPIO 资源管理器 - 单例模式"""
    
    _instance = None
    _lock = __import__('threading').Lock()
    
    # 引脚状态常量
    PIN_MODE_INPUT = "input"
    PIN_MODE_OUTPUT = "output"
    PIN_MODE_PWM = "pwm"
    
    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._h = None  # lgpio 芯片句柄
        self._initialized = False
        
        # 引脚占用状态 {pin: (mode, owner)}
        self._pin_owners: Dict[int, Tuple[str, str]] = {}
        # PWM 通道管理 {pin: (freq, duty)}
        self._pwm_channels: Dict[int, Tuple[int, int]] = {}
        
        # RPi.GPIO PWM 对象
        self._gpio_pwm: Dict[int, 'GPIO.PWM'] = {}
        
        logger.info("GPIOManager initialized")
    
    def initialize(self) -> bool:
        """初始化 GPIO 管理器"""
        if self._initialized:
            return True
            
        if HAS_LGPIO:
            try:
                self._h = lgpio.gpiochip_open(0)
                if self._h < 0:
                    logger.error("lgpio chip open failed")
                    return False
                self._initialized = True
                logger.info("GPIOManager initialized (lgpio)")
                return True
            except Exception as e:
                logger.error(f"GPIOManager lgpio init error: {e}")
                return False
        elif HAS_GPIO:
            try:
                GPIO.setmode(GPIO.BCM)
                GPIO.setwarnings(False)
                self._initialized = True
                logger.info("GPIOManager initialized (RPi.GPIO)")
                return True
            except Exception as e:
                logger.error(f"GPIOManager RPi.GPIO init error: {e}")
                return False
        else:
            logger.warning("No GPIO library available, running in test mode")
            self._initialized = True
            return True
    
    def is_initialized(self) -> bool:
        """检查是否已初始化"""
        return self._initialized
    
    def claim_output(self, pin: int, owner: str, initial_value: int = 0) -> bool:
        """申请输出引脚
        
        Args:
            pin: GPIO 引脚编号（BCM）
            owner: 占用者标识（如 "relay", "laser"）
            initial_value: 初始值（0 或 1）
        
        Returns:
            是否成功
        """
        if not self._initialized:
            logger.error("GPIOManager not initialized")
            return False
        
        # 检查引脚是否已被占用
        if pin in self._pin_owners:
            current_owner = self._pin_owners[pin][1]
            logger.warning(f"Pin {pin} already claimed by {current_owner}, skip")
            return False
        
        try:
            if HAS_LGPIO:
                # 兼容不同版本的 lgpio API
                try:
                    # 新版本：支持 initial_value 参数
                    lgpio.gpio_claim_output(self._h, pin, initial_value=initial_value)
                except TypeError:
                    # 旧版本：不支持 initial_value 参数，先申请再设置
                    lgpio.gpio_claim_output(self._h, pin)
                    lgpio.gpio_write(self._h, pin, initial_value)
            elif HAS_GPIO:
                GPIO.setup(pin, GPIO.OUT, initial=GPIO.HIGH if initial_value else GPIO.LOW)
            
            self._pin_owners[pin] = (self.PIN_MODE_OUTPUT, owner)
            logger.debug(f"Pin {pin} claimed as OUTPUT by {owner}")
            return True
        except Exception as e:
            logger.error(f"Claim output pin {pin} error: {e}")
            return False
    
    def claim_input(self, pin: int, owner: str, pull_up_down: int = 0) -> bool:
        """申请输入引脚
        
        Args:
            pin: GPIO 引脚编号（BCM）
            owner: 占用者标识
            pull_up_down: 上拉/下拉（0=无, 1=上拉, 2=下拉）
        
        Returns:
            是否成功
        """
        if not self._initialized:
            logger.error("GPIOManager not initialized")
            return False
        
        if pin in self._pin_owners:
            current_owner = self._pin_owners[pin][1]
            logger.warning(f"Pin {pin} already claimed by {current_owner}, skip")
            return False
        
        try:
            if HAS_LGPIO:
                # 兼容不同版本的 lgpio API
                try:
                    # 新版本：支持 pud 参数
                    pud = 0
                    if pull_up_down == 1:
                        pud = lgpio.SET_PULL_UP
                    elif pull_up_down == 2:
                        pud = lgpio.SET_PULL_DOWN
                    lgpio.gpio_claim_input(self._h, pin, pud=pud)
                except TypeError:
                    # 旧版本：不支持 pud 参数，先申请，上拉电阻设置可能不可用
                    lgpio.gpio_claim_input(self._h, pin)
                    # 尝试设置上拉电阻（某些版本的 lgpio 不支持此方法）
                    try:
                        if pull_up_down == 1:
                            lgpio.gpio_set_pull_up_down(self._h, pin, lgpio.SET_PULL_UP)
                        elif pull_up_down == 2:
                            lgpio.gpio_set_pull_up_down(self._h, pin, lgpio.SET_PULL_DOWN)
                    except AttributeError:
                        # lgpio 版本不支持 gpio_set_pull_up_down，跳过上拉设置
                        logger.warning(f"lgpio version does not support pull_up_down for pin {pin}")
                        pass
            elif HAS_GPIO:
                pud_mode = GPIO.PUD_OFF
                if pull_up_down == 1:
                    pud_mode = GPIO.PUD_UP
                elif pull_up_down == 2:
                    pud_mode = GPIO.PUD_DOWN
                GPIO.setup(pin, GPIO.IN, pull_up_down=pud_mode)
            
            self._pin_owners[pin] = (self.PIN_MODE_INPUT, owner)
            logger.debug(f"Pin {pin} claimed as INPUT by {owner}")
            return True
        except Exception as e:
            logger.error(f"Claim input pin {pin} error: {e}")
            return False
    
    def claim_pwm(self, pin: int, owner: str, freq: int = 100, initial_duty: int = 0) -> bool:
        """申请 PWM 引脚
        
        Args:
            pin: GPIO 引脚编号（BCM）
            owner: 占用者标识
            freq: PWM 频率（Hz）
            initial_duty: 初始占空比（0-100）
        
        Returns:
            是否成功
        """
        if not self._initialized:
            logger.error("GPIOManager not initialized")
            return False
        
        if pin in self._pin_owners:
            current_owner = self._pin_owners[pin][1]
            logger.warning(f"Pin {pin} already claimed by {current_owner}, skip")
            return False
        
        try:
            if HAS_LGPIO:
                lgpio.gpio_claim_output(self._h, pin)
                lgpio.tx_pwm(self._h, pin, freq, initial_duty)
            elif HAS_GPIO:
                GPIO.setup(pin, GPIO.OUT)
                pwm = GPIO.PWM(pin, freq)
                pwm.start(initial_duty)
                self._gpio_pwm[pin] = pwm
            
            self._pin_owners[pin] = (self.PIN_MODE_PWM, owner)
            self._pwm_channels[pin] = (freq, initial_duty)
            logger.debug(f"Pin {pin} claimed as PWM by {owner}, freq={freq}, duty={initial_duty}")
            return True
        except Exception as e:
            logger.error(f"Claim PWM pin {pin} error: {e}")
            return False
    
    def write(self, pin: int, value: int) -> bool:
        """设置引脚输出值
        
        Args:
            pin: GPIO 引脚编号（BCM）
            value: 输出值（0 或 1）
        
        Returns:
            是否成功
        """
        if not self._initialized:
            return False
        
        if pin not in self._pin_owners:
            logger.warning(f"Pin {pin} not claimed, cannot write")
            return False
        
        try:
            if HAS_LGPIO:
                lgpio.gpio_write(self._h, pin, value)
            elif HAS_GPIO:
                GPIO.output(pin, GPIO.HIGH if value else GPIO.LOW)
            
            return True
        except Exception as e:
            logger.error(f"Write pin {pin} error: {e}")
            return False
    
    def read(self, pin: int) -> Optional[int]:
        """读取引脚输入值
        
        Args:
            pin: GPIO 引脚编号（BCM）
        
        Returns:
            引脚值（0 或 1），失败返回 None
        """
        if not self._initialized:
            return None
        
        if pin not in self._pin_owners:
            logger.warning(f"Pin {pin} not claimed, cannot read")
            return None
        
        try:
            if HAS_LGPIO:
                return lgpio.gpio_read(self._h, pin)
            elif HAS_GPIO:
                return GPIO.input(pin)
            return None
        except Exception as e:
            logger.error(f"Read pin {pin} error: {e}")
            return None
    
    def set_pwm_duty(self, pin: int, duty: int) -> bool:
        """设置 PWM 占空比
        
        Args:
            pin: GPIO 引脚编号（BCM）
            duty: 占空比（0-100）
        
        Returns:
            是否成功
        """
        if not self._initialized:
            return False
        
        if pin not in self._pin_owners or self._pin_owners[pin][0] != self.PIN_MODE_PWM:
            logger.warning(f"Pin {pin} not in PWM mode, cannot set duty")
            return False
        
        try:
            freq = self._pwm_channels.get(pin, (100, 0))[0]
            
            if HAS_LGPIO:
                lgpio.tx_pwm(self._h, pin, freq, duty)
            elif HAS_GPIO:
                pwm = self._gpio_pwm.get(pin)
                if pwm:
                    pwm.ChangeDutyCycle(duty)
            
            self._pwm_channels[pin] = (freq, duty)
            return True
        except Exception as e:
            logger.error(f"Set PWM duty {pin} error: {e}")
            return False
    
    def release(self, pin: int, owner: str) -> bool:
        """释放引脚资源
        
        Args:
            pin: GPIO 引脚编号（BCM）
            owner: 占用者标识（必须与申请时一致）
        
        Returns:
            是否成功
        """
        if not self._initialized:
            return False
        
        if pin not in self._pin_owners:
            return True
        
        current_owner = self._pin_owners[pin][1]
        if current_owner != owner:
            logger.warning(f"Pin {pin} owned by {current_owner}, cannot release by {owner}")
            return False
        
        try:
            mode = self._pin_owners[pin][0]
            
            if HAS_LGPIO:
                if mode == self.PIN_MODE_PWM:
                    lgpio.tx_pwm(self._h, pin, 0, 0)
                else:
                    lgpio.gpio_write(self._h, pin, 0)
                lgpio.gpio_free(self._h, pin)
            elif HAS_GPIO:
                if mode == self.PIN_MODE_PWM:
                    pwm = self._gpio_pwm.get(pin)
                    if pwm:
                        pwm.stop()
                        del self._gpio_pwm[pin]
                else:
                    GPIO.output(pin, GPIO.LOW)
                GPIO.setup(pin, GPIO.IN)
            
            del self._pin_owners[pin]
            if pin in self._pwm_channels:
                del self._pwm_channels[pin]
            
            logger.debug(f"Pin {pin} released by {owner}")
            return True
        except Exception as e:
            logger.error(f"Release pin {pin} error: {e}")
            return False
    
    def temp_claim_output(self, pin: int) -> bool:
        """临时申请输出引脚（不记录占用者，用于 DHT 等需要临时切换方向的设备）
        
        Args:
            pin: GPIO 引脚编号（BCM）
        
        Returns:
            是否成功
        """
        if not self._initialized:
            return False
        
        try:
            if HAS_LGPIO:
                # 兼容不同版本的 lgpio API
                try:
                    lgpio.gpio_claim_output(self._h, pin, initial_value=1)
                except TypeError:
                    lgpio.gpio_claim_output(self._h, pin)
                    lgpio.gpio_write(self._h, pin, 1)
            elif HAS_GPIO:
                GPIO.setup(pin, GPIO.OUT, initial=GPIO.HIGH)
            return True
        except Exception as e:
            logger.error(f"Temp claim output pin {pin} error: {e}")
            return False
    
    def temp_claim_input(self, pin: int) -> bool:
        """临时申请输入引脚（不记录占用者）
        
        Args:
            pin: GPIO 引脚编号（BCM）
        
        Returns:
            是否成功
        """
        if not self._initialized:
            return False
        
        try:
            if HAS_LGPIO:
                lgpio.gpio_claim_input(self._h, pin)
            elif HAS_GPIO:
                GPIO.setup(pin, GPIO.IN)
            return True
        except Exception as e:
            logger.error(f"Temp claim input pin {pin} error: {e}")
            return False
    
    def temp_write(self, pin: int, value: int) -> bool:
        """临时写入引脚值（不需要先申请）
        
        Args:
            pin: GPIO 引脚编号（BCM）
            value: 输出值（0 或 1）
        
        Returns:
            是否成功
        """
        if not self._initialized:
            return False
        
        try:
            if HAS_LGPIO:
                lgpio.gpio_write(self._h, pin, value)
            elif HAS_GPIO:
                GPIO.output(pin, GPIO.HIGH if value else GPIO.LOW)
            return True
        except Exception as e:
            logger.error(f"Temp write pin {pin} error: {e}")
            return False
    
    def temp_read(self, pin: int) -> Optional[int]:
        """临时读取引脚值（不需要先申请）
        
        Args:
            pin: GPIO 引脚编号（BCM）
        
        Returns:
            引脚值（0 或 1），失败返回 None
        """
        if not self._initialized:
            return None
        
        try:
            if HAS_LGPIO:
                return lgpio.gpio_read(self._h, pin)
            elif HAS_GPIO:
                return GPIO.input(pin)
            return None
        except Exception as e:
            logger.error(f"Temp read pin {pin} error: {e}")
            return None
    
    def temp_free(self, pin: int) -> bool:
        """临时释放引脚（不检查占用者）
        
        Args:
            pin: GPIO 引脚编号（BCM）
        
        Returns:
            是否成功
        """
        if not self._initialized:
            return False
        
        try:
            if HAS_LGPIO:
                lgpio.gpio_free(self._h, pin)
            return True
        except Exception as e:
            logger.error(f"Temp free pin {pin} error: {e}")
            return False
    
    def release_all(self):
        """释放所有引脚资源"""
        if not self._initialized:
            return
        
        pins = list(self._pin_owners.keys())
        for pin in pins:
            owner = self._pin_owners[pin][1]
            self.release(pin, owner)
        
        if HAS_LGPIO and self._h is not None:
            try:
                lgpio.gpiochip_close(self._h)
            except Exception as e:
                logger.error(f"Close lgpio chip error: {e}")
        
        if HAS_GPIO:
            try:
                GPIO.cleanup()
            except Exception as e:
                logger.error(f"GPIO cleanup error: {e}")
        
        logger.info("GPIOManager released all resources")
    
    def get_pin_status(self, pin: int) -> Optional[Dict]:
        """获取引脚状态
        
        Args:
            pin: GPIO 引脚编号（BCM）
        
        Returns:
            引脚状态信息
        """
        if pin not in self._pin_owners:
            return None
        
        mode, owner = self._pin_owners[pin]
        info = {"pin": pin, "mode": mode, "owner": owner}
        
        if mode == self.PIN_MODE_PWM:
            info["freq"], info["duty"] = self._pwm_channels.get(pin, (0, 0))
        
        return info
    
    def get_all_pins(self) -> Dict[int, Dict]:
        """获取所有已占用引脚状态"""
        result = {}
        for pin in self._pin_owners:
            result[pin] = self.get_pin_status(pin)
        return result


# 创建全局实例
gpio_manager = GPIOManager()
