# AI 模块升级文档 v2.0

> 更新日期: 2026-08-03
> 版本: 2.0.0
> 涉及模块: AI 视频检测、AI 文字控制、AI 实时监测、模型管理

---

## 一、升级概述

本次升级对 AI 模块进行了全面重构，解决了旧版代码中的多个技术债和功能缺失问题。

### 旧版主要问题
1. **硬编码配置**：模型名称、服务地址、上传路径全部硬编码在代码中
2. **数据库连接不统一**：AI 路由使用独立的 `mysql2/promise` 连接，未使用项目的集中 `db` 工具
3. **模型加载逻辑错误**：`POST /api/ai/models` 调用 Ollama `/api/pull`（下载模型）而非加载到内存
4. **AI 命令执行模拟**：Chat 接口解析命令后仅返回模拟结果，未实际调用设备控制 API
5. **无历史持久化**：聊天历史和诊断结果未保存到数据库
6. **设备类型不匹配**：旧版 `ActuatorType` 枚举仅包含 6 种类型，与实际数据库中的执行器类型不匹配
7. **无硬件集成**：服务端 AI 无法接收树莓派 YOLO 推理结果

### 升级后改进
- ✅ 所有配置集中到 `.env.local` + `lib/ai-config.ts`
- ✅ 所有 AI 路由统一使用 `@/lib/db` 集中数据库连接
- ✅ 模型管理正确支持 load/unload/pull/delete 四种操作
- ✅ AI 命令解析后自动调用 `/api/actuators/[id]/commands` 实际执行
- ✅ 聊天历史和诊断结果自动持久化到数据库
- ✅ 动态从数据库获取执行器列表，匹配所有设备类型
- ✅ 支持硬件端 YOLO 结果回传（`skip_inference` 参数）

---

## 二、新增/修改文件清单

### 新增文件
| 文件 | 说明 |
|------|------|
| `lib/ai-config.ts` | AI 模块共享配置（Ollama/推理/RAG 地址、模型名称、超时等） |
| `scripts/migrate-ai-tables.js` | 数据库迁移脚本（创建 ai_chat_history、ai_diagnosis_logs 表，升级 image_recognition_history 表） |

### 修改文件
| 文件 | 修改内容 |
|------|----------|
| `.env.local` | 添加 AI 模块配置段（OLLAMA_HOST、INFERENCE_HOST、模型名称等） |
| `app/api/ai/image-recognition/route.ts` | 重写：使用集中 db、配置化路径、支持硬件端回传、增强查询 |
| `app/api/ai/image-recognition/[id]/route.ts` | 重写：使用集中 db、配置化路径 |
| `app/api/ai/image-recognition/images/[filename]/route.ts` | 重写：配置化路径 |
| `app/api/ai/chat/route.ts` | 重写：动态获取执行器、真实执行命令、聊天历史持久化、新增 GET 接口 |
| `app/api/ai/diagnosis/route.ts` | 重写：使用集中 db、配置化模型/超时、诊断历史持久化、新增 GET 接口 |
| `app/api/ai/models/route.ts` | 重写：正确的模型管理 API、load/unload/pull/delete、内存状态查询 |
| `components/dashboard/model-management.tsx` | 适配新 API 格式、新增卸载功能 |
| `components/dashboard/ai-video-detection.tsx` | 兼容新旧 API 响应格式 |

### 数据库表变更
| 表名 | 变更 |
|------|------|
| `image_recognition_history` | 新增 `detection_data`(JSON)、`source`(VARCHAR)、`node_id`(VARCHAR) 列 |
| `ai_chat_history` | **新建** - AI 聊天历史记录表 |
| `ai_diagnosis_logs` | **新建** - AI 诊断历史记录表 |

---

## 三、API 接口文档

### 3.1 AI 图片识别

#### POST `/api/ai/image-recognition`
上传图片进行 AI 识别

**请求体 (multipart/form-data):**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `image` | File | ✅ | JPEG/PNG 图片 |
| `source` | string | ❌ | 来源标记（如 `hardware_raspberry`/`server_upload`） |
| `node_id` | string | ❌ | 硬件节点 ID（如 `CAM-1-001`） |
| `skip_inference` | string | ❌ | 传 `true` 跳过服务器端推理（硬件已完成推理时） |
| `detection_data` | string(JSON) | ❌ | 硬件端检测结果（`skip_inference=true` 时必填） |

**响应:**
```json
{
  "success": true,
  "data": {
    "detections": [{"class": "healthy", "confidence": 0.95}],
    "detection_count": 1,
    "best_match": {"class": "healthy", "confidence": 0.95},
    "image_url": "/uploads/ai/1700000000_photo.jpg",
    "timestamp": "2026-08-03T14:00:00.000Z",
    "source": "server"
  }
}
```

#### GET `/api/ai/image-recognition`
获取历史识别记录

**查询参数:**
| 参数 | 说明 |
|------|------|
| `limit` | 返回条数（默认 10，最大 50） |
| `source` | 按来源过滤 |
| `node_id` | 按节点 ID 过滤 |

---

### 3.2 AI 聊天控制

#### POST `/api/ai/chat`
解析自然语言命令并执行设备控制

**请求体:**
```json
{
  "message": "打开灌溉系统"
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "response": "已为您打开灌溉系统。",
    "commandInfo": {
      "action": "on",
      "actuatorId": "WP-1-001",
      "actuatorType": "water_pump",
      "controlType": "boolean",
      "controlValue": null,
      "reply": "已为您打开灌溉系统。"
    },
    "executionResult": {
      "success": true,
      "message": "命令已下发",
      "command_id": 8500
    }
  }
}
```

#### GET `/api/ai/chat`
获取聊天历史记录

**查询参数:** `limit`（默认 50，最大 100）

---

### 3.3 AI 诊断

#### POST `/api/ai/diagnosis`
执行 AI 综合诊断分析（传感器 + 图片识别）

**请求体:** 无（自动获取最新数据）

**响应:**
```json
{
  "success": true,
  "data": {
    "sensorData": [...],
    "detectionResults": [...],
    "diagnosis": {
      "summary": "A区温室1号温度25°C，在正常范围内...",
      "sensorAnalysis": [...],
      "issues": ["湿度偏低"],
      "suggestions": ["增加灌溉频率"],
      "actions": ["启动加湿器"]
    },
    "rawResponse": {
      "model": "qwen2.5:3b",
      "thinking": "...",
      "total_duration": 50000000
    }
  }
}
```

#### GET `/api/ai/diagnosis`
获取诊断历史记录

**查询参数:** `limit`（默认 20，最大 50）

---

### 3.4 模型管理

#### GET `/api/ai/models`
获取本地模型列表和运行中模型

**响应:**
```json
{
  "success": true,
  "service": {"running": true, "message": "Ollama 服务运行中"},
  "models": [
    {
      "name": "qwen2.5:3b",
      "size": 3200000000,
      "size_formatted": "3.00 GB",
      "family": "qwen2",
      "parameter_size": "3B",
      "quantization_level": "Q4_K_M",
      "loaded": true,
      "size_vram_formatted": "3.00 GB"
    }
  ],
  "loadedModels": [...]
}
```

#### POST `/api/ai/models`
操作模型

**请求体:**
```json
{"action": "load", "model_name": "qwen2.5:3b"}
```

| action | 说明 |
|--------|------|
| `load` | 加载模型到内存 |
| `unload` | 从内存卸载模型 |
| `pull` | 下载模型 |
| `delete` | 删除模型 |

---

## 四、配置说明

### `.env.local` AI 配置段

```env
# Ollama LLM 服务地址
OLLAMA_HOST=http://localhost:11434

# YOLO 推理服务地址
INFERENCE_HOST=http://localhost:5000

# RAG 知识库检索服务地址
RAG_SERVICE_URL=http://localhost:5001

# AI 默认模型
AI_DEFAULT_MODEL=qwen2.5:3b

# AI 聊天专用模型（留空使用默认）
AI_CHAT_MODEL=

# AI 诊断专用模型（留空使用默认）
AI_DIAGNOSIS_MODEL=

# 推理超时(ms)
AI_INFERENCE_TIMEOUT=30000

# 诊断超时(ms)
AI_DIAGNOSIS_TIMEOUT=120000

# 上传目录
AI_UPLOAD_DIR=public/uploads/ai

# 历史保留条数
AI_HISTORY_LIMIT=100
AI_CHAT_HISTORY_LIMIT=200
```

### 模型推荐
| 场景 | 推荐模型 | 说明 |
|------|----------|------|
| 命令解析 | `qwen2.5:3b` | 中文理解好，3B 参数量适合实时解析 |
| 诊断分析 | `qwen2.5:3b` | 综合分析能力强 |
| 资源紧张 | `qwen2.5:1.5b` | 更小更快，但能力有限 |

### 启动步骤
1. 启动 Ollama 服务：`ollama serve`
2. 拉取模型：`ollama pull qwen2.5:3b`
3. 启动推理服务（YOLO）：`python inference_server.py`
4. 启动 RAG 服务（可选）：`python rag_server.py`
5. 运行数据库迁移：`node scripts/migrate-ai-tables.js`
6. 启动 Next.js：`npm run dev`

---

## 五、硬件端对接

### 5.1 摄像头帧上传
树莓派将 YOLO 检测结果直接回传：

```python
import requests

# 方式1：服务器端推理
with open('frame.jpg', 'rb') as f:
    requests.post('http://server:3000/api/ai/image-recognition', files={'image': f})

# 方式2：硬件端推理后回传
detections = yolo_model(frame)  # 本地 YOLO 推理
with open('frame.jpg', 'rb') as f:
    requests.post('http://server:3000/api/ai/image-recognition',
        files={'image': f},
        data={
            'source': 'hardware_raspberry',
            'node_id': 'CAM-1-001',
            'skip_inference': 'true',
            'detection_data': json.dumps({'detections': detections})
        })
```

### 5.2 摄像头节点上报
在 `/api/device/report` 中包含摄像头节点，带 `feedback` 字段：

```json
{
  "node_id": "CAM-1-001",
  "type": "camera",
  "state": "on",
  "feedback": {
    "stream_url": "http://树莓派IP:8081/stream",
    "tracking_enabled": true,
    "color_preset": "blue",
    "pan_angle": 90,
    "tilt_angle": 90
  }
}
```

---

## 六、版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-07 | 初始版本，基础 AI 功能 |
| v2.0 | 2026-08-03 | 全面重构：配置化、统一数据库、真实命令执行、历史持久化、硬件集成 |
