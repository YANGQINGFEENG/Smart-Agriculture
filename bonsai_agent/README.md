# 天工慧眼（Tiangong Huiyan）

川派盆景智能监测与自主养护系统。

当前项目已经完成软件系统主框架，包括环境监测、规则控制、专家知识库、DeepSeek 辅助诊疗、SQLite 运行数据库、FastAPI 后端、Web 可视化以及云端部署基础。

> 当前阶段仍有三部分为模拟接口：YOLO 识别、传感器读取、设备执行。后续接入真实 `best.pt`、真实传感器和真实执行器时，主要替换对应工具模块即可，不需要推翻现有架构。

---

## 1. 系统架构

```text
                    ┌─────────────────────┐
                    │      树莓派 5       │
                    │                     │
摄像头 ───────────→ │ YOLO（后续 best.pt）│
传感器 ───────────→ │ 环境感知            │
                    │ 规则引擎            │
                    │ 专家数据库          │
                    │ DeepSeek / Ollama   │
                    │ SQLite（本地记录）   │
                    │                     │
                    └─────────┬───────────┘
                              │
                         HTTP / Internet
                              │
                    ┌─────────▼───────────┐
                    │      云服务器        │
                    │ FastAPI             │
                    │ SQLite              │
                    │ Web 仪表盘          │
                    └─────────┬───────────┘
                              │
                       手机 / 电脑 / 平板
```

系统采用“云—边—端”思路：

- 边缘端负责 AI 推理、传感器采集、规则判断和设备控制。
- 云端负责数据接收、历史记录和 Web 展示。
- 即使互联网断开，现场自动养护逻辑也应继续运行。

---

## 2. 当前项目目录

```text
bonsai_agent/
├── main.py
│
├── tools/
│   ├── sensor_tool.py
│   ├── yolo_tool.py
│   ├── knowledge_tool.py
│   ├── llm_tool.py
│   ├── device_tool.py
│   └── cloud_tool.py
│
├── control/
│   └── decision_engine.py
│
├── database/
│   ├── database.py
│   ├── init_db.py
│   └── repository.py
│
├── web/
│   ├── __init__.py
│   ├── api.py
│   └── static/
│       └── index.html
│
├── data/
│   ├── 专家数据库.xlsx
│   └── tiangong_huiyan.db
│
├── prompts/
│   └── system_prompt.txt
│
├── requirements.txt
└── README.md
```

后续接入真实 YOLO 后，建议增加：

```text
models/
└── best.pt
```

---

## 3. 当前已经实现的功能

### 3.1 环境监测

当前由 `tools/sensor_tool.py` 返回模拟数据：

```text
温度
空气湿度
土壤湿度
光照
```

数据可以写入 SQLite 的 `sensor_records` 表。

后续接入真实硬件时，只需把 `get_sensor_data()` 中的模拟值替换成真实传感器读取逻辑。

---

### 3.2 YOLO 病虫害识别

当前 `tools/yolo_tool.py` 使用模拟结果，例如：

```python
{
    "name": "红蜘蛛",
    "confidence": 0.87
}
```

后续将替换为：

```text
摄像头 / 图片
    ↓
best.pt
    ↓
YOLO
    ↓
病虫害名称 + 置信度 + 检测框
```

真实 YOLO 尚未接入，因此当前 `requirements.txt` 暂不包含 `ultralytics`。

---

### 3.3 专家知识库

`tools/knowledge_tool.py` 用于读取：

```text
data/专家数据库.xlsx
```

当前采用：

```text
pandas + python-calamine
```

查询病虫害对应的专家条目、判断依据、风险等级和处置建议。

---

### 3.4 DeepSeek / Ollama

`tools/llm_tool.py` 调用本地 Ollama。

当前模型：

```text
deepseek-r1:1.5b
```

设计原则：

```text
YOLO
→ 初步识别“是什么”

专家数据库
→ 提供可靠知识和处置依据

DeepSeek
→ 辅助解释、补充判断、未命中专家库时提供谨慎兜底
```

DeepSeek 不直接控制 GPIO、水泵等执行器。

---

### 3.5 自动养护控制

`control/decision_engine.py` 根据传感器值执行确定性规则，例如：

```text
土壤湿度 < 25%
→ 水泵

温度 > 35℃
→ 风扇

光照 < 10000 lux
→ 补光灯
```

`tools/device_tool.py` 负责设备动作。

当前为模拟执行，后续替换为 GPIO、UART、I2C 或 STM32 串口控制。

---

### 3.6 SQLite 数据库

当前有四张运行数据表：

```text
sensor_records
detection_records
diagnosis_records
device_logs
```

分别用于保存：

- 环境历史数据
- YOLO 识别历史
- Agent 诊疗历史
- 设备执行日志

---

### 3.7 FastAPI 与 Web

FastAPI 提供后端接口，Web 页面通过接口读取最新数据。

当前主要接口包括：

```text
GET  /api/sensors
GET  /api/detection
GET  /api/diagnosis
GET  /api/device/latest
GET  /api/status
```

如果当前 `web/api.py` 已加入云端上传接口，还包括：

```text
POST /api/upload/sensors
POST /api/upload/detection
POST /api/upload/diagnosis
POST /api/upload/device
```

FastAPI 自动接口文档：

```text
http://服务器地址:8000/docs
```

---

## 4. 环境要求

推荐：

```text
Python 3.10+
Ubuntu 22.04 LTS（云服务器）
Windows / Raspberry Pi OS / Ubuntu（边缘端开发均可）
```

Python 依赖见：

```text
requirements.txt
```

---

## 5. 安装 Python 依赖

建议使用虚拟环境。

### Windows

```cmd
python -m venv venv
venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### Ubuntu / Raspberry Pi

```bash
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

---

## 6. 安装 Ollama 和 DeepSeek

Python 的 `ollama` 包只是客户端。

系统本身还需要安装 Ollama，并准备对应模型。

当前项目使用：

```bash
ollama pull deepseek-r1:1.5b
```

测试：

```bash
ollama run deepseek-r1:1.5b
```

> 云服务器如果只承担 FastAPI、数据库和 Web 展示，则不需要在云端部署 DeepSeek。DeepSeek 更适合运行在本地电脑或树莓派等边缘端。

---

## 7. 初始化 SQLite

进入项目根目录：

```bash
python -m database.init_db
```

正常输出：

```text
SQLite数据库初始化成功
已创建以下数据表：
1. sensor_records
2. detection_records
3. diagnosis_records
4. device_logs
```

数据库文件默认位于：

```text
data/tiangong_huiyan.db
```

---

## 8. 启动自动运行主程序

```bash
python main.py
```

当前主程序负责：

```text
读取传感器
→ 写 SQLite
→ 规则判断
→ 执行设备
→ 写设备日志

YOLO
→ 写识别记录
→ 查询专家数据库
→ 调用 DeepSeek
→ 写诊疗记录
```

当前传感器、YOLO 和设备执行仍为模拟接口。

---

## 9. 启动 FastAPI

开发测试：

```bash
python -m uvicorn web.api:app --host 0.0.0.0 --port 8000
```

访问：

```text
http://127.0.0.1:8000
```

局域网或云服务器部署后，则使用对应 IP。

接口文档：

```text
http://服务器IP:8000/docs
```

---

## 10. 云服务器部署

当前云端建议仅部署：

```text
FastAPI
SQLite
Web
数据接收接口
```

不建议在 2 核 2G 云服务器上运行 YOLO 和 DeepSeek。

推荐目录：

```text
/opt/bonsai_agent
```

虚拟环境：

```text
/opt/bonsai_agent/venv
```

---

## 11. systemd 后台运行

示例服务：

```ini
[Unit]
Description=Tiangong Huiyan FastAPI Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/bonsai_agent
ExecStart=/opt/bonsai_agent/venv/bin/python -m uvicorn web.api:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

常用命令：

```bash
# 查看服务状态
systemctl status tiangong-huiyan

# 启动服务
systemctl start tiangong-huiyan

# 停止服务
systemctl stop tiangong-huiyan

# 重启服务
systemctl restart tiangong-huiyan

# 设置开机自启
systemctl enable tiangong-huiyan
```

---

## 12. 云端通信

边缘端通过 `tools/cloud_tool.py` 主动把数据上传到云服务器。

数据流：

```text
树莓派
↓
HTTP POST
↓
FastAPI
↓
云端 SQLite
↓
Web
```

例如：

```text
传感器
→ /api/upload/sensors

YOLO
→ /api/upload/detection

Agent
→ /api/upload/diagnosis

设备日志
→ /api/upload/device
```

后续如果设备规模扩大，可以考虑 MQTT。

---

## 13. 当前仍需完成的工作

### 真实 YOLO

```text
models/best.pt
+ ultralytics
+ 摄像头 / 图片
```

替换当前模拟 `yolo_tool.py`。

### 真实传感器

替换 `sensor_tool.py` 中的模拟值。

### 真实设备

替换 `device_tool.py` 中的模拟输出，接入：

```text
GPIO
串口
STM32
继电器
水泵
风扇
补光灯
舵机
```

### Web 后续增强

可逐步增加：

```text
实时摄像头
历史数据曲线
识别历史
诊疗历史
设备日志
手动 / 自动模式
告警
用户权限
```

---

## 14. 安全注意事项

不要把以下内容提交到 GitHub 或直接发给其他人：

```text
.env
SSH 私钥
id_ed25519
服务器 root 密码
正式 API Key
云平台 AccessKey
```

推荐后续把：

```text
云服务器地址
API Key
模型名称
```

统一改为环境变量或独立配置文件。

如果要共享项目源码，建议不要包含：

```text
venv/
__pycache__/
.env
.ssh/
```

---

## 15. 项目定位

天工慧眼当前采用：

```text
AI视觉识别
+
专家知识库
+
DeepSeek Agent
+
环境感知
+
确定性规则控制
+
边缘设备
+
云端 FastAPI
+
Web 可视化
```

形成川派盆景病虫害智能诊疗与自主养护的软件基础架构。
