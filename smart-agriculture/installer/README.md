# 天工慧眼 - 安装程序

## 构建安装程序

### 1. 安装依赖

```bash
pip install customtkinter pillow pyinstaller
```

### 2. 生成图标

```bash
python create_icon.py
```

### 3. 构建

```bash
build.bat
```

或手动执行：

```bash
pyinstaller --onefile --windowed --name "天工慧眼-安装程序" --icon=icon.ico installer.py
```

### 4. 输出

生成的安装程序位于 `dist/天工慧眼-安装程序.exe`

## 功能特性

- 现代化深色主题UI
- 自动检测系统依赖（Git, Node.js, Python）
- 自动下载和安装项目
- 自动安装Node.js和Python依赖
- 自动初始化数据库
- 创建桌面快捷方式
- 实时安装日志显示
- 支持自定义安装目录

## 使用说明

1. 双击运行 `天工慧眼-安装程序.exe`
2. 选择安装目录
3. 选择要安装的组件
4. 点击"开始安装"
5. 等待安装完成
6. 双击桌面快捷方式启动

## 系统要求

- Windows 10/11
- Git（安装程序会检测）
- Node.js 20+（可自动安装）
- Python 3.11+（可自动安装）

## 截图

安装程序采用深色主题设计，界面简洁现代。

- 顶部：Logo和项目标题
- 中间：安装选项（目录、组件选择）
- 下部：安装进度和日志
- 底部：操作按钮
