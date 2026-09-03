#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""UI 页面 - 各功能页面（仪表盘/网络配置/设备管理/扫描/OTA）"""

import tkinter as tk
from tkinter import ttk, messagebox
from typing import Optional, Callable, List, Dict, Any
from datetime import datetime

from ui.theme import Theme
from ui.widgets import (
    Card, PrimaryButton, SecondaryButton, DangerButton,
    LabeledInput, Switch, StatusIndicator, PageHeader,
)


class BasePage(tk.Frame):
    """页面基类"""

    name = "base"
    title = "页面"

    def __init__(self, parent, app, **kwargs):
        """初始化页面

        Args:
            parent: 父容器
            app: 主应用实例 (MainWindow)
        """
        super().__init__(parent, bg=Theme.BG_PRIMARY, **kwargs)
        self.app = app
        self._build_ui()

    def _build_ui(self):
        """构建 UI（子类实现）"""
        pass

    def on_show(self):
        """页面显示时回调"""
        pass

    def on_hide(self):
        """页面隐藏时回调"""
        pass


class DashboardPage(BasePage):
    """仪表盘页面 - 显示系统运行状态"""

    name = "dashboard"
    title = "仪表盘"

    def _build_ui(self):
        """构建仪表盘界面"""
        PageHeader(self, "智慧农业硬件系统", "实时监控与远程上传").pack(fill="x")

        # 系统状态卡片
        status_card = Card(self)
        status_card.pack(fill="x", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        tk.Label(
            status_card, text="系统状态",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_PRIMARY,
            font=Theme.get_font(Theme.FONT_HEADLINE, bold=True),
        ).pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        # 状态指示器
        self.status_system = StatusIndicator(status_card, "success", "运行中")
        self.status_system.pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_SM)

        self.status_upload = StatusIndicator(status_card, "idle", "上传服务未启动")
        self.status_upload.pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_SM)

        self.status_heartbeat = StatusIndicator(status_card, "idle", "心跳服务未启动")
        self.status_heartbeat.pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_SM)

        self.status_scanner = StatusIndicator(status_card, "idle", "设备扫描器就绪")
        self.status_scanner.pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_SM)

        # 设备统计卡片
        dev_card = Card(self)
        dev_card.pack(fill="x", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        tk.Label(
            dev_card, text="设备统计",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_PRIMARY,
            font=Theme.get_font(Theme.FONT_HEADLINE, bold=True),
        ).pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        self.label_sensor_count = tk.Label(
            dev_card, text="传感器: 0 个",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_SECONDARY,
            font=Theme.get_body_font(), anchor="w",
        )
        self.label_sensor_count.pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_SM)

        self.label_actuator_count = tk.Label(
            dev_card, text="执行器: 0 个",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_SECONDARY,
            font=Theme.get_body_font(), anchor="w",
        )
        self.label_actuator_count.pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_SM)

        # 服务器信息卡片
        server_card = Card(self)
        server_card.pack(fill="x", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        tk.Label(
            server_card, text="服务器信息",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_PRIMARY,
            font=Theme.get_font(Theme.FONT_HEADLINE, bold=True),
        ).pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        self.label_server_url = tk.Label(
            server_card, text="服务器地址: --",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_SECONDARY,
            font=Theme.get_body_font(), anchor="w",
        )
        self.label_server_url.pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_SM)

        self.label_last_upload = tk.Label(
            server_card, text="最后上传: 从未",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_SECONDARY,
            font=Theme.get_body_font(), anchor="w",
        )
        self.label_last_upload.pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_SM)

        self.label_upload_count = tk.Label(
            server_card, text="上传次数: 0",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_SECONDARY,
            font=Theme.get_body_font(), anchor="w",
        )
        self.label_upload_count.pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_SM)

        # 操作按钮
        btn_frame = tk.Frame(self, bg=Theme.BG_PRIMARY)
        btn_frame.pack(fill="x", padx=Theme.SPACING_LG, pady=Theme.SPACING_LG)

        PrimaryButton(btn_frame, "刷新状态", command=self.refresh_status).pack(
            side="left", padx=(0, Theme.SPACING_SM), fill="x", expand=True
        )
        SecondaryButton(btn_frame, "系统日志", command=self._show_logs).pack(
            side="left", fill="x", expand=True
        )

    def on_show(self):
        """页面显示时刷新状态"""
        self.refresh_status()

    def refresh_status(self):
        """刷新仪表盘状态"""
        if not self.app.system:
            return

        try:
            # 获取系统状态
            status = self.app.system.get_status()
            sensors = status.get("sensors", {})
            actuators = status.get("actuators", {})

            self.label_sensor_count.config(text=f"传感器: {len(sensors)} 个")
            self.label_actuator_count.config(text=f"执行器: {len(actuators)} 个")

            # 服务器信息
            upload_status = self.app.system.upload.get_status() if self.app.system.upload else None
            if upload_status:
                self.label_server_url.config(text=f"服务器地址: {upload_status.get('server_url', '--')}")
                last_time = upload_status.get("last_upload_time")
                if last_time:
                    self.label_last_upload.config(text=f"最后上传: {last_time}")
                self.label_upload_count.config(text=f"失败次数: {upload_status.get('fail_count', 0)}")

                # 更新状态指示器
                if upload_status.get("running"):
                    self.status_upload.set_status("success", "上传服务运行中")
                else:
                    self.status_upload.set_status("idle", "上传服务已停止")
        except Exception as e:
            self.status_system.set_status("error", f"刷新失败: {e}")

    def _show_logs(self):
        """查看日志（简单弹窗显示）"""
        try:
            log_file = "logs/system.log"
            import os
            if os.path.exists(log_file):
                # 显示最后 50 行
                with open(log_file, "r", encoding="utf-8") as f:
                    lines = f.readlines()[-50:]
                log_content = "".join(lines[-50:])
            else:
                log_content = "暂无日志"

            top = tk.Toplevel(self)
            top.title("系统日志")
            top.geometry("800x600")
            top.configure(bg=Theme.BG_PRIMARY)

            text = tk.Text(top, bg=Theme.BG_SECONDARY, fg=Theme.TEXT_PRIMARY,
                          font=Theme.get_font(Theme.FONT_CAPTION), wrap="word")
            text.pack(fill="both", expand=True, padx=Theme.SPACING_LG, pady=Theme.SPACING_LG)
            text.insert("1.0", log_content)
            text.config(state="disabled")
        except Exception as e:
            messagebox.showerror("错误", f"读取日志失败: {e}")


class NetworkConfigPage(BasePage):
    """网络配置页面 - 配置服务器地址、上传间隔等"""

    name = "network"
    title = "网络配置"

    def _build_ui(self):
        """构建网络配置界面"""
        PageHeader(self, "网络配置", "上传服务器和参数设置").pack(fill="x")

        # 服务器配置卡片
        server_card = Card(self)
        server_card.pack(fill="x", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        tk.Label(
            server_card, text="服务器配置",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_PRIMARY,
            font=Theme.get_font(Theme.FONT_HEADLINE, bold=True),
        ).pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        # 当前配置
        config = self.app.config
        self.input_server_url = LabeledInput(
            server_card, "服务器地址",
            value=config.get("upload.server_url", "http://10.248.88.151:3000"),
            placeholder="http://your-server:3000",
        )
        self.input_server_url.pack(fill="x")

        self.input_gateway_ip = LabeledInput(
            server_card, "网关 IP 地址",
            value=config.get("upload.gateway_ip", "10.248.88.186"),
        )
        self.input_gateway_ip.pack(fill="x")

        self.input_farm_id = LabeledInput(
            server_card, "农场 ID",
            value=str(config.get("upload.farm_id", 1)),
            input_type="number",
        )
        self.input_farm_id.pack(fill="x")

        self.input_area = LabeledInput(
            server_card, "区域名称",
            value=config.get("upload.area", "温室1号区域"),
        )
        self.input_area.pack(fill="x")

        # 上传参数卡片
        param_card = Card(self)
        param_card.pack(fill="x", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        tk.Label(
            param_card, text="上传参数",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_PRIMARY,
            font=Theme.get_font(Theme.FONT_HEADLINE, bold=True),
        ).pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        self.input_interval = LabeledInput(
            param_card, "上传间隔 (秒)",
            value=str(config.get("upload.interval", 30)),
            input_type="number",
        )
        self.input_interval.pack(fill="x")

        self.input_timeout = LabeledInput(
            param_card, "请求超时 (秒)",
            value=str(config.get("upload.timeout", 10)),
            input_type="number",
        )
        self.input_timeout.pack(fill="x")

        self.input_max_retries = LabeledInput(
            param_card, "最大重试次数",
            value=str(config.get("upload.max_retries", 3)),
            input_type="number",
        )
        self.input_max_retries.pack(fill="x")

        # 心跳配置
        hb_card = Card(self)
        hb_card.pack(fill="x", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        tk.Label(
            hb_card, text="心跳服务",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_PRIMARY,
            font=Theme.get_font(Theme.FONT_HEADLINE, bold=True),
        ).pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        # 心跳启用开关
        hb_switch_frame = tk.Frame(hb_card, bg=Theme.BG_SECONDARY)
        hb_switch_frame.pack(fill="x", padx=Theme.SPACING_LG, pady=Theme.SPACING_SM)

        tk.Label(
            hb_switch_frame, text="启用心跳",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_PRIMARY,
            font=Theme.get_body_font(),
        ).pack(side="left")

        self.switch_heartbeat = Switch(
            hb_switch_frame,
            value=config.get("heartbeat.enabled", True),
        )
        self.switch_heartbeat.pack(side="right")

        self.input_hb_interval = LabeledInput(
            hb_card, "心跳间隔 (秒)",
            value=str(config.get("heartbeat.interval", 30)),
            input_type="number",
        )
        self.input_hb_interval.pack(fill="x")

        # 操作按钮
        btn_frame = tk.Frame(self, bg=Theme.BG_PRIMARY)
        btn_frame.pack(fill="x", padx=Theme.SPACING_LG, pady=Theme.SPACING_LG)

        PrimaryButton(btn_frame, "保存配置", command=self.save_config).pack(
            side="left", padx=(0, Theme.SPACING_SM), fill="x", expand=True
        )
        SecondaryButton(btn_frame, "测试连接", command=self.test_connection).pack(
            side="left", fill="x", expand=True
        )

    def save_config(self):
        """保存配置"""
        try:
            # 收集配置
            upload_config = {
                "server_url": self.input_server_url.get().strip(),
                "gateway_ip": self.input_gateway_ip.get().strip(),
                "farm_id": int(self.input_farm_id.get() or "1"),
                "area": self.input_area.get().strip(),
                "interval": int(self.input_interval.get() or "30"),
                "timeout": int(self.input_timeout.get() or "10"),
                "max_retries": int(self.input_max_retries.get() or "3"),
                "retry_delay": self.app.config.get("upload.retry_delay", 5),
                # 保留 upload_filter 配置
                "upload_filter": self.app.config.get("upload.upload_filter",
                                                       {"mode": "all", "device_ids": [], "device_types": []}),
            }
            heartbeat_config = {
                "enabled": self.switch_heartbeat.get(),
                "interval": int(self.input_hb_interval.get() or "30"),
            }

            # 保存到配置文件
            self.app.config.update("upload", upload_config)
            self.app.config.update("heartbeat", heartbeat_config)

            messagebox.showinfo("成功", "配置已保存并生效（热加载）")
        except Exception as e:
            messagebox.showerror("错误", f"保存配置失败: {e}")

    def test_connection(self):
        """测试服务器连接"""
        try:
            import requests
            server_url = self.input_server_url.get().strip().rstrip("/")
            resp = requests.get(f"{server_url}/api/sensors", timeout=5)
            if resp.status_code in [200, 404]:
                messagebox.showinfo("成功", f"连接成功\n服务器: {server_url}\n状态码: {resp.status_code}")
            else:
                messagebox.showwarning("警告", f"服务器响应异常\n状态码: {resp.status_code}")
        except Exception as e:
            messagebox.showerror("失败", f"连接失败: {e}")


class DevicesPage(BasePage):
    """设备管理页面 - 查看已配置设备和上传过滤"""

    name = "devices"
    title = "设备管理"

    def _build_ui(self):
        """构建设备管理界面"""
        PageHeader(self, "设备管理", "查看设备和配置上传过滤").pack(fill="x")

        # 上传过滤配置卡片
        filter_card = Card(self)
        filter_card.pack(fill="x", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        tk.Label(
            filter_card, text="上传过滤",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_PRIMARY,
            font=Theme.get_font(Theme.FONT_HEADLINE, bold=True),
        ).pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        tk.Label(
            filter_card,
            text="设置上传模式：全部上传 / 白名单 / 黑名单",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_TERTIARY,
            font=Theme.get_caption_font(),
        ).pack(anchor="w", padx=Theme.SPACING_LG)

        # 模式选择
        mode_frame = tk.Frame(filter_card, bg=Theme.BG_SECONDARY)
        mode_frame.pack(fill="x", padx=Theme.SPACING_LG, pady=Theme.SPACING_SM)

        tk.Label(
            mode_frame, text="上传模式",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_TERTIARY,
            font=Theme.get_caption_font(),
        ).pack(anchor="w")

        self.mode_var = tk.StringVar(
            value=self.app.config.get("upload.upload_filter.mode", "all")
        )
        mode_combo = ttk.Combobox(
            mode_frame, textvariable=self.mode_var, state="readonly",
            values=["all", "whitelist", "blacklist"],
            font=Theme.get_body_font(),
        )
        mode_combo.pack(fill="x", pady=(0, Theme.SPACING_SM))

        # 设备 ID 过滤
        self.input_filter_ids = LabeledInput(
            filter_card, "设备 ID 列表 (逗号分隔)",
            value=",".join(self.app.config.get("upload.upload_filter.device_ids", [])),
            placeholder="如: T-1-001,H-1-001",
        )
        self.input_filter_ids.pack(fill="x")

        # 设备类型过滤
        self.input_filter_types = LabeledInput(
            filter_card, "设备类型列表 (逗号分隔)",
            value=",".join(self.app.config.get("upload.upload_filter.device_types", [])),
            placeholder="如: temperature,humidity",
        )
        self.input_filter_types.pack(fill="x")

        # 操作按钮
        btn_frame1 = tk.Frame(filter_card, bg=Theme.BG_SECONDARY)
        btn_frame1.pack(fill="x", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        PrimaryButton(btn_frame1, "保存过滤配置",
                       command=self.save_filter_config).pack(fill="x")

        # 已配置设备列表
        list_card = Card(self)
        list_card.pack(fill="both", expand=True,
                       padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        tk.Label(
            list_card, text="已配置设备",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_PRIMARY,
            font=Theme.get_font(Theme.FONT_HEADLINE, bold=True),
        ).pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        # 设备列表（Treeview）
        tree_frame = tk.Frame(list_card, bg=Theme.BG_SECONDARY)
        tree_frame.pack(fill="both", expand=True,
                        padx=Theme.SPACING_LG, pady=(0, Theme.SPACING_LG))

        self.tree = ttk.Treeview(
            tree_frame,
            columns=("id", "type", "name", "enabled", "interface"),
            show="headings",
            height=10,
        )
        self.tree.heading("id", text="ID")
        self.tree.heading("type", text="类型")
        self.tree.heading("name", text="名称")
        self.tree.heading("enabled", text="启用")
        self.tree.heading("interface", text="接口")
        self.tree.column("id", width=120, anchor="w")
        self.tree.column("type", width=100, anchor="w")
        self.tree.column("name", width=150, anchor="w")
        self.tree.column("enabled", width=60, anchor="center")
        self.tree.column("interface", width=80, anchor="w")

        scrollbar = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)
        self.tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # 刷新按钮
        btn_frame2 = tk.Frame(self, bg=Theme.BG_PRIMARY)
        btn_frame2.pack(fill="x", padx=Theme.SPACING_LG, pady=Theme.SPACING_LG)

        SecondaryButton(btn_frame2, "刷新设备列表", command=self.refresh_devices).pack(
            fill="x"
        )

    def on_show(self):
        """页面显示时刷新"""
        self.refresh_devices()

    def refresh_devices(self):
        """刷新设备列表"""
        # 清空
        for item in self.tree.get_children():
            self.tree.delete(item)

        # 加载传感器
        for sensor in self.app.config.get_sensors():
            self.tree.insert(
                "", "end",
                values=(
                    sensor.get("id", ""),
                    sensor.get("type", ""),
                    sensor.get("name", ""),
                    "是" if sensor.get("enabled", True) else "否",
                    sensor.get("interface", "配置"),
                ),
            )

        # 加载执行器
        for actuator in self.app.config.get_actuators():
            self.tree.insert(
                "", "end",
                values=(
                    actuator.get("id", ""),
                    actuator.get("type", ""),
                    actuator.get("name", ""),
                    "是" if actuator.get("enabled", True) else "否",
                    "配置",
                ),
            )

    def save_filter_config(self):
        """保存过滤配置"""
        try:
            upload_config = self.app.config.get("upload", {})
            upload_config["upload_filter"] = {
                "mode": self.mode_var.get(),
                "device_ids": [
                    s.strip() for s in self.input_filter_ids.get().split(",")
                    if s.strip()
                ],
                "device_types": [
                    s.strip() for s in self.input_filter_types.get().split(",")
                    if s.strip()
                ],
            }
            self.app.config.update("upload", upload_config)
            messagebox.showinfo("成功", "过滤配置已保存")
        except Exception as e:
            messagebox.showerror("错误", f"保存失败: {e}")


class ScannerPage(BasePage):
    """设备扫描页面 - 自动扫描硬件设备"""

    name = "scanner"
    title = "设备扫描"

    def _build_ui(self):
        """构建设备扫描界面"""
        PageHeader(self, "设备扫描", "自动检测已连接的硬件设备").pack(fill="x")

        # 扫描接口卡片
        iface_card = Card(self)
        iface_card.pack(fill="x", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        tk.Label(
            iface_card, text="扫描接口",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_PRIMARY,
            font=Theme.get_font(Theme.FONT_HEADLINE, bold=True),
        ).pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        # 接口开关
        self.switches = {}
        scanner_config = self.app.config.get("scanner", {})
        enabled_ifaces = scanner_config.get("enabled_interfaces",
                                              ["i2c", "gpio", "adc", "onewire"])

        for iface_name, iface_label in [
            ("i2c", "I2C 总线 (BMP280/MPU6050 等)"),
            ("gpio", "GPIO 数字传感器"),
            ("adc", "ADC 模拟传感器 (MCP3008)"),
            ("onewire", "1-Wire 设备 (DS18B20 等)"),
        ]:
            row = tk.Frame(iface_card, bg=Theme.BG_SECONDARY)
            row.pack(fill="x", padx=Theme.SPACING_LG, pady=Theme.SPACING_SM)

            tk.Label(
                row, text=iface_label,
                bg=Theme.BG_SECONDARY, fg=Theme.TEXT_PRIMARY,
                font=Theme.get_body_font(),
            ).pack(side="left")

            sw = Switch(row, value=iface_name in enabled_ifaces)
            sw.pack(side="right")
            self.switches[iface_name] = sw

        # 扫描按钮
        btn_frame = tk.Frame(self, bg=Theme.BG_PRIMARY)
        btn_frame.pack(fill="x", padx=Theme.SPACING_LG, pady=Theme.SPACING_LG)

        PrimaryButton(btn_frame, "开始扫描", command=self.start_scan).pack(
            side="left", padx=(0, Theme.SPACING_SM), fill="x", expand=True
        )
        SecondaryButton(btn_frame, "保存扫描结果", command=self.save_scan_results).pack(
            side="left", fill="x", expand=True
        )

        # 进度提示
        self.label_progress = tk.Label(
            self, text="就绪",
            bg=Theme.BG_PRIMARY, fg=Theme.TEXT_TERTIARY,
            font=Theme.get_caption_font(),
        )
        self.label_progress.pack(anchor="w", padx=Theme.SPACING_LG)

        # 扫描结果列表
        result_card = Card(self)
        result_card.pack(fill="both", expand=True,
                         padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        tk.Label(
            result_card, text="扫描结果",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_PRIMARY,
            font=Theme.get_font(Theme.FONT_HEADLINE, bold=True),
        ).pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        tree_frame = tk.Frame(result_card, bg=Theme.BG_SECONDARY)
        tree_frame.pack(fill="both", expand=True,
                        padx=Theme.SPACING_LG, pady=(0, Theme.SPACING_LG))

        self.tree = ttk.Treeview(
            tree_frame,
            columns=("interface", "address", "type", "name", "confidence"),
            show="headings",
            height=10,
        )
        self.tree.heading("interface", text="接口")
        self.tree.heading("address", text="地址")
        self.tree.heading("type", text="设备类型")
        self.tree.heading("name", text="设备名称")
        self.tree.heading("confidence", text="置信度")
        self.tree.column("interface", width=80, anchor="w")
        self.tree.column("address", width=100, anchor="w")
        self.tree.column("type", width=120, anchor="w")
        self.tree.column("name", width=160, anchor="w")
        self.tree.column("confidence", width=80, anchor="center")

        scrollbar = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)
        self.tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # 保存扫描结果
        self.scan_results: List[Dict] = []

    def start_scan(self):
        """开始扫描"""
        # 清空结果
        for item in self.tree.get_children():
            self.tree.delete(item)
        self.scan_results = []
        self.label_progress.config(text="扫描中...")

        # 保存扫描接口配置
        enabled = [name for name, sw in self.switches.items() if sw.get()]
        scanner_config = self.app.config.get("scanner", {})
        scanner_config["enabled_interfaces"] = enabled
        self.app.config.update("scanner", scanner_config)

        # 在子线程中执行扫描，避免阻塞 UI
        import threading

        def scan_thread():
            try:
                from scanner.device_scanner import DeviceScanner
                scanner = DeviceScanner(scanner_config)
                results = scanner.scan_all()

                # 在主线程更新 UI
                self.after(0, lambda: self._show_results(results))
            except Exception as e:
                self.after(0, lambda: self.label_progress.config(text=f"扫描失败: {e}"))

        threading.Thread(target=scan_thread, daemon=True).start()

    def _show_results(self, results):
        """显示扫描结果"""
        self.scan_results = [r.to_dict() for r in results]
        for result in results:
            self.tree.insert(
                "", "end",
                values=(
                    result.interface,
                    result.address,
                    result.device_type,
                    result.name,
                    f"{result.confidence:.0%}",
                ),
            )
        self.label_progress.config(text=f"扫描完成，发现 {len(results)} 个设备")

    def save_scan_results(self):
        """保存扫描结果到配置文件"""
        if not self.scan_results:
            messagebox.showinfo("提示", "暂无扫描结果，请先执行扫描")
            return

        try:
            # 将扫描结果转换为配置格式
            new_sensors = []
            for result in self.scan_results:
                # 仅保存传感器类型的结果（执行器需要用户手动配置引脚）
                if result.get("interface") in ["i2c", "adc", "onewire"]:
                    new_sensors.append({
                        "id": f"{result.get('device_type')}_{result.get('address')}".lower()
                                  .replace("0x", "").replace("-", "_"),
                        "type": result.get("device_type"),
                        "name": result.get("name"),
                        "enabled": True,
                        "config": result.get("config", {}),
                        "discovered": True,
                        "interface": result.get("interface"),
                        "address": result.get("address"),
                    })

            if not new_sensors:
                messagebox.showinfo("提示", "无可保存的传感器设备")
                return

            # 合并到现有配置（保留手动添加的）
            existing_sensors = self.app.config.get_sensors()
            existing_ids = {s.get("id") for s in existing_sensors}
            for new_sensor in new_sensors:
                if new_sensor["id"] not in existing_ids:
                    existing_sensors.append(new_sensor)

            self.app.config.update("sensors", existing_sensors)
            messagebox.showinfo("成功", f"已保存 {len(new_sensors)} 个新设备到配置文件")
        except Exception as e:
            messagebox.showerror("错误", f"保存失败: {e}")


class OTAPage(BasePage):
    """OTA 升级页面 - 检查更新和执行升级"""

    name = "ota"
    title = "在线升级"

    def _build_ui(self):
        """构建 OTA 升级界面"""
        PageHeader(self, "在线升级", "检查并安装新版本").pack(fill="x")

        # 当前版本信息
        version_card = Card(self)
        version_card.pack(fill="x", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        tk.Label(
            version_card, text="版本信息",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_PRIMARY,
            font=Theme.get_font(Theme.FONT_HEADLINE, bold=True),
        ).pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        self.label_current_version = tk.Label(
            version_card, text="当前版本: --",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_SECONDARY,
            font=Theme.get_body_font(), anchor="w",
        )
        self.label_current_version.pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_SM)

        self.label_latest_version = tk.Label(
            version_card, text="最新版本: --",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_SECONDARY,
            font=Theme.get_body_font(), anchor="w",
        )
        self.label_latest_version.pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_SM)

        self.label_update_status = StatusIndicator(version_card, "idle", "未检查更新")
        self.label_update_status.pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_SM)

        # 操作按钮
        btn_frame1 = tk.Frame(self, bg=Theme.BG_PRIMARY)
        btn_frame1.pack(fill="x", padx=Theme.SPACING_LG, pady=Theme.SPACING_LG)

        PrimaryButton(btn_frame1, "检查更新", command=self.check_update).pack(
            side="left", padx=(0, Theme.SPACING_SM), fill="x", expand=True
        )
        SecondaryButton(btn_frame1, "立即升级", command=self.perform_update).pack(
            side="left", padx=(0, Theme.SPACING_SM), fill="x", expand=True
        )
        DangerButton(btn_frame1, "回滚", command=self.rollback).pack(
            side="left", fill="x", expand=True
        )

        # 进度显示
        progress_card = Card(self)
        progress_card.pack(fill="x", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        tk.Label(
            progress_card, text="升级进度",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_PRIMARY,
            font=Theme.get_font(Theme.FONT_HEADLINE, bold=True),
        ).pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        self.progress_var = tk.DoubleVar(value=0)
        self.progress_bar = ttk.Progressbar(
            progress_card, variable=self.progress_var, maximum=100,
            mode="determinate", length=400,
        )
        self.progress_bar.pack(fill="x", padx=Theme.SPACING_LG, pady=Theme.SPACING_SM)

        self.label_progress = tk.Label(
            progress_card, text="就绪",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_TERTIARY,
            font=Theme.get_caption_font(), anchor="w",
        )
        self.label_progress.pack(anchor="w", padx=Theme.SPACING_LG, pady=(0, Theme.SPACING_MD))

        # 更新说明
        notes_card = Card(self)
        notes_card.pack(fill="both", expand=True,
                        padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        tk.Label(
            notes_card, text="更新说明",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_PRIMARY,
            font=Theme.get_font(Theme.FONT_HEADLINE, bold=True),
        ).pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        self.text_notes = tk.Text(
            notes_card, bg=Theme.BG_SECONDARY, fg=Theme.TEXT_SECONDARY,
            font=Theme.get_font(Theme.FONT_CAPTION), wrap="word",
            relief="flat", bd=0, height=10,
        )
        self.text_notes.pack(fill="both", expand=True,
                             padx=Theme.SPACING_LG, pady=(0, Theme.SPACING_LG))

    def on_show(self):
        """页面显示时刷新版本信息"""
        if self.app.ota_manager:
            version = self.app.ota_manager.get_current_version()
            self.label_current_version.config(text=f"当前版本: {version}")

    def check_update(self):
        """检查更新"""
        if not self.app.ota_manager:
            messagebox.showerror("错误", "OTA 管理器未初始化")
            return

        self.label_progress.config(text="正在检查更新...")
        self.progress_var.set(10)

        import threading

        def check_thread():
            try:
                info = self.app.ota_manager.check_update()
                self.after(0, lambda: self._show_update_info(info))
            except Exception as e:
                self.after(0, lambda: self.label_progress.config(text=f"检查失败: {e}"))

        threading.Thread(target=check_thread, daemon=True).start()

    def _show_update_info(self, info):
        """显示更新信息"""
        self.progress_var.set(20)
        self.label_latest_version.config(text=f"最新版本: {info.latest_version or '--'}")
        self.text_notes.delete("1.0", "end")
        self.text_notes.insert("1.0", info.release_notes or "无更新说明")

        if info.is_update_available:
            self.label_update_status.set_status("warning", "有可用更新")
            self.label_progress.config(text=f"发现新版本: {info.latest_version}")
        else:
            self.label_update_status.set_status("success", "已是最新版本")
            self.label_progress.config(text="当前已是最新版本")

    def perform_update(self):
        """执行升级"""
        if not self.app.ota_manager:
            messagebox.showerror("错误", "OTA 管理器未初始化")
            return

        if not messagebox.askyesno("确认", "确定要执行升级吗？\n升级期间服务将暂停。"):
            return

        self.label_progress.config(text="正在升级...")
        self.progress_var.set(30)

        # 注册进度回调
        self.app.ota_manager.add_progress_callback(self._on_ota_progress)

        import threading

        def update_thread():
            try:
                success = self.app.ota_manager.perform_update()
                self.after(0, lambda: self._on_update_done(success))
            except Exception as e:
                self.after(0, lambda: self.label_progress.config(text=f"升级失败: {e}"))

        threading.Thread(target=update_thread, daemon=True).start()

    def _on_ota_progress(self, status: str, message: str, data: dict):
        """OTA 进度回调"""
        progress_map = {
            "checking": 10,
            "update_available": 20,
            "backing_up": 40,
            "downloading": 60,
            "installing": 80,
            "verifying": 90,
            "success": 100,
            "failed": 0,
            "rollback": 50,
        }
        self.progress_var.set(progress_map.get(status, 0))
        self.label_progress.config(text=message)

    def _on_update_done(self, success: bool):
        """升级完成回调"""
        if success:
            self.label_update_status.set_status("success", "升级成功")
            self.label_progress.config(text="升级成功")
            messagebox.showinfo("成功", "升级成功！服务即将重启。")
        else:
            self.label_update_status.set_status("error", "升级失败")
            self.label_progress.config(text="升级失败")
            messagebox.showerror("失败", "升级失败，请查看日志")

    def rollback(self):
        """执行回滚"""
        if not self.app.ota_manager:
            return

        if not messagebox.askyesno("确认", "确定要回滚到上一个版本吗？"):
            return

        self.label_progress.config(text="正在回滚...")

        import threading

        def rollback_thread():
            try:
                success = self.app.ota_manager.rollback()
                self.after(0, lambda: self._on_rollback_done(success))
            except Exception as e:
                self.after(0, lambda: self.label_progress.config(text=f"回滚失败: {e}"))

        threading.Thread(target=rollback_thread, daemon=True).start()

    def _on_rollback_done(self, success: bool):
        """回滚完成回调"""
        if success:
            self.label_update_status.set_status("success", "回滚成功")
            self.label_progress.config(text="回滚成功")
            messagebox.showinfo("成功", "回滚成功！服务即将重启。")
        else:
            self.label_update_status.set_status("error", "回滚失败")
            self.label_progress.config(text="回滚失败")


class SystemConfigPage(BasePage):
    """系统配置页面 - 设置上传参数、服务器地址、开机自启等"""

    name = "system"
    title = "系统配置"

    def _build_ui(self):
        """构建系统配置界面"""
        PageHeader(self, "系统配置", "上传参数与系统设置").pack(fill="x")

        # 上传参数卡片
        upload_card = Card(self)
        upload_card.pack(fill="x", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        tk.Label(
            upload_card, text="上传参数",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_PRIMARY,
            font=Theme.get_font(Theme.FONT_HEADLINE, bold=True),
        ).pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        self.input_interval = LabeledInput(
            upload_card, "上传间隔 (秒)",
            value=str(self.app.config.get("upload.interval", 30)),
            input_type="number",
        )
        self.input_interval.pack(fill="x")

        # 服务器配置卡片
        server_card = Card(self)
        server_card.pack(fill="x", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        tk.Label(
            server_card, text="服务器配置",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_PRIMARY,
            font=Theme.get_font(Theme.FONT_HEADLINE, bold=True),
        ).pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        # 解析当前服务器地址和端口
        server_url = self.app.config.get("upload.server_url", "http://10.248.88.151:3000")
        host, port = self._parse_server_url(server_url)

        self.input_server_host = LabeledInput(
            server_card, "服务器地址",
            value=host,
            placeholder="如: 10.248.88.151 或 your-server.com",
        )
        self.input_server_host.pack(fill="x")

        self.input_server_port = LabeledInput(
            server_card, "端口号",
            value=str(port),
            input_type="number",
        )
        self.input_server_port.pack(fill="x")

        # 开机自启配置卡片
        autostart_card = Card(self)
        autostart_card.pack(fill="x", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        tk.Label(
            autostart_card, text="开机自启",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_PRIMARY,
            font=Theme.get_font(Theme.FONT_HEADLINE, bold=True),
        ).pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_MD)

        # 开机自启开关
        autostart_frame = tk.Frame(autostart_card, bg=Theme.BG_SECONDARY)
        autostart_frame.pack(fill="x", padx=Theme.SPACING_LG, pady=Theme.SPACING_SM)

        tk.Label(
            autostart_frame, text="启用开机自启",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_PRIMARY,
            font=Theme.get_body_font(),
        ).pack(side="left")

        # 检查当前开机自启状态
        self._update_autostart_status()
        self.switch_autostart = Switch(
            autostart_frame,
            value=self._autostart_enabled,
            on_change=self._on_autostart_toggle,
        )
        self.switch_autostart.pack(side="right")

        # 服务状态显示
        self.label_service_status = StatusIndicator(
            autostart_card, "idle", self._service_status
        )
        self.label_service_status.pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_SM)

        # 权限提示
        tk.Label(
            autostart_card,
            text="提示：修改开机自启需要 sudo 权限，可能需要输入密码",
            bg=Theme.BG_SECONDARY, fg=Theme.TEXT_TERTIARY,
            font=Theme.get_caption_font(),
            anchor="w",
        ).pack(anchor="w", padx=Theme.SPACING_LG, pady=Theme.SPACING_SM)

        # 操作按钮
        btn_frame = tk.Frame(self, bg=Theme.BG_PRIMARY)
        btn_frame.pack(fill="x", padx=Theme.SPACING_LG, pady=Theme.SPACING_LG)

        PrimaryButton(btn_frame, "保存配置", command=self.save_config).pack(
            side="left", padx=(0, Theme.SPACING_SM), fill="x", expand=True
        )
        SecondaryButton(btn_frame, "测试连接", command=self.test_connection).pack(
            side="left", fill="x", expand=True
        )

    def _parse_server_url(self, url: str) -> tuple:
        """解析服务器URL，分离主机和端口

        Args:
            url: 完整的服务器URL

        Returns:
            (host, port) 元组
        """
        from urllib.parse import urlparse

        try:
            parsed = urlparse(url)
            host = parsed.hostname or ""
            port = parsed.port or 3000
            return host, port
        except Exception:
            return "10.248.88.151", 3000

    def _build_server_url(self, host: str, port: int) -> str:
        """根据主机和端口构建完整URL"""
        return f"http://{host}:{port}"

    def _update_autostart_status(self):
        """更新开机自启状态"""
        try:
            from utils.systemd_utils import (
                is_service_enabled, get_service_status,
            )

            self._autostart_enabled = is_service_enabled()
            self._service_status = get_service_status()
        except Exception as e:
            self._autostart_enabled = False
            self._service_status = f"状态获取失败: {e}"

    def _on_autostart_toggle(self, value: bool):
        """开机自启开关切换回调"""
        try:
            from utils.systemd_utils import enable_service, disable_service

            if value:
                success = enable_service()
            else:
                success = disable_service()

            if success:
                self._update_autostart_status()
                self.label_service_status.set_status(
                    "success" if value else "idle",
                    self._service_status,
                )
                messagebox.showinfo(
                    "成功",
                    "开机自启已" + ("启用" if value else "禁用"),
                )
            else:
                # 恢复开关状态
                self.switch_autostart.set(not value)
                messagebox.showerror(
                    "失败",
                    "修改开机自启失败，请检查是否有 sudo 权限",
                )
        except Exception as e:
            self.switch_autostart.set(not value)
            messagebox.showerror("错误", f"操作失败: {e}")

    def save_config(self):
        """保存配置"""
        try:
            # 收集配置
            host = self.input_server_host.get().strip()
            port = int(self.input_server_port.get() or "3000")
            interval = int(self.input_interval.get() or "30")

            if not host:
                messagebox.showerror("错误", "服务器地址不能为空")
                return

            # 构建完整URL
            server_url = self._build_server_url(host, port)

            # 更新上传配置
            upload_config = self.app.config.get("upload", {})
            upload_config.update({
                "server_url": server_url,
                "interval": interval,
            })
            self.app.config.update("upload", upload_config)

            messagebox.showinfo("成功", "配置已保存并生效（热加载）")
        except Exception as e:
            messagebox.showerror("错误", f"保存配置失败: {e}")

    def test_connection(self):
        """测试服务器连接"""
        try:
            import requests

            host = self.input_server_host.get().strip()
            port = int(self.input_server_port.get() or "3000")
            server_url = self._build_server_url(host, port).rstrip("/")

            resp = requests.get(f"{server_url}/api/sensors", timeout=5)
            if resp.status_code in [200, 404]:
                messagebox.showinfo("成功", f"连接成功\n服务器: {server_url}\n状态码: {resp.status_code}")
            else:
                messagebox.showwarning("警告", f"服务器响应异常\n状态码: {resp.status_code}")
        except Exception as e:
            messagebox.showerror("失败", f"连接失败: {e}")
