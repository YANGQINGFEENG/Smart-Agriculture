#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""UI 主窗口 - 整合所有页面，提供底部导航栏（苹果风格 Tab Bar）"""

import tkinter as tk
from tkinter import ttk
from typing import Optional, Dict, List

from ui.theme import Theme
from ui.pages import (
    BasePage, DashboardPage, NetworkConfigPage,
    DevicesPage, ScannerPage, OTAPage, SystemConfigPage,
)


class MainWindow:
    """主窗口 - 整合所有页面，提供底部导航栏

    使用苹果风格的 Tab Bar 设计：
    - 顶部：当前页面标题
    - 中间：页面内容
    - 底部：5个 Tab 按钮（仪表盘/网络配置/设备/扫描/升级）
    """

    def __init__(self, app_container=None, fullscreen: bool = True):
        """初始化主窗口

        Args:
            app_container: 应用容器，提供 config/system/ota_manager 等属性
            fullscreen: 是否全屏显示（适合 7 寸触摸屏）
        """
        self.app = app_container
        self.root = tk.Tk()
        self.root.title("智慧农业硬件系统")

        # 设置窗口大小（7寸触摸屏分辨率通常为 1024x600 或 800x480）
        if fullscreen:
            try:
                self.root.attributes("-fullscreen", True)
            except Exception:
                self.root.geometry("1024x600")
        else:
            self.root.geometry("1024x600")
            # 居中显示
            self.root.update_idletasks()
            w = self.root.winfo_width()
            h = self.root.winfo_height()
            sw = self.root.winfo_screenwidth()
            sh = self.root.winfo_screenheight()
            x = (sw - w) // 2
            y = (sh - h) // 2
            self.root.geometry(f"{w}x{h}+{x}+{y}")

        # 配置根窗口背景
        self.root.configure(bg=Theme.BG_PRIMARY)

        # 绑定 ESC 退出全屏
        self.root.bind("<Escape>", lambda e: self.root.attributes("-fullscreen", False))

        # 顶部状态栏（显示时间、状态指示器）
        self._build_status_bar()

        # 内容区域
        self.content_frame = tk.Frame(self.root, bg=Theme.BG_PRIMARY)
        self.content_frame.pack(fill="both", expand=True)

        # 底部 Tab Bar
        self._build_tab_bar()

        # 页面实例缓存
        self.pages: Dict[str, BasePage] = {}
        self.current_page: Optional[BasePage] = None
        self.current_page_name: Optional[str] = None

        # 启动定时刷新
        self._start_periodic_refresh()

        # 默认显示仪表盘
        self.show_page("dashboard")

    def _build_status_bar(self):
        """构建顶部状态栏"""
        self.status_bar = tk.Frame(
            self.root, bg=Theme.BG_NAV, height=Theme.NAV_HEIGHT
        )
        self.status_bar.pack(fill="x", side="top")
        self.status_bar.pack_propagate(False)

        # 时间显示（左上）
        self.label_time = tk.Label(
            self.status_bar, text="",
            bg=Theme.BG_NAV, fg=Theme.TEXT_PRIMARY,
            font=Theme.get_font(Theme.FONT_BODY, bold=True),
        )
        self.label_time.pack(side="left", padx=Theme.SPACING_LG)

        # 标题（居中）
        self.label_title = tk.Label(
            self.status_bar, text="智慧农业硬件系统",
            bg=Theme.BG_NAV, fg=Theme.TEXT_PRIMARY,
            font=Theme.get_font(Theme.FONT_HEADLINE, bold=True),
        )
        self.label_title.pack(side="left", padx=Theme.SPACING_LG)

        # 退出按钮（右上）
        exit_btn = tk.Button(
            self.status_bar, text="✕",
            bg=Theme.BG_NAV, fg=Theme.TEXT_TERTIARY,
            font=Theme.get_font(Theme.FONT_TITLE, bold=True),
            relief="flat", bd=0,
            cursor="hand2",
            command=self.quit,
        )
        exit_btn.pack(side="right", padx=Theme.SPACING_LG)

    def _build_tab_bar(self):
        """构建底部 Tab Bar"""
        self.tab_bar = tk.Frame(
            self.root, bg=Theme.BG_NAV, height=Theme.BUTTON_HEIGHT + 20
        )
        self.tab_bar.pack(fill="x", side="bottom")
        self.tab_bar.pack_propagate(False)

        # 6个 Tab（使用纯文本图标，避免 emoji 兼容性问题）
        self.tabs: Dict[str, tk.Button] = {}
        tab_configs = [
            ("dashboard", "仪表盘", "[=]"),
            ("network", "网络配置", "[~]"),
            ("system", "系统配置", "[*]"),
            ("devices", "设备管理", "[#]"),
            ("scanner", "设备扫描", "[?]"),
            ("ota", "在线升级", "[^]"),
        ]

        for page_name, label, icon in tab_configs:
            btn = tk.Button(
                self.tab_bar,
                text=f"{icon}\n{label}",
                bg=Theme.BG_NAV,
                fg=Theme.TEXT_TERTIARY,
                font=Theme.get_font(Theme.FONT_CAPTION),
                relief="flat",
                bd=0,
                cursor="hand2",
                command=lambda name=page_name: self.show_page(name),
            )
            btn.pack(side="left", fill="both", expand=True, padx=2, pady=Theme.SPACING_SM)
            self.tabs[page_name] = btn

    def show_page(self, page_name: str):
        """显示指定页面

        Args:
            page_name: 页面名称 (dashboard/network/devices/scanner/ota)
        """
        # 隐藏当前页面
        if self.current_page:
            self.current_page.pack_forget()
            self.current_page.on_hide()

        # 更新 Tab 样式
        for name, btn in self.tabs.items():
            if name == page_name:
                btn.config(fg=Theme.ACCENT, font=Theme.get_font(Theme.FONT_CAPTION, bold=True))
            else:
                btn.config(fg=Theme.TEXT_TERTIARY, font=Theme.get_font(Theme.FONT_CAPTION))

        # 创建或获取页面实例
        if page_name not in self.pages:
            self.pages[page_name] = self._create_page(page_name)

        page = self.pages[page_name]
        page.pack(in_=self.content_frame, fill="both", expand=True)
        page.on_show()

        self.current_page = page
        self.current_page_name = page_name

        # 更新顶部标题
        self.label_title.config(text=page.title)

    def _create_page(self, page_name: str) -> BasePage:
        """创建页面实例"""
        page_classes = {
            "dashboard": DashboardPage,
            "network": NetworkConfigPage,
            "system": SystemConfigPage,
            "devices": DevicesPage,
            "scanner": ScannerPage,
            "ota": OTAPage,
        }
        cls = page_classes.get(page_name)
        if not cls:
            raise ValueError(f"Unknown page: {page_name}")
        return cls(self.content_frame, self)

    def _start_periodic_refresh(self):
        """启动定时刷新（更新时间显示和当前页面）"""
        def update():
            try:
                # 更新时间显示
                from datetime import datetime
                self.label_time.config(text=datetime.now().strftime("%H:%M:%S"))

                # 刷新当前页面（如果支持）
                if self.current_page and hasattr(self.current_page, "refresh_status"):
                    # 仅在 dashboard 页面自动刷新
                    if self.current_page_name == "dashboard":
                        self.current_page.refresh_status()
            except Exception:
                pass
            finally:
                self.root.after(1000, update)  # 每秒刷新一次

        self.root.after(1000, update)

    def run(self):
        """启动 UI 主循环"""
        self.root.mainloop()

    def quit(self):
        """退出应用"""
        if messagebox_askyesno("确认", "确定要退出系统吗？"):
            try:
                if self.app and hasattr(self.app, "stop"):
                    self.app.stop()
            except Exception:
                pass
            self.root.quit()
            self.root.destroy()


def messagebox_askyesno(title: str, message: str) -> bool:
    """包装 messagebox.askyesno，避免顶层导入冲突"""
    from tkinter import messagebox
    return messagebox.askyesno(title, message)
