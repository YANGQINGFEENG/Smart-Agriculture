---
name: "keil-firmware-flasher"
description: "将Keil编译生成的固件文件烧录到单片机中，支持自动检测串口、固件文件路径和芯片类型，集成embedded-agent-bridge工具实现可靠的固件烧录。当用户需要烧录STM32/ESP32等单片机固件时调用。"
version: "1.1.0"
user-invocable: true
allowed-tools:
  - run_shell
  - read_file
  - write_file
  - search
---

# Keil 固件烧录 Skill

## 前置依赖

### embedded-agent-bridge 工具
- **项目地址**：[https://github.com/shanemmattner/embedded-agent-bridge](https://github.com/shanemmattner/embedded-agent-bridge)
- **安装方法**：
  ```powershell
  # 从 GitHub 克隆并安装
  git clone https://github.com/shanemmattner/embedded-agent-bridge.git
  cd embedded-agent-bridge
  pip install -e .
  ```
- **依赖要求**：
  - Python 3.8 或更高版本
  - pyserial、portalocker
  - 可选：J-Link Software Pack、OpenOCD、GDB

### 注意事项
- **Windows 系统**：已修复硬编码路径问题，使用系统临时目录
- **权限问题**：在 Windows 上可能需要以管理员身份运行
- **调试器驱动**：确保安装了对应调试器的驱动（ST-Link、J-Link等）
- **端口冲突**：使用 `--device` 参数指定设备名称避免锁文件冲突

## 触发词
- "烧录固件到单片机"
- "flash固件"
- "下载程序到STM32"
- "烧录hex/axf文件"
- "将编译结果烧入单片机"

## 输入
- Keil项目文件路径（默认：Project.uvprojx）
- 固件文件路径（自动检测Objects目录下的.hex/.axf/.bin文件）
- 目标芯片类型（自动检测或用户指定：stm32/esp32/nrf等）
- 串口/调试器接口（自动检测或用户指定）

## 输出
- 烧录成功/失败 结论
- 烧录进度信息
- 串口/调试器连接状态
- 固件验证结果（如支持）

## 执行步骤
1. **检查编译状态**
   - 首先调用 keil-compile-result-check skill 确认固件已成功编译
   - 检查Objects目录下是否存在.hex/.axf/.bin文件

2. **路径自动检测**
   - **固件文件**：
     1. 查找项目Objects目录下最新的.hex/.axf/.bin文件
     2. 优先使用.hex文件（兼容性最好）
     3. 如果不存在，尝试.axf或.bin
   - **串口/调试器**：
     1. 使用 embedded-agent-bridge 的 eabctl 自动检测可用串口
     2. 支持ST-Link、J-Link、CMSIS-DAP等调试器
     3. 支持ESP32的USB串口烧录

3. **芯片类型检测**
   - 从Keil项目文件中解析目标芯片型号
   - 或通过调试器读取芯片ID自动识别
   - 支持手动指定芯片类型（如：stm32f103, esp32s3等）

4. **使用 embedded-agent-bridge 烧录**
   ```powershell
   # 启动serial daemon（如果需要串口烧录）
   eabctl --device [设备名称] start --port auto
   
   # 烧录固件（根据芯片类型选择合适的命令）
   # STM32（ST-Link）
   eabctl --device [设备名称] flash [固件文件] --chip stm32
   
   # ESP32
   eabctl --device [设备名称] flash [固件文件] --chip esp32
   
   # 或使用OpenOCD
   eabctl --device [设备名称] openocd start --chip [芯片型号]
   eabctl --device [设备名称] gdb --cmd "load [固件文件]"
   ```
   
   **注意**：
   - `[设备名称]` 可以是任意标识符，如 `stm32`, `esp32` 等，用于避免锁文件冲突
   - 确保已经安装并配置了 embedded-agent-bridge 工具
   - 对于 Windows 系统，已修复硬编码路径问题，可正常使用

5. **烧录结果验证**
   - 检查烧录命令的退出码
   - 读取串口输出确认芯片启动正常
   - 使用 eabctl status 检查连接健康状态

6. **结果判定**
   - ✅ 烧录成功：命令成功执行 + 芯片正常启动
   - ❌ 烧录失败：命令执行失败 或 芯片无响应

## 配置文件管理
- **配置文件位置**：`.trae/skills/keil-firmware-flasher/config.json`
- **存储内容**：
  - 上次成功的固件文件路径
  - 上次成功的芯片类型
  - 上次成功的串口/调试器
  - 烧录历史记录

## 错误处理
- **固件文件不存在** → 提示先编译项目
- **未检测到调试器/串口** → 提示检查硬件连接
- **烧录失败** → 分析错误日志，提供常见问题解决方案
- **芯片类型不匹配** → 提示确认芯片型号

## 示例
### 成功烧录
```
✅ 固件烧录成功！
芯片型号：STM32F103C8
固件文件：./Objects/Project.hex
烧录方式：ST-Link
```

### 失败示例
```
❌ 烧录失败！
错误：未检测到ST-Link调试器
建议：请检查USB连接和驱动程序
```

## 与其他技能的集成
- **前置依赖**：keil-compile-result-check（确保固件已编译）
- **后续可选**：serial-monitor（监控串口输出验证程序运行）
