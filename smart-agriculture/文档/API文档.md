# 智慧农业物联网平台 - API 文档

## 更新日期：2026-06-23

---

## 目录

1. [基地管理API](#1-基地管理api)
2. [区域管理API](#2-区域管理api)
3. [传感器API](#3-传感器api)
4. [执行器API](#4-执行器api)
5. [设备网关API](#5-设备网关api)
6. [设备数据上报API](#6-设备数据上报api)
7. [报警系统API](#7-报警系统api)
8. [知识库API](#8-知识库api)
9. [提示词模板API](#9-提示词模板api)
10. [AI服务API](#10-ai服务api)
11. [错误处理](#11-错误处理)

---

## 1. 基地管理API

### 1.1 获取基地列表

**接口地址**：`GET /api/farms`

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| status | string | 否 | 按状态筛选（active/inactive） |

**响应示例**：
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "北京智能温室基地",
      "code": "BJ-001",
      "address": "北京市昌平区",
      "area": 50,
      "farm_type": "greenhouse",
      "status": "active",
      "created_at": "2026-06-23T10:00:00Z"
    }
  ],
  "total": 1
}
```

### 1.2 获取基地详情

**接口地址**：`GET /api/farms/[id]`

**响应示例**：
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "北京智能温室基地",
    "zones": [...],
    "stats": {
      "zones": 3,
      "sensors": 10,
      "actuators": 5
    }
  }
}
```

### 1.3 创建基地

**接口地址**：`POST /api/farms`

**请求体**：
```json
{
  "name": "基地名称",
  "code": "BJ-002",
  "address": "地址",
  "area": 100,
  "farm_type": "mixed"
}
```

### 1.4 更新基地

**接口地址**：`PUT /api/farms/[id]`

### 1.5 删除基地

**接口地址**：`DELETE /api/farms/[id]`

---

## 2. 区域管理API

### 2.1 获取区域列表

**接口地址**：`GET /api/farms/[farmId]/zones`

### 2.2 创建区域

**接口地址**：`POST /api/farms/[farmId]/zones`

**请求体**：
```json
{
  "name": "1号温室",
  "code": "GH1",
  "zone_type": "greenhouse",
  "area": 10,
  "description": "区域描述"
}
```

### 2.3 更新区域

**接口地址**：`PUT /api/zones/[id]`

### 2.4 删除区域

**接口地址**：`DELETE /api/zones/[id]`

---

## 3. 传感器API

### 3.1 获取传感器列表

**接口地址**：`GET /api/sensors`

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| type | string | 否 | 按类型筛选（temperature/humidity/light等） |
| farm_id | number | 否 | 按基地筛选 |

**响应示例**：
```json
{
  "success": true,
  "data": [
    {
      "id": "T-001",
      "name": "温度传感器1",
      "type": "temperature",
      "type_name": "温度传感器",
      "unit": "°C",
      "location": "1号温室",
      "status": "online",
      "battery": 95,
      "farm_id": 1,
      "zone_id": 1,
      "last_update": "2026-06-23T15:30:00Z"
    }
  ],
  "total": 10
}
```

### 3.2 获取传感器历史数据

**接口地址**：`GET /api/sensors/[id]/data`

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| startTime | string | 否 | 开始时间（ISO 8601） |
| endTime | string | 否 | 结束时间（ISO 8601） |
| limit | number | 否 | 返回数量（默认100） |

### 3.3 上传传感器数据

**接口地址**：`POST /api/sensors/[id]/data`

**请求体**：
```json
{
  "value": 25.5
}
```

---

## 4. 执行器API

### 4.1 获取执行器列表

**接口地址**：`GET /api/actuators`

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| type | string | 否 | 按类型筛选（water_pump/fan/heater等） |
| farm_id | number | 否 | 按基地筛选 |

### 4.2 更新执行器状态

**接口地址**：`PATCH /api/actuators/[id]`

**请求体**：
```json
{
  "state": "on",
  "mode": "manual",
  "trigger_source": "user"
}
```

### 4.3 发送控制指令

**接口地址**：`POST /api/actuators/[id]/commands`

**请求体**：
```json
{
  "command": "on"
}
```

---

## 5. 设备网关API

### 5.1 获取网关列表

**接口地址**：`GET /api/gateways`

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| farm_id | number | 否 | 按基地筛选 |

**响应示例**：
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "farm_id": 1,
      "name": "1号温室网关",
      "gateway_type": "lorawan_gateway",
      "ip_address": "192.168.1.100",
      "mac_address": "AA:BB:CC:DD:EE:FF",
      "protocol": "lorawan",
      "status": "online",
      "nodes": [
        {
          "id": 1,
          "node_id": "sensor_001",
          "name": "温度传感器1",
          "sensor_type": "temperature",
          "location": "1号温室入口",
          "status": "online",
          "last_update": "2026-06-23T15:30:00Z"
        }
      ]
    }
  ],
  "total": 1
}
```

### 5.2 创建网关

**接口地址**：`POST /api/gateways`

**请求体**：
```json
{
  "farm_id": 1,
  "name": "新网关",
  "gateway_type": "wifi_sensor",
  "ip_address": "192.168.1.101",
  "mac_address": "AA:BB:CC:DD:EE:FF",
  "protocol": "http"
}
```

### 5.3 删除网关

**接口地址**：`DELETE /api/gateways/[id]`

---

## 6. 设备数据上报API

### 6.1 设备数据上报

**接口地址**：`POST /api/device/report`

**场景1：WiFi直连传感器**
```json
{
  "gateway_ip": "192.168.1.101",
  "gateway_type": "wifi_sensor",
  "mac": "AA:BB:CC:DD:EE:FF",
  "farm_id": 1,
  "data": [
    {"type": "temperature", "value": 25.5, "unit": "°C"}
  ]
}
```

**场景2：网关聚合上报**
```json
{
  "gateway_ip": "192.168.1.100",
  "gateway_type": "lorawan_gateway",
  "mac": "11:22:33:44:55:66",
  "farm_id": 1,
  "nodes": [
    {"node_id": "sensor_001", "type": "temperature", "value": 24.5, "unit": "°C"},
    {"node_id": "sensor_002", "type": "humidity", "value": 65.0, "unit": "%"}
  ]
}
```

**响应示例**：
```json
{
  "success": true,
  "message": "数据上报成功",
  "gateway_id": 1
}
```

**自动处理逻辑**：
1. 首次上报 → 自动创建网关和设备节点
2. 后续上报 → 自动关联到已有设备
3. 数据存储 → 写入device_data表并同步到sensors表

---

## 7. 报警系统API

### 7.1 获取报警规则

**接口地址**：`GET /api/alarms/rules`

### 7.2 创建报警规则

**接口地址**：`POST /api/alarms/rules`

**请求体**：
```json
{
  "name": "温度过高报警",
  "sensor_type": "temperature",
  "condition_type": "above",
  "max_value": 35,
  "severity": "critical"
}
```

### 7.3 获取报警记录

**接口地址**：`GET /api/alarms/records`

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| status | string | 否 | 按状态筛选（active/acknowledged/resolved） |
| severity | string | 否 | 按严重程度筛选（info/warning/critical） |
| page | number | 否 | 页码（默认1） |
| pageSize | number | 否 | 每页数量（默认20） |

### 7.4 更新报警状态

**接口地址**：`PATCH /api/alarms/records`

**请求体**：
```json
{
  "id": 1,
  "status": "acknowledged",
  "acknowledged_by": "user"
}
```

---

## 8. 知识库API

### 8.1 获取知识列表

**接口地址**：`GET /api/knowledge`

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | number | 否 | 页码（默认1） |
| pageSize | number | 否 | 每页数量（默认20） |
| category | string | 否 | 按分类筛选 |
| search | string | 否 | 搜索关键词 |

### 8.2 智能添加知识

**接口地址**：`POST /api/knowledge/smart-add`

**请求体**：
```json
{
  "raw_text": "番茄晚疫病症状：叶片出现水渍状暗绿色斑点..."
}
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "structured": {
          "title": "番茄晚疫病症状与防治",
          "content": "...",
          "category": "病虫害防治",
          "tags": "番茄,晚疫病"
        },
        "conflicts": [],
        "has_conflicts": false
      }
    ],
    "total": 1,
    "has_any_conflicts": false
  }
}
```

### 8.3 知识对比分析

**接口地址**：`POST /api/knowledge/compare`

**请求体**：
```json
{
  "ids": [1, 2, 3]
}
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "contradictions": [
      {
        "item1": {"id": 1, "title": "知识A"},
        "item2": {"id": 2, "title": "知识B"},
        "type": "direct",
        "description": "直接矛盾",
        "detail1": "观点A",
        "detail2": "观点B",
        "severity": "high",
        "suggestion": "存在直接矛盾，请核实"
      }
    ],
    "stats": {
      "contradiction_count": 1,
      "has_contradictions": true
    }
  }
}
```

---

## 9. 提示词模板API

### 9.1 获取模板列表

**接口地址**：`GET /api/prompts`

### 9.2 渲染模板

**接口地址**：`POST /api/prompts/render`

**请求体**：
```json
{
  "template_id": 1,
  "variables": {
    "sensor_data": "温度: 25°C",
    "detection_results": "未检测到病虫害"
  }
}
```

---

## 10. AI服务API

### 10.1 AI聊天

**接口地址**：`POST /api/ai/chat`

### 10.2 AI诊断

**接口地址**：`POST /api/ai/diagnosis`

### 10.3 图片识别

**接口地址**：`POST /api/ai/image-recognition`

### 10.4 获取模型列表

**接口地址**：`GET /api/ai/models`

---

## 11. 错误处理

### 错误响应格式

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

---

## 12. 设备编号规则

```
[基地编码]-[区域编码]-[设备类型]-[序号]
示例：BJ-001-GH1-S-001（北京001号基地-1号大棚-传感器-001）
```

---

**文档版本**：v2.0  
**最后更新**：2026-06-23
