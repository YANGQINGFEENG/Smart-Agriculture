#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""UI 主题 - 苹果风格简约配色方案"""

# 苹果风格调色板（参考 iOS / macOS Big Sur 设计规范）
# 主要特点：浅色背景、深色文字、柔和的强调色、圆角卡片


class Theme:
    """UI 主题配色"""

    # 背景色（苹果系统浅色背景）
    BG_PRIMARY = "#F2F2F7"           # 主背景（iOS System Grouped Background）
    BG_SECONDARY = "#FFFFFF"        # 卡片背景（iOS Secondary System Grouped Background）
    BG_TERTIARY = "#E5E5EA"         # 第三背景（分隔区域）
    BG_NAV = "#F9F9F9"              # 导航栏背景

    # 文字颜色
    TEXT_PRIMARY = "#000000"        # 主文字（Label Color）
    TEXT_SECONDARY = "#3C3C43"      # 次要文字（Secondary Label Color with opacity）
    TEXT_TERTIARY = "#8E8E93"       # 三级文字（Tertiary Label Color）
    TEXT_QUATERNARY = "#C7C7CC"     # 占位符文字

    # 强调色（iOS Blue）
    ACCENT = "#007AFF"              # iOS Blue - 主要按钮、链接
    ACCENT_HOVER = "#0066D6"         # 悬停色
    ACCENT_PRESSED = "#0055B3"       # 按下色

    # 状态色
    SUCCESS = "#34C759"              # iOS Green - 成功状态
    WARNING = "#FF9500"             # iOS Orange - 警告
    ERROR = "#FF3B30"               # iOS Red - 错误
    INFO = "#5AC8FA"                # 青色 - 信息

    # 分隔线
    SEPARATOR = "#C6C6C8"          # 分隔线颜色
    SEPARATOR_SOFT = "#E5E5EA"      # 软分隔线

    # 圆角
    RADIUS_SMALL = 8                # 小圆角（按钮、输入框）
    RADIUS_MEDIUM = 12              # 中圆角（卡片）
    RADIUS_LARGE = 16               # 大圆角（容器、对话框）

    # 字体（系统默认无衬线字体）
    FONT_FAMILY = "PingFang SC"      # 苹方（macOS/iOS 默认中文字体）
    FONT_FAMILY_FALLBACK = "Microsoft YaHei"  # 微软雅黑（Windows 备选）

    # 字号
    FONT_LARGE_TITLE = 28           # 大标题
    FONT_TITLE = 22                 # 标题
    FONT_HEADLINE = 18              # 副标题
    FONT_BODY = 14                  # 正文
    FONT_FOOTNOTE = 12              # 脚注
    FONT_CAPTION = 11               # 说明文字

    # 间距
    SPACING_XS = 4                  # 极小间距
    SPACING_SM = 8                  # 小间距
    SPACING_MD = 12                 # 中间距
    SPACING_LG = 16                 # 大间距
    SPACING_XL = 24                 # 极大间距

    # 按钮尺寸（触摸友好）
    BUTTON_HEIGHT = 44              # 按钮高度（iOS HIG 推荐 44pt）
    BUTTON_MIN_WIDTH = 100          # 按钮最小宽度
    INPUT_HEIGHT = 36               # 输入框高度
    NAV_HEIGHT = 50                 # 导航栏高度
    ROW_HEIGHT = 56                 # 列表行高

    @classmethod
    def get_font(cls, size: int = None, bold: bool = False):
        """获取字体

        Args:
            size: 字号，默认 FONT_BODY
            bold: 是否加粗
        """
        if size is None:
            size = cls.FONT_BODY
        family = f"{cls.FONT_FAMILY},{cls.FONT_FAMILY_FALLBACK}"
        weight = "bold" if bold else "normal"
        return (family, size, weight)

    @classmethod
    def get_button_font(cls):
        """获取按钮字体"""
        return cls.get_font(cls.FONT_BODY, bold=True)

    @classmethod
    def get_title_font(cls):
        """获取标题字体"""
        return cls.get_font(cls.FONT_TITLE, bold=True)

    @classmethod
    def get_body_font(cls):
        """获取正文字体"""
        return cls.get_font(cls.FONT_BODY)

    @classmethod
    def get_caption_font(cls):
        """获取说明字体"""
        return cls.get_font(cls.FONT_CAPTION)


class DarkTheme(Theme):
    """深色主题（备用，与浅色主题共享设计规范）"""

    BG_PRIMARY = "#000000"
    BG_SECONDARY = "#1C1C1E"
    BG_TERTIARY = "#2C2C2E"
    BG_NAV = "#1C1C1E"

    TEXT_PRIMARY = "#FFFFFF"
    TEXT_SECONDARY = "#EBEBF5"
    TEXT_TERTIARY = "#EBEBF5"
    TEXT_QUATERNARY = "#545458"

    SEPARATOR = "#38383A"
    SEPARATOR_SOFT = "#38383A"
