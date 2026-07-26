# API 参考文档

## 概述

本文档描述智慧农业平台所有API接口的详细说明，包括请求格式、响应格式、参数说明和错误码。

**基础URL**: `http://localhost:3000/api`

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
      "description": "灌溉用水泵设备"
    },
    {
      "id": 2,
      "type": "fan",
      "name": "风扇",
      "description": "通风降温设备"
    }
  ],
  "total": 11
}
```

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
  "control_value": 75,
  "mode": "manual"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| command | string | 是 | 控制命令：on / off / value |
| control_value | number | 否 | 控制值（command=value时必填） |
| mode | string | 否 | 控制模式：auto / manual |

**响应示例**:
```json
{
  "success": true,
  "message": "指令已发送",
  "command_id": 123,
  "actuator_id": "MT-1-1001",
  "status": "pending",
  "timestamp": "2026-07-26T10:30:00.000Z"
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

**接口地址**: `POST /api/device/ack`

**功能说明**: 硬件端确认控制指令执行结果。

**请求体**:
```json
{
  "gateway_ip": "192.168.1.100",
  "actuator_id": "MT-1-1001",
  "command_id": 123,
  "status": "executed",
  "control_value": 75,
  "state": "on"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| gateway_ip | string | 否 | 网关IP地址 |
| actuator_id | string | 是 | 执行器ID |
| command_id | number | 是 | 命令ID |
| status | string | 是 | 执行状态：executed / failed |
| control_value | number | 否 | 实际控制值 |
| state | string | 否 | 执行器状态：on / off |

**响应示例**:
```json
{
  "success": true,
  "message": "OK",
  "command_id": 123,
  "actuator_id": "MT-1-1001",
  "status": "executed",
  "timestamp": "2026-07-26T10:30:05.000Z"
}
```

---

### 3.3 获取待执行指令

**接口地址**: `GET /api/device/ack`

**功能说明**: 硬件端轮询获取待执行的控制指令。

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| actuator_id | string | 否 | 执行器ID |
| gateway_ip | string | 否 | 网关IP地址 |

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
      "status": "pending",
      "created_at": "2026-07-26T10:30:00.000Z"
    }
  ],
  "total": 1
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
ws://localhost:8080
```

### 11.2 消息类型

| 类型 | 方向 | 说明 |
|------|------|------|
| heartbeat | 双向 | 心跳检测 |
| sensor_data | 服务器→客户端 | 传感器数据更新 |
| actuator_status | 服务器→客户端 | 执行器状态更新 |
| command | 服务器→客户端 | 控制指令推送 |
| command_ack | 客户端→服务器 | 命令回执（硬件端） |
| command_status | 服务器→客户端 | 命令状态更新 |
| area_update | 服务器→客户端 | 区域数据更新 |
| area_sync | 客户端→服务器 | 订阅区域数据 |

### 11.3 订阅区域示例

**客户端发送**:
```json
{
  "type": "area_sync",
  "data": {
    "area": "温室1号区域"
  }
}
```

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