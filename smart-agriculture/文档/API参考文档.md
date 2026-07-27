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
      "last_update": "2026-07-26T10:30:00.000Z",
      "created_at": "2026-07-20T08:00:00.000Z"
    }
  ],
  "total": 10
}
```

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
    "last_update": "2026-07-26T10:30:00.000Z"
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

**功能说明**: 获取传感器的历史数据记录。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 传感器ID |

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| limit | number | 否 | 返回数据条数，默认100 |
| start_time | string | 否 | 开始时间（ISO格式） |
| end_time | string | 否 | 结束时间（ISO格式） |

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "sensor_id": "T-1-001",
      "value": 25.5,
      "timestamp": "2026-07-26T10:30:00.000Z"
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

**功能说明**: 获取所有执行器设备列表，支持按类型过滤。

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 否 | 按执行器类型过滤（如：water_pump, fan） |
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
      "last_update": "2026-07-26T10:30:00.000Z",
      "created_at": "2026-07-20T08:00:00.000Z"
    }
  ],
  "total": 7
}
```

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
    "control_type": "integer"
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
    }
  ],
  "total": 14
}
```

#### 新增执行器类型说明

| 类型 | 名称 | 控制类型 | 说明 |
|------|------|----------|------|
| relay | 继电器 | boolean | 仅支持开关控制（on/off） |
| laser | 激光器 | boolean | 仅支持开关控制（on/off） |
| rgb_led | RGB-LED | integer | 支持0-100数值控制，映射为颜色值 |

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

**功能说明**: 发送控制指令到指定执行器。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 执行器ID |

**请求体**:
```json
{
  "command": "value",
  "control_type": "integer",
  "control_value": 75,
  "mode": "manual"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| command | string | 是 | 控制命令：on / off / value |
| control_type | string | 是 | 控制类型：boolean / integer / angle / float / string |
| control_value | number | 否 | 控制值（command=value时必填） |
| mode | string | 否 | 控制模式：auto / manual |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "actuator_id": "MT-1-1001",
    "command": "value",
    "control_value": 75,
    "control_type": "integer",
    "status": "pending",
    "sent_via_websocket": false,
    "timeout": 30
  },
  "message": "OK"
}
```

---

### 2.9 获取执行器命令历史

**接口地址**: `GET /api/actuators/[id]/commands`

**功能说明**: 获取执行器的控制命令历史记录。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 执行器ID |

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| limit | number | 否 | 返回条数，默认20 |
| status | string | 否 | 按状态过滤 |

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "actuator_id": "MT-1-1001",
      "command": "value",
      "control_value": 75,
      "status": "executed",
      "created_at": "2026-07-26T10:30:00.000Z",
      "executed_at": "2026-07-26T10:30:02.000Z"
    }
  ],
  "total": 50
}
```

---

## 三、设备上报与控制API（硬件对接）

### 3.1 设备数据上报

**接口地址**: `POST /api/device/report`

**功能说明**: 硬件端上报传感器数据和执行器状态。

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
      "node_id": "M-1-001",
      "name": "通风电机",
      "type": "motor",
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
      "location": "温室顶部"
    }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| gateway_ip | string | 是 | 网关IP地址 |
| gateway_type | string | 否 | 网关类型，默认wifi_sensor |
| mac | string | 否 | 网关MAC地址 |
| farm_id | number | 是 | 农场ID |
| area | string | 否 | 区域名称 |
| nodes | array | 是 | 设备节点数组 |

**响应示例**:
```json
{
  "success": true,
  "message": "数据上报成功，共处理2个设备节点",
  "gateway_id": 1,
  "area": "温室1号区域",
  "gateway_ip": "192.168.1.100",
  "processed_nodes": [
    {
      "node_id": "T-1-001",
      "type": "temperature",
      "success": true,
      "device_id": "T-1-1001",
      "category": "sensor"
    }
  ],
  "total_nodes": 2,
  "success_count": 2,
  "failed_count": 0,
  "timestamp": "2026-07-26T10:30:00.000Z"
}
```

---

### 3.2 硬件控制回执

**接口地址**: `PATCH /api/actuators/[id]/commands`

**功能说明**: 硬件端确认控制指令执行结果。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 执行器ID |

**请求体**:
```json
{
  "command_id": 123,
  "status": "executed",
  "control_value": 75
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| command_id | number | 是 | 命令ID（从查询指令接口获取） |
| status | string | 是 | 执行状态：executed / failed |
| control_value | number | 数值控制必填 | 实际执行的控制值 |

**响应示例**:
```json
{
  "success": true,
  "message": "OK"
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
| frontend | boolean | 否 | 前端查询时设为true，返回最新指令状态；硬件端不传递此参数 |

**响应示例（有待执行指令）**:
```json
{
  "success": true,
  "data": {
    "id": 123,
    "actuator_id": "MT-1-1001",
    "command": "value",
    "control_value": 75,
    "status": "executing",
    "created_at": "2026-07-26T10:30:00.000Z"
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
      "last_heartbeat": "2026-07-26T10:30:00.000Z",
      "created_at": "2026-07-20T08:00:00.000Z"
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
      "last_update": "2026-07-26T10:30:00.000Z"
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
      "created_at": "2026-07-20T08:00:00.000Z"
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
      "created_at": "2026-07-26T10:30:00.000Z"
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
      "created_at": "2026-07-20T08:00:00.000Z"
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
      "execution_time": "2026-07-26T10:30:00.000Z"
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
      "created_at": "2026-07-01T00:00:00.000Z"
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
    "causes": [...],
    "solutions": [...]
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
    "created_at": "2026-07-26T10:30:00.000Z"
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
      "created_at": "2026-07-01T00:00:00.000Z"
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
      "created_at": "2026-07-01T00:00:00.000Z"
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
| command_status | 服务器→客户端 | 命令状态更新 |
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

#### 2. 命令推送
```
服务器 → {"type":"command","data":{"id":8222,"actuator_id":"VL-1-001","command":"on","control_value":null}} → 硬件端
硬件端 → {"type":"command_ack","actuator_id":"VL-1-001","command_id":8222,"status":"executed"} → 服务器
```

#### 3. 数值命令推送
```
服务器 → {"type":"command","data":{"id":8223,"actuator_id":"LT-1-002","command":"value","control_value":5}} → 硬件端
硬件端 → {"type":"command_ack","actuator_id":"LT-1-002","command_id":8223,"status":"executed","control_value":5} → 服务器
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

#### command（命令推送）
**服务器发送**:
```json
{
  "type": "command",
  "data": {
    "id": 8222,
    "actuator_id": "VL-1-001",
    "command": "on",
    "control_value": null,
    "control_type": "boolean",
    "created_at": "2026-07-27T18:00:00.000Z"
  }
}
```

#### command_ack（命令回执）
**硬件端发送**:
```json
{
  "type": "command_ack",
  "actuator_id": "VL-1-001",
  "command_id": 8222,
  "status": "executed",
  "control_value": null
}
```

| 状态值 | 说明 |
|--------|------|
| executed | 执行成功 |
| failed | 执行失败 |

### 11.5 HTTP转发接口（端口8081）

WebSocket服务器提供HTTP转发接口，允许其他服务通过HTTP请求发送命令：

#### 发送命令
**接口地址**: `POST http://localhost:8081/send-command`

**请求体**:
```json
{
  "actuator_id": "VL-1-001",
  "command": {
    "id": 8222,
    "actuator_id": "VL-1-001",
    "command": "on",
    "control_value": null
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "sent": true
}
```

#### 获取连接状态
**接口地址**: `GET http://localhost:8081/status`

**响应示例**:
```json
{
  "success": true,
  "connections": {
    "devices": 0,
    "actuators": 3,
    "gateways": 0,
    "areas": 0
  }
}
```

### 11.6 订阅区域示例

**客户端发送**:
```json
{
  "type": "area_sync",
  "data": {
    "area": "温室1号区域"
  }
}
```

### 11.7 降级机制

当WebSocket连接断开时，系统自动切换到HTTP轮询模式：

1. **WebSocket在线**: 命令通过WebSocket实时推送（延迟<500ms）
2. **WebSocket断开**: 硬件端使用HTTP轮询获取待执行指令（默认每10秒）
3. **自动重连**: 硬件端实现指数退避重连策略，恢复WebSocket连接后自动切换回实时推送

### 11.8 超时机制

- 控制指令发送后，服务器等待30秒回执
- 超时未收到回执，标记为`timeout`并提醒用户
- 超时后执行器自动解锁，允许重新发送指令

---

## 十二、错误码说明

| 错误码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 404 | 资源不存在 |
| 405 | 方法不允许 |
| 500 | 服务器内部错误 |

### 错误响应格式

```json
{
  "success": false,
  "error": "错误描述",
  "details": "详细错误信息"
}
```

---

## 十三、注意事项

1. **数据格式**: 所有请求和响应均使用JSON格式
2. **编码格式**: 使用UTF-8编码
3. **时间格式**: 统一使用ISO 8601格式（如：2026-07-26T10:30:00.000Z）
4. **频率限制**: 建议API调用频率不超过60次/分钟
5. **硬件上报**: 建议设备上报间隔不小于10秒
6. **数据库**: 支持SQLite和MySQL两种数据库，通过`DATABASE_TYPE`环境变量切换