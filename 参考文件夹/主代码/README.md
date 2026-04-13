# 智能花卉灌溉系统 - 硬件接入服务器设计

## 项目简介

本项目是一个基于STM32F103C8微控制器的智能花卉灌溉系统，实现了WiFi连接、服务器健康状态测试、百度ping测试等功能，用于监控和管理花卉灌溉系统的硬件状态。

## 主要功能

1. **WiFi连接**：
   - 连接到指定的WiFi网络（默认：OPPO K10）
   - 自动重试机制，提高连接成功率
   - 实时显示连接状态和IP地址

2. **服务器健康状态测试**：
   - 连接到服务器API路径 `/api/monitor/health`
   - 发送完整的HTTP请求并分析响应
   - 自动重试机制，提高测试成功率
   - 显示详细的服务器响应内容

3. **百度ping测试**：
   - 测试设备的互联网连接状态
   - 每30秒自动执行一次
   - 显示ping响应时间

4. **OLED显示**：
   - 实时显示测试状态和结果
   - 显示网络连接状态
   - 显示服务器响应状态

5. **详细的日志输出**：
   - 完整的HTTP请求内容
   - 完整的服务器响应内容
   - 状态返回值
   - 测试结果统计

## 硬件要求

- STM32F103C8微控制器
- ATK-MB026 WiFi & BLE模块
- OLED显示屏
- 电源供应（5V）

## 软件要求

- Keil MDK-ARM 5.0以上版本
- STM32F1系列设备支持包
- Windows操作系统

## 编译流程

### 方法1：使用编译脚本（推荐）

1. **确保Keil MDK已正确安装**：
   - 安装路径：`D:\Program Files\UV4\`
   - 已安装STM32F1系列设备支持包

2. **运行编译脚本**：
   - 双击 `build.bat` 文件
   - 脚本会自动检查环境并执行编译
   - 查看编译结果和错误信息

### 方法2：使用Keil MDK IDE

1. **打开项目**：
   - 启动Keil MDK uVision5
   - 点击 "Project" -> "Open Project"
   - 选择 `Project.uvprojx` 文件

2. **编译项目**：
   - 点击工具栏上的 "Build" 按钮（或按 F7）
   - 等待编译完成
   - 查看编译结果和错误信息

### 方法3：使用命令行

1. **打开命令提示符**：
   - 按下 "Win + R" 键，输入 "cmd"，点击 "确定"

2. **执行编译命令**：
   ```cmd
   cd e:\new2\主代码
   "D:\Program Files\UV4\uv4.exe" -b Project.uvprojx
   ```

## 配置参数

主要配置参数位于 `User\main.c` 文件中：

### WiFi配置
- `DEMO_WIFI_SSID`：WiFi网络名称（在 `User\demo.h` 中定义）
- `DEMO_WIFI_PWD`：WiFi网络密码（在 `User\demo.h` 中定义）
- `MAX_WIFI_RETRY`：WiFi连接最大重试次数

### 服务器配置
- `SERVER_URL`：服务器地址
- `SERVER_PORT`：服务器端口
- `SERVER_PATH`：服务器API路径
- `SERVER_TEST_COUNT`：服务器测试次数
- `MAX_SERVER_RETRY`：服务器连接最大重试次数

### 测试配置
- `WIFI_CHECK_INTERVAL`：WiFi状态检查间隔（毫秒）
- `BAIDU_PING_INTERVAL`：百度ping测试间隔（毫秒）

## 运行流程

1. **设备启动**：
   - 初始化系统和硬件
   - 初始化WiFi模块

2. **WiFi连接**：
   - 尝试连接到指定的WiFi网络
   - 显示连接状态和IP地址

3. **服务器测试**：
   - 执行服务器健康状态测试
   - 发送HTTP请求并分析响应
   - 显示测试结果

4. **主循环**：
   - 每10秒检查一次WiFi连接状态
   - 每30秒执行一次百度ping测试
   - 当WiFi连接断开时，自动尝试重新连接

## 查看测试结果

1. **OLED屏幕**：
   - 实时显示测试状态和结果
   - 显示网络连接状态
   - 显示服务器响应状态

2. **串口终端**：
   - 详细的测试日志
   - 完整的HTTP请求内容
   - 完整的服务器响应内容
   - 状态返回值
   - 测试结果统计

## 常见问题

1. **WiFi连接失败**：
   - 检查WiFi网络名称和密码是否正确
   - 检查WiFi模块连接是否正常
   - 检查WiFi信号强度

2. **服务器测试失败**：
   - 检查服务器地址和端口是否正确
   - 检查服务器是否正常运行
   - 检查网络连接是否正常

3. **编译错误**：
   - 检查Keil MDK是否正确安装
   - 检查STM32F1系列设备支持包是否已安装
   - 检查代码是否有语法错误

## 代码结构

```
主代码/
├── Hardware/         # 硬件相关代码
│   ├── atk_mb026.c   # WiFi模块驱动
│   ├── OLED.c        # OLED显示屏驱动
│   └── ...           # 其他硬件驱动
├── Library/          # STM32标准库
├── System/           # 系统相关代码
├── User/             # 用户代码
│   ├── main.c        # 主程序
│   ├── demo.h        # 配置参数
│   └── ...           # 其他用户代码
├── Objects/          # 编译输出目录
├── Project.uvprojx   # Keil MDK项目文件
├── build.bat         # 编译脚本
└── README.md         # 项目说明文档
```

## 技术说明

### HTTP请求格式

```
GET /api/monitor/health HTTP/1.1
Host: subfastigiated-avis-unreplevinable.ngrok-free.dev
Connection: close
ngrok-skip-browser-warning: 1
User-Agent: STM32-Client/1.0
Device-ID: OPPO K10

```

### 响应处理

- 检查响应中是否包含 "200 OK" 状态码
- 显示完整的服务器响应内容
- 统计测试结果

### 错误处理

- WiFi连接失败时自动重试
- 服务器连接失败时自动重试
- 网络异常时的错误提示

## 版本历史

- v1.0.0：初始版本，实现基本功能
- v1.1.0：优化服务器健康状态测试，添加自动重试机制
- v1.2.0：添加百度ping测试，优化OLED显示
- v1.3.0：添加编译脚本，优化项目结构

## 联系方式

如有问题或建议，请联系：
- 邮箱：support@example.com
- 网站：www.example.com
