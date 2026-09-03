# 智慧农业物联网平台

基于 STM32 + 树莓派 + 阿里云 ECS 的温室大棚监控系统，包含硬件采集、边缘网关、云端服务三层，支持环境数据采集、设备远程控制、YOLO 作物识别和 AI 诊断，多设备通过 WebSocket 实时通信。

---

## 目录

- [项目简介](#项目简介)
- [系统架构](#系统架构)
- [子项目说明](#子项目说明)
- [快速开始](#快速开始)
- [环境要求](#环境要求)
- [部署指南](#部署指南)
- [项目结构](#项目结构)
- [技术栈](#技术栈)
- [贡献指南](#贡献指南)
- [许可证](#许可证)

---

## 项目简介

本项目基于 STM32 + 树莓派 + 阿里云 ECS 搭建，通过 STM32 采集传感器数据、树莓派做边缘中转和 YOLO 视觉识别、云端跑 Next.js Web 应用和 WebSocket 服务，实现环境监控、设备控制、作物识别和 AI 诊断功能。

### 核心功能

| 功能模块 | 说明 |
|---------|------|
| 环境监测 | 温湿度、光照、CO2、土壤湿度等实时采集与图表展示 |
| AI 视觉识别 | 基于 YOLOv5/YOLO11 的作物病害检测与生长状态识别 |
| 执行器控制 | 蜂鸣器、风扇、激光、RGB-LED、继电器、摄像头云台控制 |
| 数据看板 | 实时数据流、历史趋势图表、设备状态总览 |
| 智能诊断 | LLM 驱动的设备故障诊断与运维建议 |
| 设备通信 | WebSocket 双向实时通信，支持多设备同时接入 |
| 告警系统 | 阈值告警、异常事件推送、告警记录查询 |

---

## 系统架构

### 硬件采集层

STM32F103 接了 DHT11 读空气温湿度，接 ADC 读光照强度，还通过 RS485 连了土壤传感器，读含水率、温度、电导率和 pH。土壤传感器走 Modbus-RTU 协议，4800 波特率，8N1 帧格式，CRC16 校验。执行器方面，继电器控制风扇和水泵，还有 PWM 舵机。采集到的数据通过 ATK-MB026 WiFi 模块以 TCP 透传发给树莓派，格式是 JSON，每个传感器有自己的 ID，比如 T-001 是空气温度、S-001 是土壤湿度。

### 边缘网关层

树莓派 4B 负责中转和边缘处理，跑 Raspberry Pi OS 64-bit，Python 3.9+。它通过串口收 STM32 的数据，然后用 WebSocket 客户端连到云端服务器（端口 8080）把数据推上去，同时本地通过摄像头跑 YOLO 做作物识别。执行器控制方面，树莓派通过 PCA9685（I2C 地址 0x40，50Hz PWM）驱动舵机，也控制继电器和蜂鸣器。云端下发的控制指令走 WebSocket 到树莓派，树莓派执行后回传回执。

### 云端服务层

云端跑在阿里云 ECS 上（Ubuntu 22.04），主要是 Next.js Web 应用（端口 3000）和一个独立的 WebSocket 服务（端口 8080/8081）。WebSocket 服务负责维护所有设备和网关的连接，处理传感器数据上报、控制指令下发、心跳保活、模型切换等消息，数据存 MySQL。Web 应用提供数据看板、设备管理、执行器控制、告警查看等页面，用户通过浏览器操作，数据实时刷新。另外还有一个 Flask 推理服务跑 YOLO 模型，以及一个基于 DeepSeek 的 AI 诊断代理。

### 数据流向

上行数据：传感器 -> STM32 -> WiFi TCP -> 树莓派 -> WebSocket -> 云端服务器 -> MySQL 存储 -> Web 前端展示。视觉检测：摄像头 -> YOLO 推理 -> 检测结果通过 WebSocket 上报云端存储。下行控制：用户操作 -> Web 前端 -> REST API -> 云端服务器 -> WebSocket -> 树莓派 -> 执行器动作。

---

## 子项目说明

### 1. smart-agriculture — 云端 Web 应用

| 属性 | 说明 |
|------|------|
| **路径** | `smart-agriculture/` |
| **技术栈** | Next.js 16 + React 19 + TypeScript + TailwindCSS + shadcn/ui |
| **数据库** | MySQL 8.0（生产）/ SQLite（开发） |
| **说明** | 平台核心 Web 应用，包含前端界面、REST API、WebSocket 实时通信服务、AI 推理服务 |

**主要功能**：数据看板、设备管理、执行器控制、AI 诊断、知识库、告警管理

---

### 2. 基于树莓派yolo的传感器检测与上传 — 边缘网关

| 属性 | 说明 |
|------|------|
| **路径** | `基于树莓派yolo的传感器检测与上传/` |
| **技术栈** | Python 3.9+ + YOLOv5/YOLO11 + WebSocket |
| **硬件** | 树莓派 4B + Raspberry Pi OS |
| **说明** | 树莓派上运行的网关程序，负责采集传感器数据、跑 YOLO 检测、控制执行器、跟云端通信 |

**主要功能**：传感器采集、YOLO 推理、WebSocket 上报、执行器驱动（蜂鸣器/风扇/激光/RGB-LED/继电器）、摄像头云台控制、OTA 升级

---

### 3. 硬件端 — STM32 嵌入式固件

| 属性 | 说明 |
|------|------|
| **路径** | `硬件端/` |
| **技术栈** | C + STM32F103 + Keil MDK + Makefile |
| **说明** | STM32F103 单片机固件，负责底层传感器数据采集、RS485 通信、PWM 舵机驱动、D4X TTL 通讯 |

**子目录**：
- `stm32-main/` — 主固件项目（Keil MDK）
- `stm32-makefile/` — Makefile 构建版本
- `stm32-wifi/` — WiFi 通信扩展
- `stm32-v3/` — V3 版本迭代

---

### 4. bonsai_agent — AI 智能代理

| 属性 | 说明 |
|------|------|
| **路径** | `bonsai_agent/` |
| **技术栈** | Python + DeepSeek API + Web 界面 |
| **说明** | 基于 DeepSeek 的 AI 代理，可以诊断设备故障、分析日志、回答运维问题 |

**主要功能**：设备故障诊断、传感器数据分析、LLM 工具调用、Web 交互界面

---

### 5. device-simulator — 设备模拟器

| 属性 | 说明 |
|------|------|
| **路径** | `device-simulator/` |
| **技术栈** | Python |
| **说明** | 本地开发测试用的设备模拟器，模拟真实传感器数据上报和执行器控制响应，无需硬件即可开发调试 |

**主要功能**：模拟传感器数据生成、WebSocket 连接测试、执行器指令响应模拟、PyInstaller 打包为独立可执行文件

---

### 6. 云端部署 — 部署脚本与配置

| 属性 | 说明 |
|------|------|
| **路径** | `云端部署/` |
| **技术栈** | Shell + PM2 + 阿里云 CLI |
| **说明** | 包含生产环境部署所需的全部脚本、配置文件和运维工具 |

**主要内容**：
- `ecosystem.config.js` — PM2 进程管理配置
- `server-init.sh` — 服务器初始化脚本
- `deploy-app.sh` — 应用部署脚本
- `i2c-watchdog.sh` — I2C 看门狗服务
- `setup-events-2.sh` — MySQL 事件调度配置
- 各类诊断与检查脚本

---

## 快速开始

### 本地开发

#### 1. 克隆项目

```bash
git clone <repository-url>
cd smart-agriculture
```

#### 2. 安装依赖

```bash
# 安装 Node.js 依赖
npm install

# 安装 Python 推理服务依赖（可选）
cd inference-service
pip install -r requirements.txt
```

#### 3. 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`，配置数据库和 AI 服务：

```env
# 数据库（本地开发默认 SQLite，无需额外配置）
DATABASE_TYPE=sqlite
SQLITE_DB_PATH=./smart_agriculture.db

# AI 模式（auto / local / network）
AI_MODE=auto
```

#### 4. 初始化数据库

```bash
node scripts/init-db.js
```

#### 5. 启动开发服务器

```bash
# 一键启动（推荐）
npm run dev

# 或使用启动脚本
# Windows
setup.bat
# Linux/macOS
./setup.sh
```

#### 6. 启动设备模拟器（可选）

```bash
cd ../device-simulator
python simulator.py
```

访问 http://localhost:3000 即可看到平台界面。

---

### 云端部署

#### 1. 服务器准备

```bash
# 在阿里云 ECS (Ubuntu 22.04) 上执行初始化
sudo bash server-init.sh
```

#### 2. 部署应用

```bash
# 构建 Next.js 应用
cd smart-agriculture
npm ci
npm run build

# 使用 PM2 启动
pm2 start ecosystem.config.js
pm2 save
```

#### 3. PM2 进程说明

| 进程名 | 端口 | 说明 |
|--------|------|------|
| `smart-agri-web` | 3000 | Next.js Web 应用 |
| `smart-agri-ws` | 8080/8081 | WebSocket 设备通信服务 |

#### 4. 配置树莓派网关

```bash
# 在树莓派上
cd 基于树莓派yolo的传感器检测与上传
pip install -r requirements.txt

# 配置云端服务器地址
# 编辑 config/ 目录下的配置文件

# 启动网关程序
python main.py
```

---

## 环境要求

| 组件 | 要求 | 说明 |
|------|------|------|
| **Node.js** | ≥ 18.x | Next.js 运行时 |
| **Python** | ≥ 3.9 | 推理服务、网关、模拟器 |
| **MySQL** | 8.0+ | 生产环境数据库 |
| **SQLite** | 内置 | 本地开发数据库（无需安装） |
| **树莓派** | 4B+ | 边缘网关硬件 |
| **Raspberry Pi OS** | 64-bit | 网关操作系统 |
| **STM32F103** | - | 嵌入式采集硬件 |
| **Keil MDK** | 5.x | STM32 固件开发 IDE |
| **阿里云 ECS** | 2核2G+ | 生产服务器（最低配置） |
| **Ubuntu** | 22.04 LTS | 服务器操作系统 |
| **PM2** | latest | Node.js 进程管理 |

---

## 部署指南

### 生产环境架构

```
阿里云 ECS (cn-chengdu, Ubuntu 22.04)
├── Nginx (反向代理)
├── PM2
│   ├── smart-agri-web  → :3000 (Next.js)
│   └── smart-agri-ws   → :8080/:8801 (WebSocket)
├── MySQL 8.0           → :3306
├── Flask 推理服务      → :5000
└── PM2-logrotate       (日志轮转)
```

### 端口规划

| 端口 | 服务 | 说明 |
|------|------|------|
| 3000 | Next.js Web | 前端页面 + REST API |
| 8080 | WebSocket (设备) | 树莓派网关接入 |
| 8081 | WebSocket (中继) | 前端实时数据推送 |
| 5000 | Flask 推理 | YOLO 模型推理服务 |
| 3306 | MySQL | 数据库 |

### 关键部署脚本

| 脚本 | 用途 |
|------|------|
| `server-init.sh` | 服务器初始化（Node.js、MySQL、PM2 安装） |
| `deploy-app.sh` | 应用部署（构建 + PM2 重启） |
| `install-i2c-watchdog.sh` | I2C 看门狗服务安装 |
| `setup-events-2.sh` | MySQL 定时事件配置 |
| `seed-farm.sh` | 初始农场数据导入 |

### 日志管理

平台采用统一 Logger 模块（TypeScript + Python），配合 PM2-logrotate 实现日志轮转：

```bash
# 查看日志
pm2 logs smart-agri-web
pm2 logs smart-agri-ws

# 日志轮转配置
pm2 install pm2-logrotate
```

---

## 项目结构

```
tghy/
├── smart-agriculture/              # 云端 Web 应用（Next.js 全栈）
│   ├── app/                        #   Next.js App Router 页面与 API
│   ├── components/                 #   React UI 组件
│   ├── lib/                        #   核心业务库（数据库、WebSocket、AI）
│   ├── hooks/                      #   React Hooks
│   ├── inference-service/          #   Python Flask + YOLO 推理服务
│   ├── scripts/                    #   工具脚本（初始化、检查、部署）
│   ├── styles/                     #   全局样式
│   ├── public/                     #   静态资源
│   ├── models/                     #   YOLO 模型文件
│   ├── tools/                      #   辅助工具
│   ├── installer/                  #   安装器
│   ├── websocket-server.js         #   WebSocket 服务器入口
│   ├── package.json                #   Node.js 依赖
│   ├── docker-compose.yml          #   Docker 编排
│   └── Dockerfile                  #   Docker 构建
│
├── 基于树莓派yolo的传感器检测与上传/  # 树莓派边缘网关
│   ├── main.py                     #   网关主程序入口
│   ├── agent/                      #   网关 Agent 逻辑
│   ├── core/                       #   核心采集与控制模块
│   ├── drivers/                    #   硬件驱动（传感器、执行器）
│   ├── services/                   #   服务层（WebSocket、数据处理）
│   ├── scanner/                    #   YOLO 扫描检测
│   ├── models/                     #   模型文件
│   ├── config/                     #   配置文件
│   ├── ota/                        #   OTA 远程升级
│   ├── ui/                         #   本地 UI
│   ├── tests/                      #   测试
│   └── requirements.txt            #   Python 依赖
│
├── 硬件端/                          # STM32 嵌入式固件
│   ├── stm32-main/                 #   主固件（Keil MDK 项目）
│   ├── stm32-makefile/             #   Makefile 构建版本
│   ├── stm32-wifi/                 #   WiFi 通信扩展
│   └── stm32-v3/                   #   V3 版本
│
├── bonsai_agent/                   # AI 智能代理
│   ├── main.py                     #   Agent 主程序
│   ├── tools/                      #   LLM 工具集
│   ├── prompts/                    #   提示词模板
│   ├── database/                   #   数据访问层
│   ├── control/                    #   设备控制
│   ├── web/                        #   Web 界面
│   └── requirements.txt            #   Python 依赖
│
├── device-simulator/               # 设备模拟器
│   ├── simulator.py                #   模拟器主程序
│   ├── requirements.txt            #   Python 依赖
│   └── DeviceSimulator.spec        #   PyInstaller 打包配置
│
├── 云端部署/                        # 部署脚本与配置
│   ├── ecosystem.config.js         #   PM2 进程配置
│   ├── server-init.sh              #   服务器初始化
│   ├── deploy-app.sh               #   应用部署
│   ├── i2c-watchdog.sh             #   I2C 看门狗
│   ├── env.production.template     #   生产环境变量模板
│   └── *.sh                        #   各类运维脚本
│
├── database/                       # 数据库文件
│   └── agriculture_iot.db          #   SQLite 数据库
│
├── 参考文件夹/                      # 参考资料
│   ├── RS485通信测试程序/            #   RS485 通信示例
│   └── ATK-D4X TTL通讯/            #   D4X TTL 通讯资料
│
└── README.md                       # 本文件
```

---

## 技术栈

**Web 端**：Next.js 16、React 19、TypeScript 5.7、TailwindCSS 4、shadcn/ui、Recharts、Radix UI

**服务端**：Next.js API Routes、WebSocket (ws 8.x)、MySQL 8.0、SQLite、Flask

**AI & 推理**：YOLOv5、YOLO11、DeepSeek API、Ollama、FAISS + BGE

**嵌入式**：STM32F103、Keil MDK 5.x、RS485、DHT11、PCA9685、Raspberry Pi 4B

**部署**：阿里云 ECS (Ubuntu 22.04)、PM2、Nginx、Docker（可选）

---

## 贡献指南

欢迎提 Issue 或 PR。开发请在 `feature/*` 或 `dev/*` 分支进行，不要硬编码敏感信息（服务器 IP、密码、API Key 等），统一用 `.env` 文件管理。

---

## 许可证

本项目基于 [MIT License](LICENSE) 开源发布。

```
MIT License

Copyright (c) 2024-2026 天工慧眼

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

