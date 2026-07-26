# 硬件数据绑定协议说明

## 概述

本文档描述智慧农业平台与硬件设备之间的数据交换协议，包括设备上报协议、执行器控制协议和回执确认协议。

> **完整API参考文档**: 请参考 [API参考文档](./api-reference.md) 获取所有API接口的详细说明。

---

## 一、设备上报协议

### 1.1 接口地址

```
POST /api/device/report
```

### 1.2 请求格式

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

### 1.3 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| gateway_ip | string | 是 | 网关IP地址，用于区域划分 |
| gateway_type | string | 否 | 网关类型，默认`wifi_sensor` |
| mac | string | 否 | 网关MAC地址 |
| farm_id | number | 是 | 农场ID |
| area | string | 否 | 区域名称，同一IP下的设备默认属于同一区域 |
| nodes | array | 是 | 设备节点数组 |

#### nodes数组元素字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| node_id | string | 是 | 设备节点唯一标识 |
| name | string | 否 | 设备名称 |
| type | string | 是 | 设备类型（temperature/humidity/motor/servo/light等） |
| value | number | 传感器必填 | 传感器数值 |
| unit | string | 否 | 单位 |
| location | string | 否 | 安装位置 |
| area | string | 否 | 区域名称（可覆盖网关级区域） |
| state | string | 执行器必填 | 执行器状态（on/off） |
| mode | string | 否 | 执行器模式（auto/manual） |
| control_value | number | 否 | 执行器当前控制值 |
| control_type | string | 否 | 执行器控制类型 |
| control_range | object | 否 | 执行器控制参数范围 |

#### control_range字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| min | number | 是 | 最小值 |
| max | number | 是 | 最大值 |
| step | number | 是 | 步进值 |
| default | number | 是 | 默认值 |

### 1.4 执行器控制类型说明

| 控制类型 | 说明 | 适用设备 |
|----------|------|----------|
| boolean | 布尔值控制（on/off） | LED开关、继电器、水泵 |
| integer | 整数值控制（0-100） | 电机速度、亮度调节 |
| angle | 角度控制（0-180/360） | 舵机角度、阀门开度 |
| float | 浮点值控制 | 精确参数调节 |
| string | 字符串指令 | 自定义指令 |

### 1.5 响应格式

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
      "device_id": "T-1-1001"
    }
  ],
  "total_nodes": 2,
  "success_count": 2,
  "failed_count": 0,
  "timestamp": "2026-07-26T10:30:00.000Z"
}
```

---

## 二、执行器控制协议

### 2.1 接口地址

```
POST /api/actuators/[id]/control
```

### 2.2 请求格式

```json
{
  "command": "value",
  "control_value": 75,
  "mode": "manual"
}
```

### 2.3 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| command | string | 是 | 控制命令（on/off/value） |
| control_value | number | 否 | 控制值（command=value时必填） |
| mode | string | 否 | 控制模式（auto/manual） |

### 2.4 响应格式

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

## 三、硬件回执确认协议

### 3.1 接口地址

```
POST /api/device/ack
```

### 3.2 请求格式

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

### 3.3 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| gateway_ip | string | 否 | 网关IP地址 |
| actuator_id | string | 是 | 执行器ID |
| command_id | number | 是 | 命令ID |
| status | string | 是 | 执行状态（executed/failed） |
| control_value | number | 否 | 实际控制值 |
| state | string | 否 | 执行器状态（on/off） |

### 3.4 响应格式

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

## 四、区域划分规则

1. **网关级区域**：优先使用上报数据中的`area`字段
2. **IP默认区域**：如果没有提供`area`字段，使用`gateway_ip`生成默认区域名（如：区域-192.168.1.100）
3. **节点级覆盖**：单个设备可以通过`nodes[].area`字段覆盖网关级区域设置
4. **同一IP同一区域**：同一IP地址的设备默认属于同一区域

---

## 五、控制流程

```
用户操作 → 服务器下发控制指令 → 硬件执行 → 硬件返回回执 → 服务器更新状态 → 页面实时更新
```

### 5.1 超时机制

- 控制指令发送后，服务器等待30秒回执
- 超时未收到回执，标记为`timeout`并提醒用户
- 超时后执行器自动解锁，允许重新发送指令

---

## 六、WebSocket实时通信

### 6.1 连接地址

```
ws://localhost:8080
```

### 6.2 消息类型

| 类型 | 方向 | 说明 |
|------|------|------|
| heartbeat | 双向 | 心跳检测 |
| sensor_data | 服务器→客户端 | 传感器数据更新 |
| actuator_status | 服务器→客户端 | 执行器状态更新 |
| command | 服务器→客户端 | 控制指令推送 |
| command_ack | 客户端→服务器 | 命令回执（硬件端） |
| command_status | 服务器→客户端 | 命令状态更新 |
| area_update | 服务器→客户端 | 区域数据更新 |

### 6.3 订阅区域

```json
{
  "type": "area_sync",
  "data": {
    "area": "温室1号区域"
  }
}
```

---

## 七、设备类型列表

### 7.1 传感器类型

| 类型 | 名称 | 单位 |
|------|------|------|
| temperature | 温度传感器 | °C |
| humidity | 空气湿度传感器 | % |
| soil_moisture | 土壤湿度传感器 | % |
| soil_temperature | 土壤温度传感器 | °C |
| light | 光照传感器 | lux |
| ph | pH传感器 | pH |
| co2 | CO₂浓度传感器 | ppm |
| pressure | 气压传感器 | hPa |
| vibration | 振动传感器 | mm/s |
| altitude | 海拔传感器 | m |
| water_level | 水位传感器 | cm |
| pm25 | PM2.5传感器 | μg/m³ |

### 7.2 执行器类型

| 类型 | 名称 | 默认控制类型 |
|------|------|--------------|
| water_pump | 水泵 | boolean |
| fan | 风扇 | integer |
| light | 补光灯 | boolean |
| valve | 电磁阀 | boolean |
| motor | 电机 | integer |
| servo | 舵机 | angle |
| led | LED灯 | boolean |
| ventilator | 通风机 | integer |
| fogger | 雾化器 | boolean |

---

## 八、测试示例

### 8.1 使用curl测试设备上报

```bash
curl -X POST http://localhost:3000/api/device/report \
  -H "Content-Type: application/json" \
  -d '{
    "gateway_ip": "192.168.1.100",
    "gateway_type": "wifi_sensor",
    "farm_id": 1,
    "area": "测试区域",
    "nodes": [
      {"node_id": "T-TEST-001", "type": "temperature", "value": 25.5, "unit": "C"},
      {"node_id": "M-TEST-001", "type": "motor", "state": "on", "control_value": 50, "control_type": "integer"}
    ]
  }'
```

### 8.2 使用curl测试回执确认

```bash
curl -X POST http://localhost:3000/api/device/ack \
  -H "Content-Type: application/json" \
  -d '{
    "actuator_id": "MT-1-1001",
    "command_id": 123,
    "status": "executed",
    "control_value": 50,
    "state": "on"
  }'
```

---

## 十、更多API接口

### 10.1 API分类索引

| 分类 | 文档位置 | 说明 |
|------|----------|------|
| 传感器API | [API参考文档§一](./api-reference.md#一传感器相关api) | 传感器列表、详情、历史数据、类型管理 |
| 执行器API | [API参考文档§二](./api-reference.md#二执行器相关api) | 执行器列表、详情、控制、命令历史、类型管理 |
| 设备上报API | 本文档§一 | 硬件设备数据上报协议 |
| 硬件回执API | 本文档§三 | 控制指令回执确认协议 |
| 网关设备API | [API参考文档§四](./api-reference.md#四网关与设备节点api) | 网关和设备节点管理 |
| 报警管理API | [API参考文档§五](./api-reference.md#五报警相关api) | 报警规则和报警记录 |
| 自动化策略API | [API参考文档§六](./api-reference.md#六策略相关api) | 策略管理和执行日志 |
| 农场区域API | [API参考文档§七](./api-reference.md#七农场与区域api) | 农场和区域管理 |
| AI服务API | [API参考文档§八](./api-reference.md#八ai相关api) | AI对话、诊断、图像识别 |
| 知识库API | [API参考文档§九](./api-reference.md#九知识库相关api) | 知识库增删改查、搜索、导入导出 |
| 提示词模板API | [API参考文档§十](./api-reference.md#十提示词模板api) | 提示词模板管理和渲染 |
| WebSocket API | 本文档§六 | 实时通信协议 |

### 10.2 常用接口速查

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 设备数据上报 | POST | /api/device/report | 硬件上报传感器和执行器数据 |
| 控制指令回执 | POST | /api/device/ack | 硬件确认控制指令执行结果 |
| 查询待执行指令 | GET | /api/device/ack | 硬件轮询待执行控制指令 |
| 获取传感器列表 | GET | /api/sensors | 获取所有传感器 |
| 获取执行器列表 | GET | /api/actuators | 获取所有执行器 |
| 发送控制指令 | POST | /api/actuators/[id]/commands | 向执行器发送控制指令 |
| 查询命令历史 | GET | /api/actuators/[id]/commands | 查询执行器控制历史 |
| 获取网关列表 | GET | /api/gateways | 获取所有网关设备 |

---

## 十一、注意事项

1. **数据格式**：所有数值类型必须为数字，字符串必须用双引号
2. **时间格式**：使用ISO 8601格式（如：2026-07-26T10:30:00.000Z）
3. **编码格式**：请求体必须为UTF-8编码
4. **频率限制**：建议上报间隔不小于10秒
5. **重连机制**：网络中断后需实现自动重连
6. **错误处理**：收到非200响应时，建议采用指数退避策略重试