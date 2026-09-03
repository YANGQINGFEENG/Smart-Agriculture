#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""WebSocket 客户端服务 - 实时接收服务器推送的控制指令

功能：
1. 建立 WebSocket 连接，携带网关IP参数
2. 实时接收服务器推送的命令
3. 发送命令回执（command_ack）
4. 心跳保活（每30秒）
5. 指数退避重连（1s→2s→4s→...→max 30s）
6. WebSocket 断开时通知系统降级为 HTTP 轮询
"""

import json
import logging
import threading
import time
from typing import Dict, Optional, Callable

try:
    from websocket import create_connection, WebSocketException, WebSocketTimeoutException
    HAS_WEBSOCKET = True
except ImportError:
    HAS_WEBSOCKET = False

logger = logging.getLogger(__name__)


class WebSocketService:
    """WebSocket 客户端服务

    协议说明：
    - 连接后需发送 gateway_register 消息，注册所有执行器 ID
    - 服务器才能将命令正确推送到对应的执行器连接
    """

    def __init__(self, config: Dict, upload_service, command_handler: Callable = None,
                 actuator_ids: list = None, model_handler: Callable = None):
        """初始化 WebSocket 服务

        Args:
            config: 配置字典
            upload_service: 上传服务实例（用于发送 HTTP 回执作为备选）
            command_handler: 命令处理回调函数，接收命令字典作为参数
            actuator_ids: 执行器 ID 列表，用于注册到服务器
            model_handler: 模型切换回调，接收 model_switch 消息的 data 字典，
                           需返回 (success: bool, message: str)
        """
        self.config = config
        self.upload = upload_service
        self.command_handler = command_handler
        self.model_handler = model_handler
        self._actuator_ids = actuator_ids or []  # 执行器 ID 列表
        
        # 连接状态
        self._running = False
        self._connected = False
        self._ws = None
        self._thread = None
        self._stop_event = threading.Event()
        
        # 重连参数
        self._reconnect_delay = 1  # 初始重连延迟（秒）
        self._max_reconnect_delay = 30
        self._reconnect_count = 0
        
        # 心跳参数
        self._heartbeat_interval = 30  # 心跳间隔（秒）
        self._last_heartbeat_time = 0
        
        # 连接参数
        self._server_url = self._get_server_url()
        self._gateway_ip = self._get_gateway_ip()

    def _get_config_value(self, key: str, default=None):
        """从嵌套字典中获取配置值（支持点号分隔）
        
        Args:
            key: 配置键，如 "upload.server_url"
            default: 默认值
        """
        keys = key.split(".")
        value = self.config
        for k in keys:
            if isinstance(value, dict):
                value = value.get(k)
            else:
                return default
            if value is None:
                return default
        return value

    def _get_server_url(self) -> str:
        """获取服务器地址"""
        url = self._get_config_value("upload.server_url", "http://localhost:3000")
        # 替换 http/https 为 ws/wss
        if url.startswith("http://"):
            # 替换 http:// 为 ws://，并使用端口 8080（WebSocket端口）
            return url.replace("http://", "ws://").replace(":3000", ":8080")
        elif url.startswith("https://"):
            # 替换 https:// 为 wss://，并使用端口 8080
            return url.replace("https://", "wss://").replace(":3000", ":8080")
        return f"ws://{url}:8080"

    def _get_gateway_ip(self) -> str:
        """获取网关IP"""
        return self._get_config_value("upload.gateway_ip", "127.0.0.1")

    def is_connected(self) -> bool:
        """检查是否已连接"""
        return self._connected

    def start(self):
        """启动 WebSocket 服务"""
        if not HAS_WEBSOCKET:
            logger.warning("[WebSocket] websocket-client 库未安装，跳过 WebSocket 连接")
            return
        
        if self._running:
            logger.warning("[WebSocket] 服务已在运行")
            return
        
        self._running = True
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True, name="websocket")
        self._thread.start()
        logger.info("[WebSocket] 服务已启动")

    def stop(self):
        """停止 WebSocket 服务"""
        self._running = False
        self._stop_event.set()
        
        # 关闭连接
        if self._ws:
            try:
                self._ws.close()
            except Exception as e:
                logger.error(f"[WebSocket] 关闭连接失败: {e}")
            self._ws = None
        
        # 等待线程结束
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)
        
        self._connected = False
        logger.info("[WebSocket] 服务已停止")

    def _run(self):
        """WebSocket 主循环"""
        while self._running:
            try:
                # 建立连接
                self._connect()
                
                if self._connected:
                    # 连接成功，重置重连参数
                    self._reconnect_delay = 1
                    self._reconnect_count = 0
                    
                    # 接收消息循环
                    self._receive_loop()
                else:
                    # 连接失败，等待后重试
                    self._wait_reconnect()
            except Exception as e:
                logger.error(f"[WebSocket] 主循环异常: {e}")
                self._connected = False
                self._wait_reconnect()

    def _connect(self):
        """建立 WebSocket 连接并注册执行器"""
        try:
            ws_url = f"{self._server_url}?gateway_ip={self._gateway_ip}"
            logger.info(f"[WebSocket] 正在连接: {ws_url}")
            
            self._ws = create_connection(ws_url, timeout=10)
            self._connected = True
            self._last_heartbeat_time = time.time()
            
            logger.info("[WebSocket] 连接成功")
            
            # 等待服务器的 welcome 消息
            try:
                msg = self._ws.recv()
                data = json.loads(msg)
                if data.get("type") == "welcome":
                    logger.info(f"[WebSocket] 收到欢迎消息: {data.get('message', '')}")
            except Exception as e:
                logger.debug(f"[WebSocket] 等待欢迎消息超时或异常: {e}")
            
            # 关键：发送网关注册消息，注册所有执行器 ID
            self._register_gateway()
            
            # 发送心跳
            self._send_heartbeat()
            
        except WebSocketException as e:
            logger.error(f"[WebSocket] 连接失败: {e}")
            self._connected = False
        except Exception as e:
            logger.error(f"[WebSocket] 连接异常: {e}")
            self._connected = False
    
    def _register_gateway(self):
        """发送网关注册消息，将所有执行器 ID 注册到服务器
        
        服务器需要知道这个连接对应哪些执行器，
        才能将命令正确推送到对应的执行器。
        """
        if not self._actuator_ids:
            logger.warning("[WebSocket] 无执行器 ID 可注册")
            return
        
        try:
            # 获取网关配置信息
            farm_id = self._get_config_value("device.farm_id", 1)
            area = self._get_config_value("device.area", "")
            mac = self._get_config_value("device.mac", "")
            
            register_msg = {
                "type": "gateway_register",
                "data": {
                    "gateway_ip": self._gateway_ip,
                    "mac": mac,
                    "farm_id": farm_id,
                    "area": area,
                    "actuator_ids": self._actuator_ids  # 注册所有执行器 ID
                }
            }
            
            self._ws.send(json.dumps(register_msg))
            logger.info(f"[WebSocket] 网关注册成功: {len(self._actuator_ids)} 个执行器 - {self._actuator_ids}")
            
        except Exception as e:
            logger.error(f"[WebSocket] 网关注册失败: {e}")

    def _receive_loop(self):
        """接收消息循环"""
        while self._running and self._connected:
            try:
                # 设置超时，以便定期检查心跳和退出信号
                self._ws.settimeout(30)
                
                msg = self._ws.recv()
                if not msg:
                    continue
                
                self._process_message(msg)
                
            except WebSocketTimeoutException:
                # 超时是正常的，只是没有新消息，继续等待
                # 借此机会检查心跳
                self._check_heartbeat()
                continue
                
            except WebSocketException as e:
                # 真正的 WebSocket 错误才断开重连
                logger.error(f"[WebSocket] 接收消息失败: {e}")
                self._connected = False
                break
            except Exception as e:
                logger.error(f"[WebSocket] 接收消息异常: {e}")
                self._connected = False
                break
            
            # 检查心跳
            self._check_heartbeat()

    def _process_message(self, msg: str):
        """处理收到的消息"""
        try:
            data = json.loads(msg)
            msg_type = data.get("type", "")
            
            if msg_type == "command":
                # 收到控制指令
                cmd_data = data.get("data", {})
                logger.info(f"[WebSocket] 收到命令: {cmd_data}")
                
                # 调用命令处理回调
                if self.command_handler:
                    self.command_handler(cmd_data)
                
            elif msg_type == "model_switch":
                # 收到云端下发的识别模型切换指令
                model_data = data.get("data", {})
                logger.info(f"[WebSocket] 收到模型切换指令: {model_data}")
                self._handle_model_switch(model_data)

            elif msg_type == "heartbeat_ack":
                # 心跳回执
                logger.debug("[WebSocket] 收到心跳回执")
                
            elif msg_type == "welcome":
                # 欢迎消息
                logger.info(f"[WebSocket] 欢迎消息: {data.get('message', '')}")
                
            elif msg_type == "error":
                # 错误消息
                logger.error(f"[WebSocket] 错误: {data.get('message', '')}")
                
            else:
                logger.debug(f"[WebSocket] 未知消息类型: {msg_type}")
                
        except json.JSONDecodeError as e:
            logger.error(f"[WebSocket] 消息解析失败: {e}, 原始消息: {msg}")
        except Exception as e:
            logger.error(f"[WebSocket] 处理消息异常: {e}")

    def _handle_model_switch(self, model_data: Dict):
        """处理模型切换指令并回报结果

        指令格式：
        {
          "type": "model_switch",
          "data": {
            "request_id": 12,
            "filename": "yolo11n.pt",
            "file_url": "http://.../uploads/yolo-models/xxx.pt",  # 可选
            "model_id": 3                                          # 可选
          }
        }
        """
        request_id = model_data.get("request_id")
        filename = model_data.get("filename") or ""
        file_url = model_data.get("file_url") or None

        if not self.model_handler:
            logger.warning("[WebSocket] 未注册模型切换处理器，忽略指令")
            self.send_model_status({
                "request_id": request_id,
                "success": False,
                "message": "硬件端未启用模型管理",
            })
            return

        try:
            result = self.model_handler({
                "request_id": request_id,
                "filename": filename,
                "file_url": file_url,
                "model_id": model_data.get("model_id"),
            })
            # 兼容 (bool, str) 元组与布尔返回
            if isinstance(result, tuple):
                success, message = result[0], result[1] if len(result) > 1 else ""
            else:
                success, message = bool(result), ""
        except Exception as e:
            logger.error(f"[WebSocket] 模型切换处理异常: {e}")
            success, message = False, f"切换异常: {e}"

        self.send_model_status({
            "request_id": request_id,
            "filename": filename,
            "success": success,
            "message": message,
        })

    def send_model_status(self, extra: Dict = None) -> bool:
        """发送模型状态/切换结果消息（type=model_status）

        Args:
            extra: 附加字段（如 request_id/success/message/current_model）
        """
        payload = {"type": "model_status", "data": {"gateway_ip": self._gateway_ip}}
        if extra:
            payload["data"].update(extra)

        if self._connected and self._ws:
            try:
                self._ws.send(json.dumps(payload, ensure_ascii=False))
                logger.info(f"[WebSocket] 发送模型状态: {payload['data']}")
                return True
            except Exception as e:
                logger.error(f"[WebSocket] 发送模型状态失败: {e}")
        return False

    def _send_heartbeat(self):
        """发送心跳"""
        try:
            heartbeat_msg = json.dumps({"type": "heartbeat"})
            self._ws.send(heartbeat_msg)
            self._last_heartbeat_time = time.time()
            logger.debug("[WebSocket] 发送心跳")
        except Exception as e:
            logger.error(f"[WebSocket] 发送心跳失败: {e}")

    def _check_heartbeat(self):
        """检查心跳，超时则重连"""
        now = time.time()
        if now - self._last_heartbeat_time > self._heartbeat_interval:
            self._send_heartbeat()

    def _wait_reconnect(self):
        """等待重连"""
        if not self._running:
            return
        
        wait_time = min(self._reconnect_delay, self._max_reconnect_delay)
        logger.info(f"[WebSocket] {wait_time}秒后尝试重连...")
        
        # 等待期间检查停止信号
        if self._stop_event.wait(timeout=wait_time):
            return
        
        # 指数退避
        self._reconnect_delay *= 2
        self._reconnect_count += 1

    def send_command_ack(self, actuator_id: str, command_id: int, 
                        status: str, control_value: float = None,
                        state: str = None):
        """发送命令回执（优先使用 WebSocket，失败则使用 HTTP）
        
        按协议规范，回执消息使用 data 嵌套结构：
        {
          "type": "command_ack",
          "data": {
            "command_id": 123,
            "actuator_id": "LT-1-002",
            "status": "executed",
            "state": "on",
            "control_value": 75
          }
        }

        Args:
            actuator_id: 执行器ID（节点ID）
            command_id: 命令ID
            status: 执行状态（executed/failed）
            control_value: 实际控制值
            state: 执行器状态 (on/off)
        """
        if self._connected and self._ws:
            try:
                # 按文档要求使用 data 嵌套结构
                ack_data = {
                    "command_id": command_id,
                    "actuator_id": actuator_id,
                    "status": status,
                }
                if control_value is not None:
                    ack_data["control_value"] = control_value
                if state is not None:
                    ack_data["state"] = state
                
                ack_msg = {
                    "type": "command_ack",
                    "data": ack_data
                }
                
                self._ws.send(json.dumps(ack_msg))
                logger.info(f"[WebSocket] 发送回执: {ack_msg}")
                return True
            except Exception as e:
                logger.error(f"[WebSocket] 发送回执失败，切换到 HTTP: {e}")
        
        # WebSocket 不可用，使用 HTTP 发送回执
        return self._send_ack_via_http(actuator_id, command_id, status, control_value, state)

    def _send_ack_via_http(self, actuator_id: str, command_id: int, 
                           status: str, control_value: float = None,
                           state: str = None) -> bool:
        """通过 HTTP 发送命令回执

        Args:
            actuator_id: 执行器ID
            command_id: 命令ID
            status: 执行状态
            control_value: 实际控制值
            state: 执行器状态 (on/off)

        Returns:
            是否成功
        """
        try:
            if self.upload:
                result = self.upload.send_ack(actuator_id, command_id, status, control_value, state)
                return result.get("success", False)
        except Exception as e:
            logger.error(f"[WebSocket] HTTP 回执发送失败: {e}")
        return False
