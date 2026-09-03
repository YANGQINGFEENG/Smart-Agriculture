#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""UI 组件 - 自定义可复用的 Tkinter 控件"""

import tkinter as tk
from tkinter import ttk
from typing import Callable, Optional

from ui.theme import Theme


class Card(tk.Frame):
    """苹果风格圆角卡片"""

    def __init__(self, parent, **kwargs):
        """初始化卡片

        Args:
            parent: 父容器
            **kwargs: Frame 额外参数
        """
        super().__init__(
            parent,
            bg=Theme.BG_SECONDARY,
            highlightthickness=0,
            **kwargs,
        )
        self._radius = Theme.RADIUS_MEDIUM

    def add_widget(self, widget, **kwargs):
        """添加子控件"""
        widget.pack(in_=self, **kwargs)
        return widget


class PrimaryButton(tk.Button):
    """主按钮（蓝色实心，触摸友好）"""

    def __init__(self, parent, text: str, command: Callable = None, **kwargs):
        """初始化主按钮"""
        super().__init__(
            parent,
            text=text,
            command=command,
            bg=Theme.ACCENT,
            fg="#FFFFFF",
            activebackground=Theme.ACCENT_PRESSED,
            activeforeground="#FFFFFF",
            font=Theme.get_button_font(),
            relief="flat",
            bd=0,
            height=2,
            cursor="hand2",
            padx=Theme.SPACING_LG,
            pady=Theme.SPACING_SM,
            **kwargs,
        )
        # 设置 padding 增加触摸区域
        self.configure(pady=10)


class SecondaryButton(tk.Button):
    """次级按钮（浅色描边）"""

    def __init__(self, parent, text: str, command: Callable = None, **kwargs):
        """初始化次级按钮"""
        super().__init__(
            parent,
            text=text,
            command=command,
            bg=Theme.BG_TERTIARY,
            fg=Theme.TEXT_PRIMARY,
            activebackground=Theme.SEPARATOR,
            activeforeground=Theme.TEXT_PRIMARY,
            font=Theme.get_button_font(),
            relief="flat",
            bd=0,
            height=2,
            cursor="hand2",
            padx=Theme.SPACING_LG,
            pady=Theme.SPACING_SM,
            **kwargs,
        )


class DangerButton(tk.Button):
    """危险按钮（红色，用于删除/回滚等危险操作）"""

    def __init__(self, parent, text: str, command: Callable = None, **kwargs):
        """初始化危险按钮"""
        super().__init__(
            parent,
            text=text,
            command=command,
            bg=Theme.ERROR,
            fg="#FFFFFF",
            activebackground="#C7030F",
            activeforeground="#FFFFFF",
            font=Theme.get_button_font(),
            relief="flat",
            bd=0,
            height=2,
            cursor="hand2",
            padx=Theme.SPACING_LG,
            pady=Theme.SPACING_SM,
            **kwargs,
        )


class LabeledInput(tk.Frame):
    """带标签的输入框（苹果风格）"""

    def __init__(self, parent, label: str, value: str = "",
                 input_type: str = "text", placeholder: str = "",
                 **kwargs):
        """初始化带标签的输入框

        Args:
            parent: 父容器
            label: 标签文字
            value: 默认值
            input_type: 输入类型 (text/number/password)
            placeholder: 占位符
        """
        super().__init__(parent, bg=Theme.BG_SECONDARY, **kwargs)

        # 标签
        self.label_var = tk.StringVar(value=label)
        self.label = tk.Label(
            self,
            textvariable=self.label_var,
            bg=Theme.BG_SECONDARY,
            fg=Theme.TEXT_TERTIARY,
            font=Theme.get_caption_font(),
            anchor="w",
        )
        self.label.pack(anchor="w", padx=Theme.SPACING_LG, pady=(Theme.SPACING_MD, 0))

        # 输入框
        show_char = "*" if input_type == "password" else ""
        self.var = tk.StringVar(value=value)
        self.entry = tk.Entry(
            self,
            textvariable=self.var,
            bg=Theme.BG_SECONDARY,
            fg=Theme.TEXT_PRIMARY,
            insertbackground=Theme.TEXT_PRIMARY,
            selectbackground=Theme.ACCENT,
            selectforeground="#FFFFFF",
            font=Theme.get_body_font(),
            relief="flat",
            bd=0,
            show=show_char,
        )
        self.entry.pack(fill="x", padx=Theme.SPACING_LG, pady=(0, Theme.SPACING_MD))
        # 底部分隔线
        self.sep = tk.Frame(self, bg=Theme.SEPARATOR_SOFT, height=1)
        self.sep.pack(fill="x", padx=Theme.SPACING_LG, pady=(0, 0))

    def get(self) -> str:
        """获取输入值"""
        return self.var.get()

    def set(self, value: str):
        """设置输入值"""
        self.var.set(value)

    def set_label(self, label: str):
        """设置标签"""
        self.label_var.set(label)


class Switch(tk.Frame):
    """苹果风格开关控件"""

    def __init__(self, parent, value: bool = False,
                 on_change: Callable[[bool], None] = None, **kwargs):
        """初始化开关

        Args:
            parent: 父容器
            value: 初始状态
            on_change: 状态变化回调
        """
        super().__init__(parent, bg=Theme.BG_SECONDARY, **kwargs)
        self._value = value
        self._on_change = on_change

        # 开关画布
        self._canvas = tk.Canvas(
            self,
            width=51,
            height=31,
            bg=Theme.BG_SECONDARY,
            highlightthickness=0,
            cursor="hand2",
        )
        self._canvas.pack()
        self._canvas.bind("<Button-1>", self._toggle)

        self._draw()

    def _draw(self):
        """绘制开关"""
        self._canvas.delete("all")
        if self._value:
            bg = Theme.SUCCESS
            knob_x = 35
        else:
            bg = Theme.SEPARATOR
            knob_x = 16
        # 背景
        self._canvas.create_rectangle(2, 2, 49, 29, fill=bg, outline="", tags="bg")
        # 圆形旋钮（白色实心圆）
        self._canvas.create_oval(knob_x - 12, 4, knob_x + 12, 28,
                                  fill="#FFFFFF", outline="", tags="knob")

    def _toggle(self, event=None):
        """切换状态"""
        self._value = not self._value
        self._draw()
        if self._on_change:
            self._on_change(self._value)

    def get(self) -> bool:
        """获取状态"""
        return self._value

    def set(self, value: bool):
        """设置状态"""
        self._value = bool(value)
        self._draw()
        if self._on_change:
            self._on_change(self._value)


class StatusIndicator(tk.Frame):
    """状态指示器（圆点+文字）"""

    def __init__(self, parent, status: str = "idle", text: str = "",
                 **kwargs):
        """初始化状态指示器

        Args:
            parent: 父容器
            status: 状态 (success/warning/error/idle)
            text: 显示文字
        """
        super().__init__(parent, bg=Theme.BG_SECONDARY, **kwargs)
        self._status = status
        self._text_var = tk.StringVar(value=text)

        # 颜色映射
        self._colors = {
            "success": Theme.SUCCESS,
            "warning": Theme.WARNING,
            "error": Theme.ERROR,
            "idle": Theme.TEXT_TERTIARY,
        }

        # 圆点
        self._dot = tk.Canvas(self, width=12, height=12, bg=Theme.BG_SECONDARY,
                               highlightthickness=0)
        self._dot.pack(side="left", padx=(0, Theme.SPACING_SM))
        # 文字
        self._label = tk.Label(
            self,
            textvariable=self._text_var,
            bg=Theme.BG_SECONDARY,
            fg=Theme.TEXT_PRIMARY,
            font=Theme.get_body_font(),
        )
        self._label.pack(side="left")

        self.set_status(status, text)

    def set_status(self, status: str, text: str = None):
        """设置状态"""
        self._status = status
        if text is not None:
            self._text_var.set(text)
        color = self._colors.get(status, Theme.TEXT_TERTIARY)
        # 重绘圆点
        self._dot.delete("all")
        self._dot.create_oval(2, 2, 10, 10, fill=color, outline="")


class PageHeader(tk.Frame):
    """页面标题栏"""

    def __init__(self, parent, title: str, subtitle: str = "", **kwargs):
        """初始化页面标题栏"""
        super().__init__(parent, bg=Theme.BG_PRIMARY, **kwargs)

        # 主标题
        self._title_var = tk.StringVar(value=title)
        title_label = tk.Label(
            self,
            textvariable=self._title_var,
            bg=Theme.BG_PRIMARY,
            fg=Theme.TEXT_PRIMARY,
            font=Theme.get_font(Theme.FONT_LARGE_TITLE, bold=True),
            anchor="w",
        )
        title_label.pack(anchor="w", padx=Theme.SPACING_LG, pady=(Theme.SPACING_LG, 0))

        # 副标题
        if subtitle:
            self._subtitle_var = tk.StringVar(value=subtitle)
            sub_label = tk.Label(
                self,
                textvariable=self._subtitle_var,
                bg=Theme.BG_PRIMARY,
                fg=Theme.TEXT_TERTIARY,
                font=Theme.get_caption_font(),
                anchor="w",
            )
            sub_label.pack(anchor="w", padx=Theme.SPACING_LG, pady=(0, Theme.SPACING_MD))
        else:
            # 留出空白
            tk.Frame(self, bg=Theme.BG_PRIMARY, height=Theme.SPACING_MD).pack()

    def set_title(self, title: str):
        """设置标题"""
        self._title_var.set(title)
