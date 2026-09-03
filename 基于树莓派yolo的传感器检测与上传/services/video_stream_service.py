#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""视频流服务 - 提供 MJPEG 实时流和单帧抓取接口

基于 Python 标准库 http.server 实现，无需额外依赖。
支持端点：
    GET /stream      - MJPEG 实时视频流（浏览器 <img> 标签可直接使用）
    GET /snapshot    - 当前帧 JPEG 快照
    GET /status      - 服务状态 JSON

设计思路：
    1. 服务运行在独立线程，不阻塞主系统
    2. 通过 frame_provider 回调从 CameraTracker 获取帧
    3. 多客户端可同时连接 /stream（每个连接独立线程）
    4. 帧抓取失败时返回最后一帧缓存，保证流连续性
"""

import logging
import threading
import time
import io
from typing import Callable, Optional, Dict, Any
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn

logger = logging.getLogger(__name__)


class VideoStreamHandler(BaseHTTPRequestHandler):
    """HTTP 请求处理器 - 处理视频流相关请求"""

    # 静默日志（避免每一帧都打印 access log）
    def log_message(self, format, *args):
        pass

    def do_GET(self):
        """处理 GET 请求，根据路径分发到对应处理器"""
        if self.path == "/stream":
            self._handle_stream()
        elif self.path == "/snapshot":
            self._handle_snapshot()
        elif self.path == "/status":
            self._handle_status()
        elif self.path == "/" or self.path == "/index.html":
            self._handle_index()
        else:
            self._handle_404()

    def _handle_stream(self):
        """处理 MJPEG 流请求

        使用 multipart/x-mixed-replace 协议持续推送 JPEG 帧。
        浏览器中可直接用 <img src="http://host:port/stream"> 显示。
        """
        # 获取服务实例（通过 handler 的 server 属性）
        server: VideoStreamService = self.server.stream_service  # type: ignore
        if server.frame_provider is None:
            self.send_response(503)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"error":"frame_provider not ready"}')
            return

        # MJPEG 流使用 multipart/x-mixed-replace 协议
        boundary = "frameboundary"
        self.send_response(200)
        self.send_header(
            "Content-Type",
            f"multipart/x-mixed-replace; boundary={boundary}"
        )
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Connection", "close")
        self.end_headers()

        fps = server.stream_fps
        frame_interval = 1.0 / fps if fps > 0 else 0.05

        try:
            while server.is_running and not self.wfile.closed:
                frame_data = server.get_frame()
                if frame_data is None:
                    time.sleep(0.05)
                    continue

                # 写入 MJPEG 帧
                header = (
                    f"--{boundary}\r\n"
                    f"Content-Type: image/jpeg\r\n"
                    f"Content-Length: {len(frame_data)}\r\n\r\n"
                ).encode("utf-8")
                self.wfile.write(header)
                self.wfile.write(frame_data)
                self.wfile.write(b"\r\n")
                self.wfile.flush()

                time.sleep(frame_interval)
        except (ConnectionError, BrokenPipeError):
            # 客户端断开连接，正常退出
            pass
        except Exception as e:
            logger.debug(f"Stream connection closed: {e}")

    def _handle_snapshot(self):
        """处理单帧快照请求 - 返回当前 JPEG 帧"""
        server: VideoStreamService = self.server.stream_service  # type: ignore
        frame_data = server.get_frame()
        if frame_data is None:
            self.send_response(503)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"error":"no frame available"}')
            return

        self.send_response(200)
        self.send_header("Content-Type", "image/jpeg")
        self.send_header("Content-Length", str(len(frame_data)))
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.end_headers()
        self.wfile.write(frame_data)

    def _handle_status(self):
        """处理状态查询请求 - 返回服务状态 JSON"""
        server: VideoStreamService = self.server.stream_service  # type: ignore
        status = server.get_status()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        import json
        self.wfile.write(json.dumps(status, ensure_ascii=False).encode("utf-8"))

    def _handle_index(self):
        """根路径返回简单的 HTML 测试页面"""
        html = """<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>摄像头视频流</title>
    <style>
        body { font-family: -apple-system, sans-serif; text-align: center; background: #f5f5f7; margin: 0; padding: 20px; }
        h1 { color: #1d1d1f; font-weight: 500; }
        img { max-width: 100%; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
        .info { color: #6e6e73; margin-top: 20px; font-size: 14px; }
    </style>
</head>
<body>
    <h1>摄像头实时视频流</h1>
    <img src="/stream" alt="视频流" />
    <div class="info">
        <p>MJPEG 实时流端点: <code>/stream</code></p>
        <p>快照端点: <code>/snapshot</code></p>
        <p>状态端点: <code>/status</code></p>
    </div>
</body>
</html>"""
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(html.encode("utf-8"))

    def _handle_404(self):
        """处理未知路径"""
        self.send_response(404)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"error":"not found","available":["/stream","/snapshot","/status"]}')


class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    """多线程 HTTP 服务器 - 每个请求独立线程处理"""
    daemon_threads = True


class VideoStreamService:
    """视频流服务 - 提供 MJPEG 流和快照接口

    使用方式：
        service = VideoStreamService(port=8081, frame_provider=camera.get_jpeg_frame)
        service.start()  # 在后台线程运行
        # ...
        service.stop()

    端点说明：
        - GET /stream    MJPEG 实时流（Content-Type: multipart/x-mixed-replace）
        - GET /snapshot  当前帧 JPEG 快照
        - GET /status    服务状态 JSON
        - GET /          HTML 测试页面
    """

    def __init__(
        self,
        port: int = 8081,
        host: str = "0.0.0.0",
        frame_provider: Optional[Callable[[], Optional[bytes]]] = None,
        stream_fps: int = 15,
        jpeg_quality: int = 70,
    ):
        """初始化视频流服务

        Args:
            port: HTTP 服务端口（默认 8081，避免与 WebSocket 8080 冲突）
            host: 监听地址，默认 0.0.0.0 允许外部访问
            frame_provider: 帧获取回调函数，返回 JPEG 字节流或 None
            stream_fps: MJPEG 流的目标帧率（默认 15）
            jpeg_quality: JPEG 编码质量（1-100，默认 70）
        """
        self.port = port
        self.host = host
        self.frame_provider = frame_provider
        self.stream_fps = stream_fps
        self.jpeg_quality = jpeg_quality

        # 运行时状态
        self._server: Optional[ThreadingHTTPServer] = None
        self._thread: Optional[threading.Thread] = None
        self.is_running = False

        # 帧缓存（避免连续请求时多次调用 frame_provider）
        self._last_frame: Optional[bytes] = None
        self._last_frame_time: float = 0
        self._frame_lock = threading.Lock()
        self._frame_cache_ttl = 0.05  # 帧缓存有效期 50ms

        # 统计信息
        self._stream_clients = 0
        self._total_frames_served = 0
        self._start_time: Optional[float] = None

    def set_frame_provider(self, provider: Callable[[], Optional[bytes]]):
        """设置帧获取回调

        Args:
            provider: 返回 JPEG 字节流的回调函数
        """
        self.frame_provider = provider
        logger.info("视频流帧提供者已设置")

    def get_frame(self) -> Optional[bytes]:
        """获取一帧 JPEG 数据

        优先使用缓存（50ms 内的帧），避免高频请求时多次调用 frame_provider。

        Returns:
            JPEG 字节流或 None
        """
        current_time = time.time()

        with self._frame_lock:
            # 检查缓存是否有效
            if (self._last_frame is not None and
                    current_time - self._last_frame_time < self._frame_cache_ttl):
                return self._last_frame

        # 调用帧提供者获取新帧
        if self.frame_provider is None:
            return None

        try:
            frame_data = self.frame_provider()
            if frame_data is not None:
                with self._frame_lock:
                    self._last_frame = frame_data
                    self._last_frame_time = current_time
                    self._total_frames_served += 1
                return frame_data
        except Exception as e:
            logger.debug(f"获取帧失败: {e}")

        # 返回上一帧缓存（即使过期，保证流连续性）
        with self._frame_lock:
            return self._last_frame

    def start(self):
        """启动视频流服务（异步，在后台线程运行）"""
        if self.is_running:
            logger.warning("视频流服务已在运行")
            return

        try:
            self._server = ThreadingHTTPServer(
                (self.host, self.port),
                VideoStreamHandler
            )
            # 关键：把 VideoStreamService 实例挂到 HTTP server 上，
            # 这样 handler 才能通过 self.server.stream_service 访问到
            # get_frame() / get_status() 等方法（handler 的 self.server
            # 默认指向 ThreadingHTTPServer，而非 VideoStreamService）
            self._server.stream_service = self  # type: ignore[attr-defined]
            self._server.timeout = 1

            self.is_running = True
            self._start_time = time.time()

            self._thread = threading.Thread(
                target=self._serve_loop,
                daemon=True,
                name="video-stream"
            )
            self._thread.start()
            logger.info(
                f"视频流服务已启动 - http://{self.host}:{self.port}/stream "
                f"(FPS={self.stream_fps}, Quality={self.jpeg_quality})"
            )
        except Exception as e:
            logger.error(f"视频流服务启动失败: {e}")
            self.is_running = False
            raise

    def _serve_loop(self):
        """服务运行主循环"""
        while self.is_running and self._server:
            try:
                self._server.handle_request()
            except Exception as e:
                if self.is_running:
                    logger.debug(f"视频流服务请求处理异常: {e}")

    def stop(self):
        """停止视频流服务"""
        if not self.is_running:
            return

        self.is_running = False

        if self._server:
            try:
                self._server.server_close()
            except Exception:
                pass
            self._server = None

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2)

        logger.info("视频流服务已停止")

    def get_status(self) -> Dict[str, Any]:
        """获取服务状态

        Returns:
            状态字典，包含端口、运行状态、服务统计等
        """
        uptime = time.time() - self._start_time if self._start_time else 0
        return {
            "running": self.is_running,
            "host": self.host,
            "port": self.port,
            "stream_url": f"http://{self._get_local_ip()}:{self.port}/stream",
            "snapshot_url": f"http://{self._get_local_ip()}:{self.port}/snapshot",
            "stream_fps": self.stream_fps,
            "jpeg_quality": self.jpeg_quality,
            "frames_served": self._total_frames_served,
            "uptime_seconds": round(uptime, 1),
            "has_frame": self._last_frame is not None,
            "frame_provider_ready": self.frame_provider is not None,
        }

    @staticmethod
    def _get_local_ip() -> str:
        """获取本机局域网 IP 地址

        通过创建临时 socket 获取本机 IP，用于生成可访问的 URL。
        """
        try:
            import socket
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "127.0.0.1"
