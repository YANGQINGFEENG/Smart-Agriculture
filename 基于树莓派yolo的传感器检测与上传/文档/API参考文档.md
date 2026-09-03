# API 参考文档

## 概述

本文档描述智慧农业平台所有API接口的详细说明，包括请求格式、响应格式、参数说明和错误码。

**基础URL**: `http://localhost:3000/api`

### 系统架构

平台采用分布式架构，由三个独立进程协同工作：

| 进程 | 端口 | 职责 |
|------|------|------|
| **Next.js开发服务器** | 3000 | 提供HTTP API、渲染前端页面、数据库操作 |
| **WebSocket服务器** | 8080 | 处理WebSocket实时连接、命令推送、状态同步 |
| **HTTP转发接口** | 8081 | 接收HTTP命令并转发到WebSocket连接（桥梁作用） |

### 命令下发流程

```
用户操作 → POST /api/actuators/{id}/commands → 写入数据库(pending)
    → HTTP POST http://localhost:8081/send-command → WebSocket推送命令
    → 硬件执行 → WebSocket command_ack回执 → 更新数据库(executed)
    → 前端轮询检测 → 乐观更新UI → 异步同步
```

### 冗余保障

- **优先使用WebSocket**：实时推送命令，响应延迟<500ms
- **降级为HTTP轮询**：WebSocket断开时自动切换，确保命令不丢失

---

## 一、传感器相关API

### 1.1 获取传感器列表

**接口地址**: `GET /api/sensors`

**功能说明**: 获取所有传感器设备列表，支持按类型过滤。

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 否 | 按传感器类型过滤（如：temperature, humidity） |
| farm_id | number | 否 | 按农场ID过滤 |

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "T-1-001",
      "name": "空气温度传感器",
      "type_id": 1,
      "type": "temperature",
      "type_name": "温度传感器",
      "location": "温室中部",
      "area": "温室1号区域",
      "status": "online",
      "battery": 95,
      "value": 25.5,
      "unit": "°C",
      "last_update": "2026-07-30 18:30:00",
      "created_at": "2026-07-20 08:00:00"
    }
  ],
  "total": 10
}
```

**设备在线状态说明**：
- 系统基于 `last_update` 字段判断设备在线状态
- 如果最后更新时间超过5分钟，状态将显示为 `offline`
- 计算方式：`(当前时间 - last_update时间) / 1000 / 60 <= 5`

---

### 1.2 获取单个传感器详情

**接口地址**: `GET /api/sensors/[id]`

**功能说明**: 获取指定传感器的详细信息。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 传感器ID |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "T-1-001",
    "name": "空气温度传感器",
    "type_id": 1,
    "type": "temperature",
    "type_name": "温度传感器",
    "location": "温室中部",
    "area": "温室1号区域",
    "status": "online",
    "battery": 95,
    "last_update": "2026-07-30 18:30:00"
  }
}
```

---

### 1.3 删除传感器

**接口地址**: `DELETE /api/sensors/[id]`

**功能说明**: 删除指定传感器设备及其历史数据。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 传感器ID |

**响应示例**:
```json
{
  "success": true,
  "message": "传感器删除成功"
}
```

---

### 1.4 获取传感器历史数据

**接口地址**: `GET /api/sensors/[id]/data`

**功能说明**: 获取传感器的历史数据记录，支持时间范围查询和数据排序。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 传感器ID |

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| limit | number | 否 | 返回数据条数，默认100。**注意**：根据时间范围自动计算，长时间范围会自动增加 |
| start_time | string | 否 | 开始时间（北京时间，格式：YYYY-MM-DD HH:MM:SS） |
| end_time | string | 否 | 结束时间（北京时间，格式：YYYY-MM-DD HH:MM:SS） |
| order | string | 否 | 排序方式：`desc`（降序，默认）或 `asc`（升序） |

**时间范围查询说明**：
- 支持查询任意时间范围的数据
- 当查询范围超过12小时时，系统会自动增加limit值
- 计算公式：`limit = max(时间范围小时数 × 120 × 1.5, 300)`
- 确保长时间范围查询返回足够的数据点

**请求示例**：
```
GET /api/sensors/T-1-001/data?start_time=2026-07-30 00:00:00&end_time=2026-07-30 23:59:59&order=asc
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "sensor_id": "T-1-001",
      "value": 25.5,
      "timestamp": "2026-07-30 18:30:00"
    }
  ],
  "total": 1000
}
```

---

### 1.5 获取传感器类型列表

**接口地址**: `GET /api/sensor-types`

**功能说明**: 获取所有支持的传感器类型。

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "temperature",
      "name": "温度传感器",
      "unit": "°C"
    },
    {
      "id": 2,
      "type": "humidity",
      "name": "空气湿度传感器",
      "unit": "%"
    }
  ],
  "total": 15
}
```

---

### 1.6 新增传感器类型

**接口地址**: `POST /api/sensor-types`

**功能说明**: 添加新的传感器类型。

**请求体**:
```json
{
  "type": "soil_moisture",
  "name": "土壤湿度传感器",
  "unit": "%"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 3,
    "type": "soil_moisture",
    "name": "土壤湿度传感器",
    "unit": "%"
  },
  "message": "传感器类型创建成功"
}
```

---

### 1.7 删除传感器类型

**接口地址**: `DELETE /api/sensor-types/[id]`

**功能说明**: 删除指定传感器类型。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | 是 | 传感器类型ID |

**响应示例**:
```json
{
  "success": true,
  "message": "传感器类型删除成功"
}
```

---

## 二、执行器相关API

### 2.1 获取执行器列表

**接口地址**: `GET /api/actuators`

**功能说明**: 获取所有执行器设备列表，支持按类型过滤。返回数据包含feedback字段。

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 否 | 按执行器类型过滤（如：water_pump, fan, buzzer, rgb_led, camera） |
| farm_id | number | 否 | 按农场ID过滤 |

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "MT-1-1001",
      "name": "通风电机",
      "type_id": 1,
      "type": "motor",
      "type_name": "电机",
      "description": "用于驱动控制，支持速度调节",
      "location": "温室顶部",
      "area": "温室1号区域",
      "status": "online",
      "state": "on",
      "mode": "manual",
      "control_value": 60,
      "control_type": "integer",
      "control_min": 0,
      "control_max": 100,
      "control_step": 1,
      "control_default": 0,
      "locked": 0,
      "feedback": {
        "state": "on",
        "control_value": 60,
        "direction": "forward",
        "speed": 0.6
      },
      "last_update": "2026-07-30 18:30:00",
      "created_at": "2026-07-20 08:00:00"
    },
    {
      "id": "LT-1-002",
      "name": "RGB-LED",
      "type_id": 5,
      "type": "light",
      "type_name": "补光灯",
      "description": "用于RGB颜色控制",
      "location": "温室中部",
      "area": "温室1号区域",
      "status": "online",
      "state": "on",
      "mode": "manual",
      "control_value": 50,
      "control_type": "integer",
      "control_min": 0,
      "control_max": 100,
      "control_step": 1,
      "control_default": 0,
      "locked": 0,
      "feedback": {
        "state": "on",
        "color": {"r": 255, "g": 128, "b": 0},
        "brightness": 60,
        "R": 255,
        "G": 128,
        "B": 0
      },
      "last_update": "2026-07-30 18:30:00",
      "created_at": "2026-07-20 08:00:00"
    }
  ],
  "total": 9
}
```

**feedback字段说明**：
- feedback是JSON格式，存储设备特有回馈数据
- 不同执行器类型的feedback结构不同，详见设备回馈数据说明

---

### 2.2 获取单个执行器详情

**接口地址**: `GET /api/actuators/[id]`

**功能说明**: 获取指定执行器的详细信息。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 执行器ID |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "MT-1-1001",
    "name": "通风电机",
    "type": "motor",
    "type_name": "电机",
    "location": "温室顶部",
    "area": "温室1号区域",
    "status": "online",
    "state": "on",
    "mode": "manual",
    "control_value": 60,
    "control_type": "integer",
    "feedback": {
      "state": "on",
      "direction": "forward",
      "speed": 0.6
    }
  }
}
```

---

### 2.3 新增执行器

**接口地址**: `POST /api/actuators`

**功能说明**: 手动添加执行器设备。

**请求体**:
```json
{
  "name": "补光灯2号",
  "type_id": 3,
  "location": "温室B区",
  "area": "B区"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "LT-002",
    "name": "补光灯2号",
    "type": "light",
    "type_name": "补光灯",
    "location": "温室B区"
  },
  "message": "执行器创建成功"
}
```

---

### 2.4 删除执行器

**接口地址**: `DELETE /api/actuators/[id]`

**功能说明**: 删除指定执行器设备。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 执行器ID |

**响应示例**:
```json
{
  "success": true,
  "message": "执行器删除成功"
}
```

---

### 2.5 获取执行器类型列表

**接口地址**: `GET /api/actuator-types`

**功能说明**: 获取所有支持的执行器类型。

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "water_pump",
      "name": "水泵",
      "description": "灌溉用水泵设备",
      "control_type": "boolean"
    },
    {
      "id": 2,
      "type": "fan",
      "name": "风扇",
      "description": "通风降温设备",
      "control_type": "integer",
      "control_range": {"min": 0, "max": 100, "step": 1, "default": 0}
    },
    {
      "id": 3,
      "type": "relay",
      "name": "继电器",
      "description": "用于开关控制，支持on/off",
      "control_type": "boolean"
    },
    {
      "id": 4,
      "type": "laser",
      "name": "激光器",
      "description": "用于激光控制，支持开关控制",
      "control_type": "boolean"
    },
    {
      "id": 5,
      "type": "rgb_led",
      "name": "RGB-LED",
      "description": "用于RGB颜色控制，支持颜色选择和亮度调节",
      "control_type": "integer",
      "control_range": {"min": 0, "max": 100, "step": 1, "default": 0}
    },
    {
      "id": 6,
      "type": "buzzer",
      "name": "蜂鸣器",
      "description": "用于声音提示，支持多种蜂鸣模式",
      "control_type": "boolean"
    }
  ],
  "total": 15
}
```

#### 全部执行器类型列表

| 类型 | 名称 | 控制类型 | 控制范围 | 说明 |
|------|------|----------|----------|------|
| water_pump | 水泵 | boolean | - | 仅支持开关控制（on/off） |
| fan | 风扇 | integer | 0-100, step:10 | 支持速度调节 |
| heater | 加热器 | integer | 0-100, step:5 | 支持温度调节 |
| valve | 电磁阀 | boolean | - | 仅支持开关控制（on/off） |
| light | 补光灯 | integer | 0-100, step:10 | 支持亮度调节 |
| ventilator | 通风机 | boolean | - | 仅支持开关控制（on/off） |
| fogger | 雾化器 | boolean | - | 仅支持开关控制（on/off） |
| motor | 电机 | integer | 0-100, step:5 | 支持速度调节 |
| servo | 舵机 | angle | 0-180, step:1 | 支持角度控制 |
| led | LED灯 | boolean | - | 仅支持开关控制（on/off） |
| relay | 继电器 | boolean | - | 仅支持开关控制（on/off） |
| laser | 激光器 | boolean | - | 仅支持开关控制（on/off） |
| buzzer | 蜂鸣器 | boolean | - | 支持开关控制，可设置蜂鸣模式 |
| rgb_led | RGB-LED | integer | 0-100 | 支持颜色选择和亮度调节 |
| camera | 摄像头 | string | - | 云台摄像头，支持角度控制、颜色追踪、视频流 |

#### 蜂鸣模式说明

| 模式 | 说明 |
|------|------|
| alarm | 连续长响 |
| success | 短响3次 |
| warning | 长短交替 |
| click | 单次短响 |

#### RGB-LED颜色值映射规则

| control_value | 颜色/功能 | RGB值 |
|---------------|-----------|-------|
| 0 | 关闭 | (0, 0, 0) |
| 1 | 红色 | (255, 0, 0) |
| 2 | 绿色 | (0, 255, 0) |
| 3 | 蓝色 | (0, 0, 255) |
| 4 | 黄色 | (255, 255, 0) |
| 5 | 青色 | (0, 255, 255) |
| 6 | 品红色 | (255, 0, 255) |
| 7 | 白色 | (255, 255, 255) |
| 8 | 橙色 | (255, 128, 0) |
| 9 | 紫色 | (128, 0, 255) |
| 10-100 | 白色亮度 | 按百分比亮度（10=10%, 50=50%, 100=100%） |

---

### 2.6 新增执行器类型

**接口地址**: `POST /api/actuator-types`

**功能说明**: 添加新的执行器类型。

**请求体**:
```json
{
  "type": "servo",
  "name": "舵机",
  "description": "用于角度控制"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 5,
    "type": "servo",
    "name": "舵机",
    "description": "用于角度控制"
  },
  "message": "执行器类型创建成功"
}
```

---

### 2.7 删除执行器类型

**接口地址**: `DELETE /api/actuator-types/[id]`

**功能说明**: 删除指定执行器类型。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | 是 | 执行器类型ID |

**响应示例**:
```json
{
  "success": true,
  "message": "执行器类型删除成功"
}
```

---

### 2.8 执行器控制

**接口地址**: `POST /api/actuators/[id]/commands`

**功能说明**: 发送控制指令到指定执行器。支持普通控制和RGB-LED扩展控制。所有控制命令必须包含 `control_type` 字段。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 执行器ID |

**请求字段**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| control_type | string | 是 | 控制类型：boolean / integer / angle / float / string / **rgb** |
| command | string | 是 | 控制命令：on / off / **value** / **color** / **preset** |
| value | number | 否 | 控制值（command=value时使用） |
| r | number | 否 | 红色通道（command=color时使用，0-255） |
| g | number | 否 | 绿色通道（command=color时使用，0-255） |
| b | number | 否 | 蓝色通道（command=color时使用，0-255） |
| preset | string | 否 | 预设颜色名称（command=preset时使用） |
| mode | string | 否 | 控制模式：auto / manual |

**⚠️ 重要提示**：
- 所有控制命令**必须包含 `control_type` 字段**
- RGB-LED控制命令**必须使用 `control_type: "rgb"`**
- 如果缺少 `control_type` 字段，命令将被默认识别为 `boolean` 类型

**请求示例（布尔值控制 - 继电器/水泵/风扇等）**:
```json
{
  "control_type": "boolean",
  "command": "on"
}
```

**请求示例（数值控制 - 风扇速度/电机速度等）**:
```json
{
  "control_type": "integer",
  "command": "value",
  "value": 75
}
```

**请求示例（RGB-LED预设颜色 - 选择1-9号颜色）**:
```json
{
  "control_type": "rgb",
  "command": "value",
  "value": 1
}
```

**请求示例（RGB-LED白色亮度 - 10-100亮度）**:
```json
{
  "control_type": "rgb",
  "command": "value",
  "value": 50
}
```

**请求示例（RGB-LED自定义颜色 - RGB三通道）**:
```json
{
  "control_type": "rgb",
  "command": "color",
  "r": 255,
  "g": 128,
  "b": 0
}
```

**请求示例（RGB-LED颜色名称 - 快捷指令）**:
```json
{
  "control_type": "rgb",
  "command": "preset",
  "preset": "orange"
}
```

**RGB预设颜色对照表**:

| value | 名称 | RGB | 说明 |
|-------|------|-----|------|
| 0 | off | (0,0,0) | 关闭 |
| 1 | red | (255,0,0) | 红色 |
| 2 | green | (0,255,0) | 绿色 |
| 3 | blue | (0,0,255) | 蓝色 |
| 4 | yellow | (255,255,0) | 黄色 |
| 5 | cyan | (0,255,255) | 青色 |
| 6 | magenta | (255,0,255) | 品红 |
| 7 | white | (255,255,255) | 白色 |
| 8 | orange | (255,127,0) | 橙色 |
| 9 | purple | (127,0,255) | 紫色 |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 8392,
    "actuator_id": "MT-1-1001",
    "command": "value",
    "control_value": 75,
    "status": "pending",
    "created_at": "2026-07-30 18:30:00"
  },
  "message": "指令已发送，等待硬件执行"
}
```

---

### 2.9 获取执行器命令历史/状态

**接口地址**: `GET /api/actuators/[id]/commands`

**功能说明**: 获取执行器的控制命令历史记录。支持前端快速查询模式和硬件端查询模式。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 执行器ID |

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| frontend | boolean | 否 | 前端查询模式（不传则为硬件端模式） |
| limit | number | 否 | 返回条数（仅硬件端模式），默认5 |
| status | string | 否 | 按状态过滤 |

**前端查询模式** (`?frontend=true`):
- **用途**：前端轮询检查命令执行状态
- **特点**：不执行超时清理，快速响应
- **返回**：只返回最新一条指令
- **响应时间**：~60ms
- **命令ID验证**：前端保存上次发送的命令ID，轮询时验证命令ID是否匹配，避免状态混淆

**硬件端查询模式**（不传frontend参数）:
- **用途**：硬件端轮询获取待执行指令
- **特点**：执行超时清理逻辑（清理pending/executing状态超时命令），解锁超时执行器
- **返回**：最近5条指令
- **响应时间**：~140ms

**⚠️ 重要提示**：
- 硬件端查询时**不要**传递 `frontend=true` 参数，否则会进入前端快速查询模式
- 前端查询时**必须**传递 `frontend=true` 参数，否则会执行不必要的超时清理操作

**响应示例（前端查询）**:
```json
{
  "success": true,
  "data": {
    "id": 8392,
    "actuator_id": "MT-1-1001",
    "command": "value",
    "control_value": 75,
    "status": "executed",
    "created_at": "2026-07-30 18:30:00",
    "executed_at": "2026-07-30 18:30:05"
  },
  "message": "OK"
}
```

**响应示例（硬件端查询）**:
```json
{
  "success": true,
  "data": [
    {
      "id": 8392,
      "actuator_id": "MT-1-1001",
      "command": "value",
      "control_value": 75,
      "status": "executed",
      "created_at": "2026-07-30 18:30:00",
      "executed_at": "2026-07-30 18:30:05"
    }
  ],
  "message": "OK"
}
```

**命令ID跟踪机制说明**：

为避免多命令并发时状态混淆，前端实现命令ID跟踪机制：

1. **发送命令时保存命令ID**：服务器返回命令ID后，前端保存到 `pendingCommandIds` 状态
   - 格式：`{[actuatorId]: commandId}`
   
2. **轮询检查时验证命令ID**：前端轮询获取最新命令后，检查命令ID是否与保存的ID匹配
   - 如果不匹配，跳过该状态更新（可能是其他命令的回执）
   - 伪代码：`if (cmdData.id !== commandId) return;`

3. **状态完成后清理命令ID**：命令执行成功/失败/超时后，清除对应的pendingCommandId

---

## 三、设备上报与控制API（硬件对接）

### 3.1 设备数据上报

**接口地址**: `POST /api/device/report`

**功能说明**: 硬件端上报传感器数据和执行器状态。支持feedback字段上报设备特有回馈数据。

**请求体**:
```json
{
  "gateway_ip": "192.168.1.100",
  "gateway_type": "wifi_sensor",
  "mac": "AA:BB:CC:DD:EE:FF",
  "farm_id": 1,
  "area": "温室1号区域",
  "nodes": [
    {
      "node_id": "T-1-001",
      "name": "空气温度传感器",
      "type": "temperature",
      "value": 25.5,
      "unit": "℃",
      "location": "温室中部"
    },
    {
      "node_id": "FN-1-001",
      "name": "风扇",
      "type": "fan",
      "state": "on",
      "mode": "manual",
      "control_value": 60,
      "control_type": "integer",
      "control_range": {
        "min": 0,
        "max": 100,
        "step": 1,
        "default": 0
      },
      "feedback": {
        "state": "on",
        "direction": "forward",
        "speed": 0.6,
        "pins": {"pwm": "PA0"},
        "initialized": true
      },
      "location": "温室顶部"
    },
    {
      "node_id": "LT-1-002",
      "name": "RGB-LED",
      "type": "light",
      "state": "on",
      "mode": "manual",
      "control_value": 50,
      "control_type": "rgb",
      "control_range": {
        "min": 0,
        "max": 100,
        "step": 1,
        "default": 0
      },
      "feedback": {
        "state": "on",
        "color": {"r": 255, "g": 128, "b": 0},
        "brightness": 60,
        "R": 255,
        "G": 128,
        "B": 0
      },
      "location": "温室中部"
    },
    {
      "node_id": "BZ-1-001",
      "name": "蜂鸣器",
      "type": "buzzer",
      "state": "on",
      "mode": "manual",
      "control_value": 3,
      "control_type": "boolean",
      "control_range": {
        "min": 0,
        "max": 100,
        "step": 1,
        "default": 0
      },
      "feedback": {
        "state": "on",
        "control_value": 3,
        "pattern": "alarm",
        "command_count": 15,
        "pin": 12
      },
      "location": "控制室"
    }
  ]
}
```

**请求字段说明**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| gateway_ip | string | 是 | 网关IP地址 |
| gateway_type | string | 否 | 网关类型，默认wifi_sensor |
| mac | string | 否 | 网关MAC地址 |
| farm_id | number | 是 | 农场ID |
| area | string | 否 | 区域名称 |
| nodes | array | 是 | 设备节点数组 |

**nodes数组元素字段说明**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| node_id | string | 是 | 设备节点唯一标识 |
| name | string | 否 | 设备名称 |
| type | string | 是 | 设备类型（temperature/humidity/motor/servo/light/fan/buzzer等） |
| value | number | 传感器必填 | 传感器数值 |
| unit | string | 否 | 单位 |
| location | string | 否 | 安装位置 |
| area | string | 否 | 区域名称（可覆盖网关级区域） |
| state | string | 执行器必填 | 执行器状态（on/off） |
| mode | string | 否 | 执行器模式（auto/manual） |
| control_value | number | 否 | 执行器当前控制值 |
| control_type | string | 否 | 执行器控制类型 |
| control_range | object | 否 | 执行器控制参数范围 |
| **feedback** | **object** | **否** | **设备特有回馈数据** |

**feedback字段详细说明**：

feedback是执行器特有回馈数据，用于存储设备的详细状态信息。不同执行器类型的feedback结构不同：

| 通用字段 | 类型 | 说明 | 适用设备 |
|---------|------|------|----------|
| state | string | 当前状态: on/off/error | 所有执行器 |
| control_value | number | 控制值 | 所有执行器 |
| direction | string | 旋转方向: forward/backward/stop | 电机、风扇 |
| speed | number | 当前速度 0.0-1.0 | 电机、风扇 |
| color | object | RGB颜色 {r,g,b} | RGB-LED |
| brightness | number | 亮度值 0-100 | RGB-LED、LED |
| pattern | string | 蜂鸣模式: alarm/success/warning/click | 蜂鸣器 |
| command_count | number | 命令计数 | 蜂鸣器 |
| pin | number | GPIO引脚号 | 蜂鸣器 |
| pins | object | GPIO引脚配置 | 所有执行器 |
| initialized | boolean | 初始化状态 | 所有执行器 |

**Feedback保留机制**：
- 设备上报时如果**不包含**feedback字段，服务器会**保留原值**（使用COALESCE函数）
- 避免设备周期性上报时意外覆盖已存储的feedback数据
- 仅当设备**主动上报**feedback时才会更新

**响应示例**:
```json
{
  "success": true,
  "message": "数据上报成功，共处理4个设备节点",
  "gateway_id": 1,
  "area": "温室1号区域",
  "gateway_ip": "192.168.1.100",
  "processed_nodes": [
    {
      "node_id": "T-1-001",
      "type": "temperature",
      "success": true,
      "device_id": "T-1-001",
      "category": "sensor"
    },
    {
      "node_id": "FN-1-001",
      "type": "fan",
      "success": true,
      "device_id": "FN-1-001",
      "category": "actuator"
    },
    {
      "node_id": "LT-1-002",
      "type": "light",
      "success": true,
      "device_id": "LT-1-002",
      "category": "actuator"
    },
    {
      "node_id": "BZ-1-001",
      "type": "buzzer",
      "success": true,
      "device_id": "BZ-1-001",
      "category": "actuator"
    }
  ],
  "total_nodes": 4,
  "success_count": 4,
  "failed_count": 0,
  "timestamp": "2026-07-30 18:30:00"
}
```

---

### 3.2 硬件控制回执

**接口地址**: `PATCH /api/actuators/[id]/commands`

**功能说明**: 硬件端确认控制指令执行结果（HTTP方式回执）。支持幂等操作，重复回执不会报错。

**幂等处理说明**:
- 如果命令已是目标状态，直接返回成功
- 处理WebSocket和HTTP双通道回执的竞态条件
- 响应时间：~11ms（优化后）

**双通道回执机制**：
- 硬件端应同时通过WebSocket和HTTP两种方式发送回执
- WebSocket通道延迟低（<50ms），作为主通道
- HTTP PATCH通道作为备份，确保回执可靠接收
- 两个通道的回执到达顺序不确定，幂等处理确保不会出错

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 执行器ID |

**请求字段**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| command_id | number | 是 | 命令ID（从查询指令接口获取） |
| status | string | 是 | 执行状态：executed / failed |
| control_value | number | 数值控制必填 | 实际执行的控制值 |
| state | string | 否 | 执行器状态：on / off |
| color | object | RGB设备必填 | 颜色信息 {r, g, b} |
| brightness | number | RGB设备可选 | 亮度值 0-100 |

**请求示例（普通执行器 - 继电器/水泵等）**:
```json
{
  "command_id": 8392,
  "status": "executed",
  "control_value": 75,
  "state": "on"
}
```

**请求示例（RGB-LED）**:
```json
{
  "command_id": 8395,
  "status": "executed",
  "state": "on",
  "color": {"r": 255, "g": 128, "b": 0},
  "brightness": 60
}
```

**响应示例（首次回执）**:
```json
{
  "success": true,
  "message": "OK",
  "command_id": 8392,
  "actuator_id": "MT-1-1001",
  "status": "executed",
  "timestamp": "2026-07-30 18:30:05"
}
```

**响应示例（重复回执 - 幂等）**:
```json
{
  "success": true,
  "message": "命令已是目标状态，跳过更新（幂等）",
  "command_id": 8392,
  "status": "executed"
}
```

---

### 3.3 获取待执行指令

**接口地址**: `GET /api/actuators/[id]/commands`

**功能说明**: 硬件端轮询获取待执行的控制指令。服务器返回待执行指令后自动将状态标记为`executing`。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 执行器ID |

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| frontend | boolean | 否 | 前端查询时设为true，返回最新指令状态；**硬件端不传递此参数** |

**⚠️ 重要提示**：
- 硬件端查询时**不要**传递 `frontend=true` 参数
- 如果传递了 `frontend=true`，将进入前端快速查询模式，不会将指令状态更新为 `executing`

**响应示例（有待执行指令 - 硬件端查询）**:
```json
{
  "success": true,
  "data": {
    "id": 8392,
    "actuator_id": "MT-1-1001",
    "command": "value",
    "control_value": 75,
    "status": "executing",
    "created_at": "2026-07-30 18:30:00"
  },
  "message": "OK"
}
```

**响应示例（有指令 - 前端查询）**:
```json
{
  "success": true,
  "data": {
    "id": 8392,
    "actuator_id": "MT-1-1001",
    "command": "value",
    "control_value": 75,
    "status": "executed",
    "created_at": "2026-07-30 18:30:00",
    "executed_at": "2026-07-30 18:30:05"
  },
  "message": "OK"
}
```

**响应示例（无待执行指令）**:
```json
{
  "success": true,
  "data": null,
  "message": "没有待执行的指令"
}
```

---

## 四、网关与设备节点API

### 4.1 获取网关列表

**接口地址**: `GET /api/gateways`

**功能说明**: 获取所有网关设备列表。

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| farm_id | number | 否 | 按农场ID过滤 |
| status | string | 否 | 按状态过滤 |

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "farm_id": 1,
      "name": "温室1号网关",
      "gateway_type": "wifi_sensor",
      "ip_address": "192.168.1.100",
      "mac_address": "AA:BB:CC:DD:EE:FF",
      "area": "温室1号区域",
      "status": "online",
      "last_heartbeat": "2026-07-30 18:30:00",
      "created_at": "2026-07-20 08:00:00"
    }
  ],
  "total": 3
}
```

---

### 4.2 获取单个网关详情

**接口地址**: `GET /api/gateways/[id]`

**功能说明**: 获取指定网关的详细信息。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | 是 | 网关ID |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "温室1号网关",
    "gateway_type": "wifi_sensor",
    "ip_address": "192.168.1.100",
    "status": "online"
  }
}
```

---

### 4.3 删除网关

**接口地址**: `DELETE /api/gateways/[id]`

**功能说明**: 删除指定网关及其关联设备。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | 是 | 网关ID |

**响应示例**:
```json
{
  "success": true,
  "message": "网关删除成功"
}
```

---

### 4.4 获取设备节点列表

**接口地址**: `GET /api/device-nodes`

**功能说明**: 获取所有设备节点列表。

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| gateway_id | number | 否 | 按网关ID过滤 |
| node_type | string | 否 | 按节点类型过滤：sensor / actuator |

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "gateway_id": 1,
      "node_id": "T-1-001",
      "name": "空气温度传感器",
      "node_type": "sensor",
      "sensor_type": "temperature",
      "location": "温室中部",
      "area": "温室1号区域",
      "status": "online",
      "last_update": "2026-07-30 18:30:00"
    }
  ],
  "total": 20
}
```

---

## 五、报警相关API

### 5.1 获取报警规则列表

**接口地址**: `GET /api/alarms/rules`

**功能说明**: 获取所有报警规则。

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "高温报警",
      "sensor_type": "temperature",
      "condition_type": "above",
      "min_value": null,
      "max_value": 35,
      "severity": "warning",
      "enabled": 1,
      "created_at": "2026-07-20 08:00:00"
    }
  ],
  "total": 5
}
```

---

### 5.2 新增报警规则

**接口地址**: `POST /api/alarms/rules`

**功能说明**: 添加新的报警规则。

**请求体**:
```json
{
  "name": "低温报警",
  "sensor_type": "temperature",
  "condition_type": "below",
  "min_value": 10,
  "severity": "critical",
  "enabled": 1
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "低温报警",
    "sensor_type": "temperature",
    "condition_type": "below"
  },
  "message": "报警规则创建成功"
}
```

---

### 5.3 删除报警规则

**接口地址**: `DELETE /api/alarms/rules/[id]`

**功能说明**: 删除指定报警规则。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | 是 | 报警规则ID |

**响应示例**:
```json
{
  "success": true,
  "message": "报警规则删除成功"
}
```

---

### 5.4 获取报警记录

**接口地址**: `GET /api/alarms/records`

**功能说明**: 获取报警记录列表。

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| limit | number | 否 | 返回条数，默认50 |
| status | string | 否 | 按状态过滤：active / acknowledged / resolved |
| severity | string | 否 | 按严重程度过滤：info / warning / critical |

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "rule_id": 1,
      "sensor_id": "T-1-001",
      "sensor_type": "temperature",
      "alarm_type": "threshold",
      "severity": "warning",
      "message": "温度超过阈值：35.5°C",
      "value": 35.5,
      "status": "active",
      "created_at": "2026-07-30 18:30:00"
    }
  ],
  "total": 100
}
```

---

## 六、策略相关API

### 6.1 获取策略列表

**接口地址**: `GET /api/strategies`

**功能说明**: 获取所有自动化策略。

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "strat-001",
      "name": "高温自动通风",
      "actuator_id": "FN-001",
      "enabled": 1,
      "trigger_condition": "temperature > 30",
      "action": "on",
      "created_at": "2026-07-20 08:00:00"
    }
  ],
  "total": 3
}
```

---

### 6.2 新增策略

**接口地址**: `POST /api/strategies`

**功能说明**: 创建新的自动化策略。

**请求体**:
```json
{
  "name": "湿度自动喷雾",
  "actuator_id": "FG-001",
  "enabled": 1,
  "trigger_condition": "humidity < 50",
  "time_range": "08:00-18:00",
  "action": "on",
  "stop_condition": "humidity >= 70",
  "safety_config": "{\"maxRuntime\": 1800}"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "strat-002",
    "name": "湿度自动喷雾",
    "actuator_id": "FG-001",
    "enabled": 1
  },
  "message": "策略创建成功"
}
```

---

### 6.3 更新策略

**接口地址**: `PUT /api/strategies/[id]`

**功能说明**: 更新指定策略信息。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 策略ID |

**请求体**: 同新增策略，字段可选。

**响应示例**:
```json
{
  "success": true,
  "message": "策略更新成功"
}
```

---

### 6.4 删除策略

**接口地址**: `DELETE /api/strategies/[id]`

**功能说明**: 删除指定策略。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 策略ID |

**响应示例**:
```json
{
  "success": true,
  "message": "策略删除成功"
}
```

---

### 6.5 获取策略执行日志

**接口地址**: `GET /api/strategies/execution-logs`

**功能说明**: 获取策略执行历史记录。

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| strategy_id | string | 否 | 按策略ID过滤 |
| limit | number | 否 | 返回条数，默认50 |

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "strategy_id": "strat-001",
      "actuator_id": "FN-001",
      "action": "on",
      "status": "success",
      "execution_time": "2026-07-30 18:30:00"
    }
  ],
  "total": 200
}
```

---

## 七、农场与区域API

### 7.1 获取农场列表

**接口地址**: `GET /api/farms`

**功能说明**: 获取所有农场列表。

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "智慧农业示范基地",
      "code": "FARM-001",
      "address": "北京市海淀区",
      "area": 10000,
      "farm_type": "greenhouse",
      "status": "active",
      "created_at": "2026-07-01 00:00:00"
    }
  ],
  "total": 1
}
```

---

### 7.2 获取单个农场详情

**接口地址**: `GET /api/farms/[id]`

**功能说明**: 获取指定农场的详细信息。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | 是 | 农场ID |

---

### 7.3 获取农场区域列表

**接口地址**: `GET /api/farms/[id]/zones`

**功能说明**: 获取指定农场的所有区域。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | 是 | 农场ID |

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "farm_id": 1,
      "name": "A区温室",
      "code": "ZONE-A",
      "zone_type": "greenhouse",
      "area": 5000,
      "status": "active"
    }
  ],
  "total": 5
}
```

---

### 7.4 获取单个区域详情

**接口地址**: `GET /api/zones/[id]`

**功能说明**: 获取指定区域的详细信息。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | 是 | 区域ID |

---

## 八、AI相关API

### 8.1 AI对话

**接口地址**: `POST /api/ai/chat`

**功能说明**: 与农业AI助手对话。

**请求体**:
```json
{
  "message": "今天番茄叶子发黄是什么原因？",
  "context": {
    "sensor_data": "...",
    "image_results": "..."
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "reply": "根据您描述的情况，番茄叶子发黄可能有以下几种原因...",
    "sources": []
  }
}
```

---

### 8.2 AI诊断

**接口地址**: `POST /api/ai/diagnosis`

**功能说明**: AI病虫害诊断。

**请求体**:
```json
{
  "crop_type": "tomato",
  "symptoms": ["叶子发黄", "有斑点"],
  "sensor_data": {
    "temperature": 28,
    "humidity": 85
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "diagnosis": "可能是早疫病",
    "confidence": 0.85,
    "causes": [],
    "solutions": []
  }
}
```

---

### 8.3 图像识别

**接口地址**: `POST /api/ai/image-recognition`

**功能说明**: 上传图片进行AI识别。

**请求体**: multipart/form-data

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| image | file | 是 | 图片文件 |
| crop_type | string | 否 | 作物类型 |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "image_url": "/api/ai/image-recognition/images/xxx.jpg",
    "results": [
      {
        "class": "tomato_early_blight",
        "confidence": 0.92,
        "bbox": [100, 100, 300, 300]
      }
    ],
    "created_at": "2026-07-30 18:30:00"
  }
}
```

---

### 8.4 获取AI模型列表

**接口地址**: `GET /api/ai/models`

**功能说明**: 获取可用的AI模型列表。

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "yolov8-agri",
      "name": "YOLOv8农业检测模型",
      "type": "image_detection",
      "status": "ready"
    }
  ],
  "total": 3
}
```

---

## 九、知识库相关API

### 9.1 获取知识库列表

**接口地址**: `GET /api/knowledge`

**功能说明**: 获取所有知识库条目。

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| category | string | 否 | 按分类过滤 |
| status | string | 否 | 按状态过滤 |
| limit | number | 否 | 返回条数，默认50 |

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "番茄种植技术指南",
      "content": "番茄种植需要注意以下几点...",
      "category": "种植技术",
      "tags": ["番茄", "种植"],
      "status": "published",
      "created_at": "2026-07-01 00:00:00"
    }
  ],
  "total": 50
}
```

---

### 9.2 搜索知识库

**接口地址**: `GET /api/knowledge/search`

**功能说明**: 语义搜索知识库。

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| q | string | 是 | 搜索关键词 |
| limit | number | 否 | 返回条数，默认10 |

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "番茄种植技术指南",
      "content": "番茄种植需要注意以下几点...",
      "similarity": 0.89,
      "category": "种植技术"
    }
  ],
  "total": 5
}
```

---

### 9.3 新增知识库条目

**接口地址**: `POST /api/knowledge`

**功能说明**: 添加新的知识库条目。

**请求体**:
```json
{
  "title": "黄瓜栽培技术",
  "content": "黄瓜栽培需要注意...",
  "category": "种植技术",
  "tags": ["黄瓜", "栽培"],
  "status": "draft"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 2,
    "title": "黄瓜栽培技术"
  },
  "message": "知识库条目创建成功"
}
```

---

### 9.4 删除知识库条目

**接口地址**: `DELETE /api/knowledge/[id]`

**功能说明**: 删除指定知识库条目。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | 是 | 条目ID |

**响应示例**:
```json
{
  "success": true,
  "message": "知识库条目删除成功"
}
```

---

### 9.5 智能添加知识库

**接口地址**: `POST /api/knowledge/smart-add`

**功能说明**: AI自动生成并添加知识库内容。

**请求体**:
```json
{
  "topic": "草莓种植",
  "category": "种植技术"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 3,
    "title": "草莓种植技术大全"
  },
  "message": "智能添加成功"
}
```

---

### 9.6 导入知识库

**接口地址**: `POST /api/knowledge/import`

**功能说明**: 批量导入知识库条目。

**请求体**: multipart/form-data

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | file | 是 | JSON/CSV文件 |

**响应示例**:
```json
{
  "success": true,
  "imported": 50,
  "failed": 2,
  "message": "导入完成"
}
```

---

### 9.7 导出知识库

**接口地址**: `GET /api/knowledge/export`

**功能说明**: 导出知识库数据。

**响应**: 文件下载（JSON格式）

---

## 十、提示词模板API

### 10.1 获取提示词模板列表

**接口地址**: `GET /api/prompts`

**功能说明**: 获取所有提示词模板。

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "农业AI助手-通用",
      "type": "chat",
      "description": "通用农业AI助手提示词模板",
      "status": "active",
      "version": 1,
      "created_at": "2026-07-01 00:00:00"
    }
  ],
  "total": 5
}
```

---

### 10.2 渲染提示词

**接口地址**: `POST /api/prompts/render`

**功能说明**: 使用变量渲染提示词模板。

**请求体**:
```json
{
  "template_id": 1,
  "variables": {
    "knowledge_context": "...",
    "user_query": "..."
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "prompt": "你是一个专业的智慧农业AI助手..."
  }
}
```

---

## 十一、WebSocket API

### 11.1 连接地址

```
ws://localhost:8080?actuator_id={执行器ID}
```

**参数说明**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| actuator_id | string | 执行器连接时必填 | 执行器唯一标识（如：VL-1-001） |
| device_id | string | 设备连接时必填 | 设备唯一标识 |
| gateway_ip | string | 网关连接时必填 | 网关IP地址 |
| area | string | 区域订阅时必填 | 区域名称 |

### 11.2 消息类型

| 类型 | 方向 | 说明 |
|------|------|------|
| heartbeat | 客户端→服务器 | 心跳检测（每30秒） |
| heartbeat_ack | 服务器→客户端 | 心跳回执 |
| welcome | 服务器→客户端 | 连接成功欢迎消息 |
| sensor_data | 服务器→客户端 | 传感器数据更新 |
| actuator_status | 服务器→客户端 | 执行器状态更新 |
| command | 服务器→客户端 | 控制指令推送（实时） |
| command_ack | 客户端→服务器 | 命令回执（硬件端执行完成后发送） |
| command_status | 服务器→客户端 | 命令状态更新（通知前端） |
| area_update | 服务器→客户端 | 区域数据更新 |
| area_sync | 客户端→服务器 | 订阅区域数据 |
| device_register | 客户端→服务器 | 设备注册 |
| gateway_register | 客户端→服务器 | 网关注册 |
| data_report | 客户端→服务器 | 数据上报 |
| status_update | 客户端→服务器 | 状态更新 |
| error | 服务器→客户端 | 错误信息 |

### 11.3 连接流程

#### 1. 执行器连接
```
硬件端 → WebSocket握手 → 服务器
       ←-- welcome消息 --
       → heartbeat（每30秒）
       ←-- heartbeat_ack --
```

#### 2. 普通命令推送（布尔值控制）
```
服务器 → {"type":"command","data":{"id":8392,"actuator_id":"VL-1-001","command":"on","control_value":null,"control_type":"boolean"}} → 硬件端
硬件端 → {"type":"command_ack","data":{"command_id":8392,"actuator_id":"VL-1-001","status":"executed","state":"on"}} → 服务器
```

#### 3. 数值命令推送（风扇/电机）
```
服务器 → {"type":"command","data":{"id":8393,"actuator_id":"FN-1-001","command":"value","control_value":75,"control_type":"integer"}} → 硬件端
硬件端 → {"type":"command_ack","data":{"command_id":8393,"actuator_id":"FN-1-001","status":"executed","control_value":75,"state":"on"}} → 服务器
```

#### 4. RGB命令推送（预设颜色）
```
服务器 → {"type":"command","data":{"id":8395,"actuator_id":"LT-1-002","command":"value","control_value":1,"control_type":"rgb"}} → 硬件端
硬件端 → {"type":"command_ack","data":{"command_id":8395,"actuator_id":"LT-1-002","status":"executed","state":"on","color":{"r":255,"g":0,"b":0},"brightness":100,"control_value":1}} → 服务器
```

#### 5. RGB命令推送（自定义颜色）
```
服务器 → {"type":"command","data":{"id":8396,"actuator_id":"LT-1-002","command":"color","control_value":null,"control_type":"rgb","command_data":{"r":255,"g":128,"b":0}}} → 硬件端
硬件端 → {"type":"command_ack","data":{"command_id":8396,"actuator_id":"LT-1-002","status":"executed","state":"on","color":{"r":255,"g":128,"b":0},"brightness":60,"control_value":50}} → 服务器
```

### 11.4 消息格式详解

#### heartbeat（心跳）
**客户端发送**:
```json
{
  "type": "heartbeat"
}
```

**服务器响应**:
```json
{
  "type": "heartbeat_ack"
}
```

#### command（命令推送 - 服务器→硬件端）
**服务器发送**:
```json
{
  "type": "command",
  "data": {
    "id": 8392,
    "actuator_id": "VL-1-001",
    "command": "on",
    "control_value": null,
    "control_type": "boolean",
    "command_data": null,
    "created_at": "2026-07-30 18:30:00"
  }
}
```

**RGB命令推送示例**:
```json
{
  "type": "command",
  "data": {
    "id": 8395,
    "actuator_id": "LT-1-002",
    "command": "value",
    "control_value": 1,
    "control_type": "rgb",
    "command_data": null,
    "created_at": "2026-07-30 18:30:00"
  }
}
```

#### command_ack（命令回执 - 硬件端→服务器）
**普通执行器回执**:
```json
{
  "type": "command_ack",
  "data": {
    "command_id": 8392,
    "actuator_id": "VL-1-001",
    "status": "executed",
    "control_value": null,
    "state": "on"
  }
}
```

**RGB-LED回执**:
```json
{
  "type": "command_ack",
  "data": {
    "command_id": 8395,
    "actuator_id": "LT-1-002",
    "status": "executed",
    "control_value": 1,
    "state": "on",
    "color": {"r": 255, "g": 0, "b": 0},
    "brightness": 100
  }
}
```

| 状态值 | 说明 |
|--------|------|
| executed | 执行成功 |
| failed | 执行失败 |

---

## 十二、性能与延迟说明

### 控制指令延迟分析

| 阶段 | 延迟 | 说明 |
|------|------|------|
| 命令创建 | ~50ms | 服务器创建指令并存储到数据库 |
| 命令推送 | <50ms | WebSocket实时推送到硬件端（如果连接在线） |
| 硬件执行 | 视硬件而定 | 通常<100ms |
| 硬件回执 | <50ms | 硬件通过WebSocket或HTTP发送回执 |
| 服务器处理回执 | ~11ms | 服务器更新数据库状态，更新执行器feedback |
| 前端轮询检测 | ~60ms | 前端通过 `?frontend=true` 快速查询模式获取最新状态 |
| **乐观更新显示** | **~300ms** | 用户感知到的总延迟 |

### 查询模式对比

| 模式 | 参数 | 用途 | 响应时间 | 说明 |
|------|------|------|----------|------|
| 前端快速查询 | `?frontend=true` | 前端轮询 | ~60ms | 不执行超时清理，快速返回最新状态 |
| 硬件端查询 | 不传参数 | 硬件端轮询 | ~140ms | 执行超时清理逻辑，返回最近5条指令 |

### 优化措施

1. **分离查询模式**：前端查询跳过超时清理逻辑，大幅降低响应时间
2. **乐观更新机制**：检测到 `executed` 状态时立即更新本地UI，无需等待服务器数据同步
3. **命令ID跟踪**：精确验证命令ID，避免多命令并发时状态混淆
4. **双通道回执**：WebSocket + HTTP双通道同时发送回执，确保至少一个通道能及时到达
5. **300ms轮询间隔**：优化前端轮询间隔，在保证性能的同时快速响应状态变化

### 影响及时性的因素

- **WebSocket连接状态**：如果WebSocket断开，命令推送将使用HTTP转发，延迟会增加
- **硬件处理速度**：硬件端的执行速度直接影响回执时间
- **网络延迟**：服务器与硬件之间的网络延迟
- **数据库性能**：MySQL的查询和更新性能

---

## 十三、摄像头模块API

### 13.1 摄像头帧上传

**接口地址**: `POST /api/device/upload-image`

**功能说明**: 硬件端（树莓派）上传摄像头抓拍的图像帧，用于AI检测和历史记录。采用 multipart/form-data 格式上传。

**请求体**: multipart/form-data

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| node_id | string | 是 | 摄像头节点ID（如：CAM-1-001） |
| gateway_ip | string | 是 | 网关IP地址 |
| farm_id | number | 是 | 农场ID |
| area | string | 否 | 区域名称 |
| timestamp | string | 否 | 拍摄时间（北京时间，格式：YYYY-MM-DD HH:MM:SS） |
| detection | string | 否 | AI检测结果（JSON字符串） |
| image | file | 是 | 图像文件（JPG/PNG，建议<2MB） |

**请求示例（curl）**:
```bash
curl -X POST http://localhost:3000/api/device/upload-image \
  -F "node_id=CAM-1-001" \
  -F "gateway_ip=192.168.1.100" \
  -F "farm_id=1" \
  -F "area=温室1号区域" \
  -F "timestamp=2026-08-03 10:30:00" \
  -F "detection={\"found\":true,\"target\":\"red\",\"bbox\":[100,100,200,200]}" \
  -F "image=@frame.jpg"
```

**响应示例**:
```json
{
  "success": true,
  "message": "图像上传成功",
  "data": {
    "image_id": 123,
    "node_id": "CAM-1-001",
    "image_url": "/uploads/camera/CAM-1-001/20260803_103000.jpg",
    "detection": {
      "found": true,
      "target": "red",
      "bbox": [100, 100, 200, 200]
    },
    "timestamp": "2026-08-03 10:30:00"
  }
}
```

**说明**:
- 图像保存路径：`public/uploads/camera/{node_id}/{YYYYMMDD_HHMMSS}.jpg`
- 上传频率由硬件端 settings.yaml 的 `frame_upload.interval` 控制（默认5秒）
- detection 字段为可选的 JSON 字符串，包含颜色追踪结果
- 文件大小限制：单张图像 <10MB

---

### 13.2 摄像头节点上报

**接口地址**: `POST /api/device/report`

**功能说明**: 摄像头作为特殊传感器节点通过设备上报接口上报状态。type=camera，节点ID格式为 CAM-{gatewayId}-{nodeId}。

**请求示例**:
```json
{
  "gateway_ip": "192.168.1.100",
  "gateway_type": "wifi_sensor",
  "farm_id": 1,
  "area": "温室1号区域",
  "nodes": [
    {
      "node_id": "CAM-1-001",
      "name": "云台摄像头",
      "type": "camera",
      "state": "on",
      "mode": "manual",
      "control_type": "string",
      "feedback": {
        "power": "on",
        "found": true,
        "resolution": "640x480",
        "tracking_enabled": true,
        "is_running": true,
        "color_preset": "red",
        "available_colors": ["blue", "red", "green", "yellow", "orange"],
        "pan_angle": 90,
        "tilt_angle": 45,
        "stream_url": "http://192.168.1.100:8081/stream",
        "snapshot_url": "http://192.168.1.100:8081/snapshot",
        "target_x": 320,
        "target_y": 240,
        "target_area": 5000,
        "error_pan": 0.5,
        "error_tilt": -0.3
      },
      "location": "温室入口"
    }
  ]
}
```

**摄像头 feedback 字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| power | string | 电源状态：on/off |
| found | boolean | 是否检测到目标颜色 |
| resolution | string | 图像分辨率（如：640x480） |
| tracking_enabled | boolean | 是否启用颜色追踪 |
| is_running | boolean | 视频流服务是否运行 |
| color_preset | string | 当前颜色预设：blue/red/green/yellow/orange |
| available_colors | array | 支持的颜色列表 |
| pan_angle | number | 水平角度（0-180） |
| tilt_angle | number | 垂直角度（0-180） |
| stream_url | string | MJPEG 视频流地址（树莓派8081端口） |
| snapshot_url | string | 快照地址 |
| target_x | number | 目标中心X坐标 |
| target_y | number | 目标中心Y坐标 |
| target_area | number | 目标面积（像素） |
| error_pan | number | 水平误差（用于PID控制） |
| error_tilt | number | 垂直误差（用于PID控制） |

---

### 13.3 摄像头命令控制

**接口地址**: `POST /api/actuators/CAM-1-001/commands`

**功能说明**: 发送控制指令到摄像头（云台、追踪、颜色切换等）。摄像头作为执行器（type=camera, control_type=string）进行控制。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 摄像头执行器ID（如：CAM-1-001） |

**支持的命令**:

| 命令 | control_type | 说明 | 附加参数 |
|------|--------------|------|----------|
| on | string | 开启摄像头电源 | - |
| off | string | 关闭摄像头电源 | - |
| value | string | 设置云台角度 | pan/tilt（绝对角度）或 pan_delta/tilt_delta（相对角度） |
| track | string | 开关颜色追踪 | value: on/off |
| color | string | 切换颜色预设 | value: blue/red/green/yellow/orange |
| reset | string | 重置云台到默认位置 | - |

**请求示例（开启摄像头）**:
```json
{
  "control_type": "string",
  "command": "on"
}
```

**请求示例（绝对角度控制）**:
```json
{
  "control_type": "string",
  "command": "value",
  "pan": 90,
  "tilt": 45
}
```

**请求示例（相对角度控制）**:
```json
{
  "control_type": "string",
  "command": "value",
  "pan_delta": 10,
  "tilt_delta": -5
}
```

**请求示例（开启颜色追踪）**:
```json
{
  "control_type": "string",
  "command": "track",
  "value": "on"
}
```

**请求示例（切换颜色预设）**:
```json
{
  "control_type": "string",
  "command": "color",
  "value": "red"
}
```

**请求示例（重置云台）**:
```json
{
  "control_type": "string",
  "command": "reset"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 8500,
    "actuator_id": "CAM-1-001",
    "command": "color",
    "control_value": null,
    "status": "pending",
    "created_at": "2026-08-03 10:30:00"
  },
  "message": "指令已发送，等待硬件执行"
}
```

**摄像头命令扩展字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| pan | number | 水平绝对角度（0-180） |
| tilt | number | 垂直绝对角度（0-180） |
| pan_delta | number | 水平相对角度（-90~90） |
| tilt_delta | number | 垂直相对角度（-90~90） |
| color | string | 颜色预设名称 |
| camera_command | string | 摄像头子命令（track/color/reset等） |

---

### 13.4 摄像头命令回执

**接口地址**: `PATCH /api/actuators/CAM-1-001/commands`

**功能说明**: 硬件端确认摄像头命令执行结果。

**请求示例**:
```json
{
  "command_id": 8500,
  "status": "executed",
  "state": "on",
  "feedback": {
    "power": "on",
    "color_preset": "red",
    "pan_angle": 90,
    "tilt_angle": 45,
    "tracking_enabled": true
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "OK",
  "command_id": 8500,
  "actuator_id": "CAM-1-001",
  "status": "executed",
  "timestamp": "2026-08-03 10:30:05"
}
```

---

### 13.5 视频流接口（树莓派直连）

**重要说明**: 摄像头的视频流由树莓派本机直接提供，不经过服务端转发，浏览器直接连接树莓派的 8081 端口。

**基础URL**: `http://{树莓派IP}:8081`

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| MJPEG 视频流 | GET | /stream | 返回 multipart/x-mixed-replace MJPEG 流，可直接用于 `<img>` 标签 |
| 快照 | GET | /snapshot | 返回当前帧 JPEG 图像 |
| 状态查询 | GET | /status | 返回摄像头状态 JSON |

**视频流使用示例（HTML）**:
```html
<img src="http://192.168.1.100:8081/stream" alt="摄像头视频流" />
```

**状态查询响应示例**:
```json
{
  "is_running": true,
  "resolution": "640x480",
  "fps": 20,
  "tracking_enabled": true,
  "color_preset": "red",
  "found": true,
  "pan_angle": 90,
  "tilt_angle": 45
}
```

**说明**:
- 视频流地址从摄像头节点上报的 feedback.stream_url 字段获取
- 浏览器直连树莓派，不经过服务端，减轻服务器负载
- 若树莓派与浏览器不在同一网段，需保证 8081 端口可达
- 视频流服务由硬件端 services/video_stream_service.py 提供

---

## 十四、附录

### 数据库表结构关键字段

#### actuators 表（执行器设备）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(50) | 执行器ID（主键），格式：{PREFIX}-{gatewayId}-{nodeId} |
| control_type | VARCHAR(20) | 控制类型：boolean/integer/angle/float/string |
| feedback | JSON | 设备回馈数据（状态、方向、速度、颜色等） |
| locked | TINYINT | 锁定状态（0=未锁定，1=锁定） |

#### actuator_commands 表（控制指令）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 指令ID（主键，自增） |
| actuator_id | VARCHAR(50) | 执行器ID |
| command | VARCHAR(20) | 控制命令：on/off/value/color/preset |
| control_value | DECIMAL(10,2) | 控制值 |
| status | VARCHAR(20) | 指令状态：pending/executing/executed/failed/timeout |
| command_data | JSON | 扩展命令数据（RGB控制参数等） |

### 指令状态流转

```
pending → executing → executed
                    → failed
                    → timeout
```

| 状态 | 说明 |
|------|------|
| pending | 待执行（已创建，等待推送/执行） |
| executing | 执行中（已推送到硬件，等待回执） |
| executed | 已执行（收到硬件回执确认） |
| failed | 执行失败（硬件返回失败） |
| timeout | 超时（30秒未收到回执） |