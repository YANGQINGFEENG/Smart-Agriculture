#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""YOLO 模型管理服务 - 支持云端下发切换识别模型

功能：
    1. 扫描本地模型目录（models/*.pt），列出可用模型
    2. 拉取云端模型清单（GET /api/device/yolo-models）
    3. 按需下载模型文件（云端自定义模型走 HTTP 下载；官方通用模型走 ultralytics 自动下载）
    4. 运行时热切换 YOLODetector 使用的模型（switch_model）
    5. 持久化当前选用模型（data/model_state.json），重启后保持
    6. 上报当前模型状态到云端（POST /api/device/yolo-models/status）

使用方式：
    manager = ModelManager(config, detector)
    manager.ensure_official_models()          # 启动时确保官方通用模型就位
    manager.restore_last_model()              # 恢复上次云端选择的模型
    ok, msg = manager.switch_to("yolo11n.pt") # 云端下发切换
    manager.report_status()                   # 上报状态
"""

import json
import logging
import os
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

import requests

logger = logging.getLogger(__name__)

# 官方通用模型（ultralytics 提供，COCO 80 类通用检测）
# 注：服务跑在 ~/smart-farm/venv（ultralytics 8.4.138），v8/v11 系列均可加载；
#     系统 python3 为 8.1.19（不支持 yolo11），做模型诊断时务必用 venv 解释器
OFFICIAL_MODELS = ["yolov8n.pt", "yolo11n.pt"]


class ModelManager:
    """YOLO 模型管理器 - 本地清单 + 云端清单 + 热切换 + 状态上报"""

    def __init__(self, config, detector=None, project_root: str = "."):
        """初始化模型管理器

        Args:
            config: ConfigManager 实例
            detector: YOLODetector 实例（可为 None，后续通过 set_detector 注入）
            project_root: 项目根目录（模型目录与状态文件基于此解析）
        """
        self.config = config
        self.detector = detector
        self.project_root = project_root

        yolo_config = config.get("yolo", {}) or {}
        self.models_dir = yolo_config.get("models_dir", "models")
        self.official_models = yolo_config.get("official_models", OFFICIAL_MODELS) or OFFICIAL_MODELS
        self.sync_on_startup = bool(yolo_config.get("sync_on_startup", True))
        self.state_file = os.path.join(project_root, "data", "model_state.json")

        self._lock = threading.Lock()
        self._switching = False
        self._last_error: Optional[str] = None
        self._last_switch_at: Optional[str] = None
        self._last_request_id: Optional[Any] = None
        self._last_switch_result: Optional[Dict[str, Any]] = None
        # 切换回执只随首次成功的上报发送，避免周期上报重复回填云端日志
        self._switch_result_reported = False
        self._report_thread: Optional[threading.Thread] = None
        self._report_stop: Optional[threading.Event] = None

    # ------------------------------------------------------------------ 基础

    def set_detector(self, detector):
        """注入/更新 YOLODetector 实例"""
        self.detector = detector

    def _server_url(self) -> str:
        return (self.config.get("upload.server_url", "http://localhost:3000") or "").rstrip("/")

    def _gateway_ip(self) -> str:
        return self.config.get("upload.gateway_ip", "127.0.0.1")

    def _timeout(self) -> int:
        return int(self.config.get("upload.timeout", 10) or 10)

    def _abs_model_path(self, filename: str) -> str:
        """把模型文件名解析为项目内绝对路径"""
        if os.path.isabs(filename):
            return filename
        return os.path.join(self.project_root, self.models_dir, filename)

    def current_model(self) -> Optional[str]:
        """当前检测器使用的模型（文件名或路径）"""
        if not self.detector:
            return None
        return getattr(self.detector, "model_path", None)

    # ------------------------------------------------------------ 本地清单

    def list_local_models(self) -> List[Dict[str, Any]]:
        """扫描本地模型目录，返回 .pt 文件清单

        Returns:
            [{"filename","path","size_mb","modified_at","is_active","source"}]
        """
        models: List[Dict[str, Any]] = []
        models_abs = os.path.join(self.project_root, self.models_dir)
        current = self.current_model()

        if not os.path.isdir(models_abs):
            logger.warning(f"[模型管理] 模型目录不存在: {models_abs}")
            return models

        for name in sorted(os.listdir(models_abs)):
            if not name.endswith(".pt"):
                continue
            path = os.path.join(models_abs, name)
            try:
                stat = os.stat(path)
            except OSError:
                continue

            source = "official" if name in self.official_models else "custom"
            models.append({
                "filename": name,
                "path": path,
                "size_mb": round(stat.st_size / 1024 / 1024, 2),
                "modified_at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(stat.st_mtime)),
                "is_active": bool(current and os.path.abspath(current) == os.path.abspath(path)),
                "source": source,
            })

        return models

    # ------------------------------------------------------------ 云端清单

    def fetch_cloud_models(self) -> List[Dict[str, Any]]:
        """拉取云端登记的模型清单（GET /api/device/yolo-models）"""
        try:
            resp = requests.get(
                f"{self._server_url()}/api/device/yolo-models",
                params={"gateway_ip": self._gateway_ip()},
                timeout=self._timeout(),
            )
            if resp.status_code == 200:
                data = resp.json() or {}
                if data.get("success"):
                    return (data.get("data") or {}).get("models") or []
                logger.warning(f"[模型管理] 云端清单返回失败: {data.get('error')}")
            else:
                logger.warning(f"[模型管理] 云端清单 HTTP {resp.status_code}")
        except requests.exceptions.RequestException as e:
            logger.warning(f"[模型管理] 拉取云端清单失败: {e}")
        except Exception as e:
            logger.error(f"[模型管理] 解析云端清单异常: {e}")
        return []

    # ------------------------------------------------------------ 下载模型

    def ensure_official_models(self) -> List[str]:
        """确保官方通用模型在本地就位（不存在则下载）

        Returns:
            成功就位的官方模型文件名列表
        """
        ready: List[str] = []
        local = {m["filename"] for m in self.list_local_models()}

        for name in self.official_models:
            if name in local:
                ready.append(name)
                continue
            if self.download_official_model(name):
                ready.append(name)
        return ready

    def download_official_model(self, name: str) -> bool:
        """下载 ultralytics 官方通用模型到本地模型目录

        优先走云端镜像（若云端登记了同名模型的 file_url），否则由 ultralytics
        按模型名自动下载（需要外网）。

        Args:
            name: 官方模型名，如 yolo11n.pt
        """
        target = self._abs_model_path(name)
        os.makedirs(os.path.dirname(target), exist_ok=True)

        # 1. 尝试云端镜像
        for item in self.fetch_cloud_models():
            if item.get("filename") == name and item.get("file_url"):
                if self._download_file(item["file_url"], target):
                    return True

        # 2. 交给 ultralytics 自动下载（下载到当前工作目录后移动到模型目录）
        try:
            from ultralytics import YOLO

            logger.info(f"[模型管理] 通过 ultralytics 下载官方模型: {name}")
            model = YOLO(name)  # 触发自动下载到 cwd
            src = os.path.abspath(name)
            if os.path.exists(src) and os.path.abspath(src) != os.path.abspath(target):
                os.replace(src, target)
            elif not os.path.exists(target):
                # ultralytics 可能下载到其缓存目录，尝试定位
                cache_path = os.path.join(os.path.expanduser("~"), ".config", "Ultralytics", name)
                if os.path.exists(cache_path):
                    os.replace(cache_path, target)
                else:
                    logger.error(f"[模型管理] 官方模型下载后未找到文件: {name}")
                    return False
            logger.info(f"[模型管理] 官方模型就位: {target} "
                        f"({len(getattr(model, 'names', {}) or {})} 类)")
            return True
        except Exception as e:
            logger.error(f"[模型管理] 官方模型下载失败 {name}: {e}")
            self._last_error = (
                f"官方模型下载失败（可改用网页端上传，或手动放入 {self.models_dir}/）: {e}"
            )
            return False

    def download_cloud_model(self, filename: str, file_url: str) -> bool:
        """从云端下载自定义模型文件到本地模型目录"""
        if not file_url:
            logger.error(f"[模型管理] 云端模型缺少下载地址: {filename}")
            return False
        target = self._abs_model_path(filename)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        return self._download_file(file_url, target)

    def _download_file(self, url: str, target: str) -> bool:
        """流式下载文件（临时文件 + 原子替换，避免半截文件被加载）"""
        tmp = f"{target}.part"
        try:
            logger.info(f"[模型管理] 下载模型: {url}")
            with requests.get(url, stream=True, timeout=max(self._timeout(), 60)) as resp:
                resp.raise_for_status()
                total = int(resp.headers.get("Content-Length") or 0)
                received = 0
                with open(tmp, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=1024 * 256):
                        if not chunk:
                            continue
                        f.write(chunk)
                        received += len(chunk)
            if total and received != total:
                logger.error(f"[模型管理] 下载不完整: {received}/{total} 字节")
                os.remove(tmp)
                return False
            os.replace(tmp, target)
            logger.info(f"[模型管理] 下载完成: {target} ({round(received / 1024 / 1024, 2)}MB)")
            return True
        except Exception as e:
            logger.error(f"[模型管理] 下载失败 {url}: {e}")
            self._last_error = f"模型下载失败: {e}"
            if os.path.exists(tmp):
                try:
                    os.remove(tmp)
                except OSError:
                    pass
            return False

    # ------------------------------------------------------------ 切换模型

    def switch_to(self, model_ref: str, file_url: str = None,
                  report: bool = True, request_id: Any = None) -> Tuple[bool, str]:
        """切换到指定模型（云端下发或本地调用）

        Args:
            model_ref: 模型文件名（如 yolo11n.pt / last.pt）或绝对路径
            file_url: 本地缺失时的下载地址（可选）
            report: 切换后是否上报状态到云端
            request_id: 云端切换请求ID（可选，随状态上报回填切换记录）

        Returns:
            (是否成功, 说明信息)
        """
        if not self.detector:
            return False, "检测器未初始化，无法切换模型"

        with self._lock:
            if self._switching:
                return False, "已有切换任务进行中"
            self._switching = True

        self._last_request_id = request_id
        try:
            ok, msg = self._do_switch(model_ref, file_url)
        finally:
            with self._lock:
                self._switching = False

        # 先记录切换结果，再上报最新状态（云端据 request_id 回填切换记录）
        if request_id is not None:
            self._last_switch_result = {
                "request_id": request_id,
                "success": bool(ok),
                "message": msg,
                "current_model": os.path.basename(self.current_model() or "") or None,
                "finished_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            }
            self._switch_result_reported = False
        if report or request_id is not None:
            self.report_status()
        return bool(ok), msg

    def _do_switch(self, model_ref: str, file_url: str = None) -> Tuple[bool, str]:
        """执行切换：必要时下载 -> 热加载 -> 同步配置与持久化状态"""
        try:
            filename = os.path.basename(model_ref) if not os.path.isabs(model_ref) else model_ref
            path = model_ref if os.path.isabs(model_ref) else self._abs_model_path(filename)

            # 本地缺失则先下载
            if not os.path.exists(path):
                if file_url:
                    if not self.download_cloud_model(filename, file_url):
                        return False, f"模型下载失败: {filename}"
                elif filename in self.official_models:
                    if not self.download_official_model(filename):
                        return False, f"官方模型下载失败: {filename}"
                else:
                    return False, f"本地不存在模型文件且无下载地址: {filename}"

            before = self.current_model()
            loaded = self.detector.switch_model(path)
            if not loaded:
                self._last_error = f"模型加载失败: {filename}"
                return False, (f"模型加载失败: {filename}"
                               f"（已保留原模型 {os.path.basename(before or '-')}）")

            # 同步内存配置，使状态上报与后续逻辑一致
            try:
                self.config.set("yolo.model_path", path)
            except Exception:
                pass

            self._save_state(filename, path)
            self._last_switch_at = time.strftime("%Y-%m-%d %H:%M:%S")
            self._last_error = None

            status = self.detector.get_status() if hasattr(self.detector, "get_status") else {}
            msg = (f"已切换到 {filename}，类别数 {status.get('class_count', 0)}"
                   f"（原模型 {os.path.basename(before or '-')}）")
            logger.info(f"[模型管理] {msg}")
            return True, msg
        except Exception as e:
            logger.error(f"[模型管理] 切换异常: {e}")
            self._last_error = str(e)
            return False, f"切换异常: {e}"

    # ------------------------------------------------------------ 状态持久化

    def _save_state(self, filename: str, path: str):
        """持久化当前选用模型（重启后恢复）"""
        try:
            os.makedirs(os.path.dirname(self.state_file), exist_ok=True)
            with open(self.state_file, "w", encoding="utf-8") as f:
                json.dump({
                    "filename": filename,
                    "path": path,
                    "switched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                }, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.warning(f"[模型管理] 状态持久化失败: {e}")

    def _load_state(self) -> Dict[str, Any]:
        try:
            if os.path.exists(self.state_file):
                with open(self.state_file, "r", encoding="utf-8") as f:
                    return json.load(f) or {}
        except Exception as e:
            logger.warning(f"[模型管理] 状态读取失败: {e}")
        return {}

    def restore_last_model(self) -> bool:
        """恢复上次云端选择的模型（服务重启后调用）

        Returns:
            是否执行了恢复切换
        """
        state = self._load_state()
        filename = state.get("filename")
        path = state.get("path") or (self._abs_model_path(filename) if filename else None)
        if not filename or not path or not os.path.exists(path):
            return False
        if self.current_model() and os.path.abspath(self.current_model()) == os.path.abspath(path):
            logger.info(f"[模型管理] 当前已是持久化模型: {filename}")
            return False

        logger.info(f"[模型管理] 恢复上次选择的模型: {filename}")
        ok, msg = self.switch_to(filename, report=False)
        logger.info(f"[模型管理] 恢复结果: {msg}")
        return ok

    def reconcile_with_cloud(self) -> bool:
        """与云端清单对齐：若云端期望模型与当前不一致则补做切换

        用于覆盖离线场景：WebSocket 断开期间云端下发的切换指令会在
        重连/重启后由本方法补执行。

        Returns:
            是否执行了切换
        """
        if not self.sync_on_startup:
            return False

        desired = None
        for item in self.fetch_cloud_models():
            if item.get("is_active"):
                desired = item
                break

        if not desired:
            logger.debug("[模型管理] 云端未指定期望模型，跳过对齐")
            return False

        filename = desired.get("filename")
        if not filename:
            return False

        current = self.current_model()
        if current and os.path.basename(current) == filename:
            logger.info(f"[模型管理] 已与云端期望模型一致: {filename}")
            return False

        logger.info(f"[模型管理] 与云端对齐：{os.path.basename(current or '-')} -> {filename}")
        ok, msg = self.switch_to(filename, file_url=desired.get("file_url"))
        logger.info(f"[模型管理] 对齐结果: {msg}")
        return ok

    # ------------------------------------------------------------ 状态上报

    def build_status_payload(self) -> Dict[str, Any]:
        """构造上报云端的模型状态数据"""
        detector_status = {}
        if self.detector and hasattr(self.detector, "get_status"):
            try:
                detector_status = self.detector.get_status() or {}
            except Exception as e:
                logger.warning(f"[模型管理] 读取检测器状态失败: {e}")

        current = self.current_model()
        return {
            "gateway_ip": self._gateway_ip(),
            "current_model": os.path.basename(current) if current else None,
            "current_model_path": current,
            "loaded": detector_status.get("loaded", False),
            "class_count": detector_status.get("class_count", 0),
            "class_names": (detector_status.get("class_names") or [])[:80],
            "img_size": detector_status.get("img_size"),
            "conf_threshold": detector_status.get("conf_threshold"),
            "avg_inference_time_ms": detector_status.get("avg_inference_time_ms"),
            "total_inferences": detector_status.get("total_inferences", 0),
            "switch_count": detector_status.get("switch_count", 0),
            "last_switch_at": self._last_switch_at or detector_status.get("last_switch_at"),
            "last_error": self._last_error,
            "switching": self._switching,
            "request_id": self._last_request_id,
            "switch_result": (None if self._switch_result_reported else self._last_switch_result),
            "local_models": [
                {k: m[k] for k in ("filename", "size_mb", "modified_at", "is_active", "source")}
                for m in self.list_local_models()
            ],
            "reported_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        }

    def report_status(self, quiet: bool = False) -> bool:
        """上报当前模型状态到云端（POST /api/device/yolo-models/status）

        Args:
            quiet: True 时成功不打印 INFO 日志（周期性上报用，避免刷屏）
        """
        payload = self.build_status_payload()
        try:
            resp = requests.post(
                f"{self._server_url()}/api/device/yolo-models/status",
                json=payload,
                timeout=self._timeout(),
            )
            if resp.status_code in (200, 201):
                if payload.get("switch_result"):
                    self._switch_result_reported = True
                log = logger.debug if quiet else logger.info
                log(f"[模型管理] 状态上报成功: 当前模型 {payload.get('current_model')}")
                return True
            logger.warning(f"[模型管理] 状态上报失败 HTTP {resp.status_code}: {resp.text[:200]}")
        except requests.exceptions.RequestException as e:
            logger.warning(f"[模型管理] 状态上报异常: {e}")
        except Exception as e:
            logger.error(f"[模型管理] 状态上报错误: {e}")
        return False

    def start_periodic_report(self, interval: Optional[int] = None) -> bool:
        """启动周期性状态上报

        仅在启动/切换时上报会让云端的"累计推理次数、平均推理耗时"长期停留在
        切换瞬间的 0，故按固定间隔补报，让网页端看到实时指标。

        Args:
            interval: 上报间隔秒数，缺省读 yolo.status_report_interval（默认 60）；<=0 表示禁用
        """
        if self._report_thread and self._report_thread.is_alive():
            return True

        try:
            seconds = int(
                interval if interval is not None
                else self.config.get("yolo.status_report_interval", 60) or 60
            )
        except (TypeError, ValueError):
            seconds = 60

        if seconds <= 0:
            logger.info("[模型管理] 周期性状态上报已禁用")
            return False

        self._report_stop = threading.Event()
        stop_event = self._report_stop

        def loop():
            logger.info(f"[模型管理] 周期性状态上报已启动: 每 {seconds}s")
            while not stop_event.wait(seconds):
                try:
                    self.report_status(quiet=True)
                except Exception as e:
                    logger.warning(f"[模型管理] 周期上报异常: {e}")

        self._report_thread = threading.Thread(
            target=loop, daemon=True, name="model-status-report"
        )
        self._report_thread.start()
        return True

    def stop_periodic_report(self):
        """停止周期性状态上报"""
        if self._report_stop:
            self._report_stop.set()

    def get_manager_status(self) -> Dict[str, Any]:
        """供系统状态接口调用的摘要"""
        return {
            "current_model": os.path.basename(self.current_model() or "") or None,
            "models_dir": self.models_dir,
            "local_model_count": len(self.list_local_models()),
            "official_models": self.official_models,
            "switching": self._switching,
            "last_switch_at": self._last_switch_at,
            "last_error": self._last_error,
            "last_request_id": self._last_request_id,
            "last_switch_result": self._last_switch_result,
        }
