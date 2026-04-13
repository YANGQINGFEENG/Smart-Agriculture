# 智慧农业物联网监控平台 - API 文档

## 📅 更新日期：2026-04-13

---

## 📋 目录

1. [传感器API](#传感器api)
2. [执行器API](#执行器api)
3. [控制指令API](#控制指令api)
4. [数据对比API](#数据对比api)
5. [错误处理](#错误处理)

---

## 传感器API

### 1. 获取所有传感器

**接口地址**：`GET /api/sensors`

**描述**：获取所有传感器设备列表

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| type | string | 否 | 按类型过滤（temperature, humidity, light, soil, soil_temperature, ec, ph） |

**请求示例**：
```bash
# 获取所有传感器
curl http://localhost:3000/api/sensors

# 获取温度传感器
curl http://localhost:3000/api/sensors?type=temperature
```

**响应示例**：
```json
{
  "success": true,
  "data": [
    {
      "id": "T-001",
      "name": "A区温室1号温度传感器",
      "type_id": 1,
      "location": "A区温室",
      "status": "online",
      "battery": 95,
      "last_update": "2026-04-13T15:30:00.000Z",
      "created_at": "2026-04-13T10:00:00.000Z",
      "type": "temperature",
      "type_name": "温度传感器",
      "unit": "°C"
    }
  ],
  "total": 12
}
```

---

### 2. 获取单个传感器详情

**接口地址**：`GET /api/sensors/[id]`

**描述**：获取指定传感器的详细信息

**路径参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 传感器ID（如：T-001） |

**请求示例**：
```bash
curl http://localhost:3000/api/sensors/T-001
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "id": "T-001",
    "name": "A区温室1号温度传感器",
    "type_id": 1,
    "location": "A区温室",
    "status": "online",
    "battery": 95,
    "last_update": "2026-04-13T15:30:00.000Z",
    "created_at": "2026-04-13T10:00:00.000Z",
    "type": "temperature",
    "type_name": "温度传感器",
    "unit": "°C"
  }
}
```

---

### 3. 获取传感器历史数据

**接口地址**：`GET /api/sensors/[id]/data`

**描述**：获取指定传感器的历史数据

**路径参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 传感器ID |

**查询参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| startTime | string | 否 | 开始时间（ISO 8601格式） |
| endTime | string | 否 | 结束时间（ISO 8601格式） |
| limit | number | 否 | 返回数量限制（默认100） |

**请求示例**：
```bash
# 获取最近100条数据
curl http://localhost:3000/api/sensors/T-001/data

# 获取指定时间范围的数据
curl "http://localhost:3000/api/sensors/T-001/data?startTime=2026-04-12T00:00:00Z&endTime=2026-04-13T23:59:59Z&limit=200"
```

**响应示例**：
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "sensor_id": "T-001",
      "value": 25.5,
      "timestamp": "2026-04-13T15:30:00.000Z"
    }
  ],
  "stats": {
    "avg": 24.5,
    "max": 28.0,
    "min": 22.0
  },
  "total": 100
}
```

---

### 4. 上传传感器数据

**接口地址**：`POST /api/sensors/[id]/data`

**描述**：上传传感器数据（硬件设备使用）

**路径参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 传感器ID |

**请求体**：
```json
{
  "value": 25.5
}
```

**请求示例**：
```bash
curl -X POST http://localhost:3000/api/sensors/T-001/data \
  -H "Content-Type: application/json" \
  -d '{"value": 25.5}'
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "id": 1001,
    "sensor_id": "T-001",
    "value": 25.5,
    "timestamp": "2026-04-13T15:30:00.000Z"
  },
  "message": "传感器数据添加成功"
}
```

---

### 5. 新增传感器

**接口地址**：`POST /api/sensors`

**描述**：新增传感器设备

**请求体**：
```json
{
  "name": "A区温室2号温度传感器",
  "type_id": 1,
  "location": "A区温室"
}
```

**请求示例**：
```bash
curl -X POST http://localhost:3000/api/sensors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "A区温室2号温度传感器",
    "type_id": 1,
    "location": "A区温室"
  }'
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "id": "T-004",
    "name": "A区温室2号温度传感器",
    "type_id": 1,
    "location": "A区温室",
    "status": "offline",
    "battery": 100,
    "last_update": null,
    "created_at": "2026-04-13T15:30:00.000Z",
    "type": "temperature",
    "type_name": "温度传感器",
    "unit": "°C"
  },
  "message": "传感器创建成功"
}
```

---

## 执行器API

### 1. 获取所有执行器

**接口地址**：`GET /api/actuators`

**描述**：获取所有执行器设备列表

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| type | string | 否 | 按类型过滤（water_pump, fan, heater, valve, light） |

**请求示例**：
```bash
# 获取所有执行器
curl http://localhost:3000/api/actuators

# 获取水泵
curl http://localhost:3000/api/actuators?type=water_pump
```

**响应示例**：
```json
{
  "success": true,
  "data": [
    {
      "id": "WP-001",
      "name": "A区温室1号水泵",
      "type_id": 1,
      "location": "A区温室",
      "status": "online",
      "state": "off",
      "mode": "auto",
      "last_update": "2026-04-13T15:30:00.000Z",
      "created_at": "2026-04-13T10:00:00.000Z",
      "type": "water_pump",
      "type_name": "水泵",
      "description": "用于灌溉和排水控制"
    }
  ],
  "total": 7
}
```

---

### 2. 获取单个执行器详情

**接口地址**：`GET /api/actuators/[id]`

**描述**：获取指定执行器的详细信息

**路径参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 执行器ID（如：WP-001） |

**请求示例**：
```bash
curl http://localhost:3000/api/actuators/WP-001
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "id": "WP-001",
    "name": "A区温室1号水泵",
    "type_id": 1,
    "location": "A区温室",
    "status": "online",
    "state": "off",
    "mode": "auto",
    "last_update": "2026-04-13T15:30:00.000Z",
    "created_at": "2026-04-13T10:00:00.000Z",
    "type": "water_pump",
    "type_name": "水泵",
    "description": "用于灌溉和排水控制"
  }
}
```

---

### 3. 更新执行器状态

**接口地址**：`PATCH /api/actuators/[id]`

**描述**：更新执行器的开关状态或控制模式

**路径参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 执行器ID |

**请求体**：
```json
{
  "state": "on",           // 开关状态：on 或 off
  "mode": "manual",        // 控制模式：auto 或 manual
  "trigger_source": "user" // 触发来源（可选）
}
```

**请求示例**：
```bash
# 开启水泵
curl -X PATCH http://localhost:3000/api/actuators/WP-001 \
  -H "Content-Type: application/json" \
  -d '{"state": "on", "trigger_source": "user"}'

# 切换为手动模式
curl -X PATCH http://localhost:3000/api/actuators/WP-001 \
  -H "Content-Type: application/json" \
  -d '{"mode": "manual"}'
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "id": "WP-001",
    "name": "A区温室1号水泵",
    "type_id": 1,
    "location": "A区温室",
    "status": "online",
    "state": "on",
    "mode": "auto",
    "last_update": "2026-04-13T15:30:00.000Z",
    "created_at": "2026-04-13T10:00:00.000Z",
    "type": "water_pump",
    "type_name": "水泵",
    "description": "用于灌溉和排水控制"
  },
  "message": "执行器状态更新成功"
}
```

---

### 4. 硬件端上传执行器状态

**接口地址**：`POST /api/actuators/[id]`

**描述**：硬件设备上传执行器状态（支持数字格式）

**路径参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 执行器ID |

**请求体**：
```json
{
  "state": 0,              // 开关状态：0=off, 1=on（数字或字符串）
  "mode": 1,               // 控制模式：0=auto, 1=manual（数字或字符串）
  "status": 1,             // 在线状态：0=offline, 1=online（数字或字符串，可选）
  "trigger_source": "hardware" // 触发来源（可选）
}
```

**参数说明**：
| 参数 | 数字值 | 字符串值 | 说明 |
|------|--------|----------|------|
| state | 0=off, 1=on | "off", "on" | 开关状态 |
| mode | 0=auto, 1=manual | "auto", "manual" | 控制模式 |
| status | 0=offline, 1=online | "offline", "online" | 在线状态 |

**请求示例**：
```bash
# 硬件端上传状态（数字格式）
curl -X POST http://localhost:3000/api/actuators/WP-002 \
  -H "Content-Type: application/json" \
  -d '{"state": 0, "mode": 1}'

# 硬件端上传状态（字符串格式）
curl -X POST http://localhost:3000/api/actuators/WP-002 \
  -H "Content-Type: application/json" \
  -d '{"state": "off", "mode": "manual"}'
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "id": "WP-002",
    "name": "B区温室1号水泵",
    "type_id": 1,
    "location": "B区温室",
    "status": "online",
    "state": "off",
    "mode": "manual",
    "last_update": "2026-04-13T15:30:00.000Z",
    "created_at": "2026-04-13T10:00:00.000Z",
    "type": "water_pump",
    "type_name": "水泵",
    "description": "用于灌溉和排水控制"
  },
  "message": "执行器状态上传成功"
}
```

---

### 5. 新增执行器

**接口地址**：`POST /api/actuators`

**描述**：新增执行器设备

**请求体**：
```json
{
  "name": "A区温室2号水泵",
  "type_id": 1,
  "location": "A区温室"
}
```

**请求示例**：
```bash
curl -X POST http://localhost:3000/api/actuators \
  -H "Content-Type: application/json" \
  -d '{
    "name": "A区温室2号水泵",
    "type_id": 1,
    "location": "A区温室"
  }'
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "id": "WP-003",
    "name": "A区温室2号水泵",
    "type_id": 1,
    "location": "A区温室",
    "status": "offline",
    "state": "off",
    "mode": "auto",
    "last_update": null,
    "created_at": "2026-04-13T15:30:00.000Z",
    "type": "water_pump",
    "type_name": "水泵",
    "description": "用于灌溉和排水控制"
  },
  "message": "执行器创建成功"
}
```

---

### 6. 删除执行器

**接口地址**：`DELETE /api/actuators/[id]`

**描述**：删除指定执行器

**路径参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 执行器ID |

**请求示例**：
```bash
curl -X DELETE http://localhost:3000/api/actuators/WP-003
```

**响应示例**：
```json
{
  "success": true,
  "message": "执行器删除成功"
}
```

---

## 控制指令API

控制指令API用于实现网页端远程控制硬件执行器的功能。采用轮询方式，网页端发送指令到服务器，硬件端定期查询并执行。

### 1. 发送控制指令（网页端）

**接口地址**：`POST /api/actuators/[id]/commands`

**描述**：网页端发送控制指令到服务器，等待硬件端查询执行

**路径参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 执行器ID（如：WP-001） |

**请求体**：
```json
{
  "command": "on"  // 控制命令：on 或 off
}
```

**请求示例**：
```bash
# 发送开启指令
curl -X POST http://localhost:3000/api/actuators/WP-002/commands \
  -H "Content-Type: application/json" \
  -d '{"command": "on"}'

# 发送关闭指令
curl -X POST http://localhost:3000/api/actuators/WP-002/commands \
  -H "Content-Type: application/json" \
  -d '{"command": "off"}'
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "id": 1,
    "actuator_id": "WP-002",
    "command": "on",
    "status": "pending"
  },
  "message": "OK"
}
```

**状态说明**：
| 状态值 | 说明 |
|--------|------|
| pending | 待执行（硬件端尚未查询） |
| executed | 已执行（硬件端已确认完成） |
| failed | 执行失败 |

---

### 2. 查询控制指令（硬件端）

**接口地址**：`GET /api/actuators/[id]/commands`

**描述**：硬件端查询是否有待执行的控制指令

**路径参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 执行器ID |

**请求示例**：
```bash
curl http://localhost:3000/api/actuators/WP-002/commands
```

**响应示例（有待执行指令）**：
```json
{
  "success": true,
  "data": {
    "id": 1,
    "actuator_id": "WP-002",
    "command": "on",
    "status": "pending",
    "created_at": "2026-04-13T15:30:00.000Z"
  },
  "message": "OK"
}
```

**响应示例（无待执行指令）**：
```json
{
  "success": true,
  "data": null,
  "message": "没有待执行的指令"
}
```

---

### 3. 确认指令执行（硬件端）

**接口地址**：`PATCH /api/actuators/[id]/commands`

**描述**：硬件端确认指令执行结果

**路径参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 执行器ID |

**请求体**：
```json
{
  "command_id": 1,        // 指令ID（从查询接口获取）
  "status": "executed"    // 执行状态：executed 或 failed
}
```

**请求示例**：
```bash
# 确认执行成功
curl -X PATCH http://localhost:3000/api/actuators/WP-002/commands \
  -H "Content-Type: application/json" \
  -d '{"command_id": 1, "status": "executed"}'

# 确认执行失败
curl -X PATCH http://localhost:3000/api/actuators/WP-002/commands \
  -H "Content-Type: application/json" \
  -d '{"command_id": 1, "status": "failed"}'
```

**响应示例**：
```json
{
  "success": true,
  "message": "OK"
}
```

**注意事项**：
1. 确认执行成功后，系统会自动更新执行器的状态
2. 硬件端建议每1-2秒查询一次指令
3. 同一时间只能有一个待执行的指令

---

## 数据对比API

### 1. 多传感器数据对比

**接口地址**：`GET /api/sensors/[id]/data`（多次调用）

**描述**：通过多次调用传感器数据接口实现多传感器数据对比

**实现方式**：
```javascript
// 前端实现示例
const sensorIds = ['T-001', 'H-001', 'L-001']
const startTime = '2026-04-12T00:00:00Z'
const endTime = '2026-04-13T23:59:59Z'

const promises = sensorIds.map(id => 
  fetch(`/api/sensors/${id}/data?startTime=${startTime}&endTime=${endTime}&limit=1000`)
    .then(res => res.json())
)

const results = await Promise.all(promises)
```

---

## 错误处理

### 错误响应格式

所有API在发生错误时都会返回统一的错误格式：

```json
{
  "success": false,
  "error": "错误描述",
  "details": "详细错误信息"
}
```

### 常见错误码

| HTTP状态码 | 说明 |
|-----------|------|
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

### 错误示例

**400 错误**：
```json
{
  "success": false,
  "error": "缺少必要参数：name, type_id, location"
}
```

**404 错误**：
```json
{
  "success": false,
  "error": "传感器不存在"
}
```

**500 错误**：
```json
{
  "success": false,
  "error": "获取传感器列表失败",
  "details": "数据库连接失败"
}
```

---

## 数据类型说明

### 传感器类型（sensor_types）

| 类型标识 | 名称 | 单位 |
|---------|------|------|
| temperature | 温度传感器 | °C |
| humidity | 空气湿度传感器 | % |
| light | 光照传感器 | Lux |
| soil | 土壤湿度传感器 | % |
| soil_temperature | 土壤温度传感器 | °C |
| ec | 土壤电导率传感器 | μS/cm |
| ph | 土壤pH值传感器 | pH |

### 执行器类型（actuator_types）

| 类型标识 | 名称 | 描述 |
|---------|------|------|
| water_pump | 水泵 | 用于灌溉和排水控制 |
| fan | 风扇 | 用于通风和温度调节 |
| heater | 加热器 | 用于温度控制 |
| valve | 电磁阀 | 用于水流控制 |
| light | 补光灯 | 用于光照调节 |

### 执行器状态说明

| 字段 | 取值 | 说明 |
|------|------|------|
| status | online | 设备在线 |
| status | offline | 设备离线 |
| state | on | 开启状态 |
| state | off | 关闭状态 |
| mode | auto | 自动控制模式 |
| mode | manual | 手动控制模式 |

---

## 使用示例

### JavaScript/TypeScript 示例

```typescript
// 获取所有传感器
const sensors = await fetch('/api/sensors')
  .then(res => res.json())

// 获取传感器历史数据
const data = await fetch('/api/sensors/T-001/data?limit=100')
  .then(res => res.json())

// 上传传感器数据
await fetch('/api/sensors/T-001/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ value: 25.5 })
})

// 开启水泵
await fetch('/api/actuators/WP-001', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    state: 'on', 
    trigger_source: 'user' 
  })
})

// 发送控制指令（网页端控制硬件）
await fetch('/api/actuators/WP-002/commands', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command: 'on' })
})
```

### Python 示例

```python
import requests

# 获取所有传感器
response = requests.get('http://localhost:3000/api/sensors')
sensors = response.json()

# 上传传感器数据
response = requests.post(
    'http://localhost:3000/api/sensors/T-001/data',
    json={'value': 25.5}
)

# 开启水泵
response = requests.patch(
    'http://localhost:3000/api/actuators/WP-001',
    json={'state': 'on', 'trigger_source': 'user'}
)

# 发送控制指令（网页端控制硬件）
response = requests.post(
    'http://localhost:3000/api/actuators/WP-002/commands',
    json={'command': 'on'}
)
```

---

## 注意事项

1. **时间格式**：所有时间参数使用 ISO 8601 格式（如：`2026-04-13T15:30:00.000Z`）
2. **数据精度**：传感器数据保留2位小数
3. **自动刷新**：前端页面每5-10秒自动刷新数据
4. **状态历史**：执行器状态变更会自动记录到历史表
5. **并发限制**：建议控制API调用频率，避免过于频繁的请求
6. **控制指令**：
   - 硬件端建议每1-2秒查询一次控制指令
   - 确认执行成功后会自动更新执行器状态
   - 同一时间只能有一个待执行的指令
   - 指令执行后状态会从 pending 变为 executed 或 failed

---

**最后更新时间**：2026-04-13  
**文档版本**：v1.1  
**维护团队**：开发团队
