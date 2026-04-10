# 天工慧眼硬件设备JSON通信协议

## 1. 概述

本文档描述了天工慧眼系统中服务器与硬件设备之间的JSON通信协议，包括服务器发送给硬件的控制命令格式以及硬件发送给服务器的数据格式。

## 2. 服务器发送给硬件的控制命令

### 2.1 基本格式

服务器发送给硬件的控制命令采用统一的JSON格式，如下所示：

```json
{
    "type": "control",
    "device_id": "DEVICE_192_168_1_100",
    "timestamp": 1234567890000,
    "action": {
        "device": "pump",
        "command": "on",
        "params": {
            "speed": 50,
            "duration": 1000
        }
    }
}
```

### 2.2 字段说明

| 字段名 | 类型 | 说明 | 必填 |
|-------|------|------|------|
| `type` | string | 消息类型，固定为"control" | 是 |
| `device_id` | string | 设备ID | 是 |
| `timestamp` | integer | 时间戳，单位为毫秒 | 是 |
| `action` | object | 操作对象，包含设备类型、命令和参数 | 是 |
| `action.device` | string | 设备类型，如"pump"、"fan"、"servo"等 | 是 |
| `action.command` | string | 命令，如"on"、"off"、"set_angle"等 | 是 |
| `action.params` | object | 命令参数，根据设备类型和命令不同而不同 | 是 |

### 2.3 支持的设备类型和命令

#### 2.3.1 水泵 (pump)

**命令：on**
- 描述：开启水泵
- 参数：
  - `speed`: 水泵速度，0-100
  - `duration`: 运行时间，单位为毫秒（可选）

**命令：off**
- 描述：关闭水泵
- 参数：无

**命令：set_flow**
- 描述：设置水泵流量
- 参数：
  - `flow`: 流量值，0-100

#### 2.3.2 风扇 (fan)

**命令：on**
- 描述：开启风扇
- 参数：
  - `speed`: 风扇速度，0-100

**命令：off**
- 描述：关闭风扇
- 参数：无

**命令：set_speed**
- 描述：设置风扇速度
- 参数：
  - `speed`: 风扇速度，0-100

#### 2.3.3 舵机 (servo)

**命令：set_angle**
- 描述：设置舵机角度
- 参数：
  - `angle`: 角度值，0-180

**命令：reset**
- 描述：重置舵机到初始位置
- 参数：无

#### 2.3.4 步进电机 (stepper)

**命令：set_speed**
- 描述：设置步进电机速度
- 参数：
  - `speed`: 速度值，0-100

**命令：set_direction**
- 描述：设置步进电机方向
- 参数：
  - `direction`: 方向，"clockwise"或"counterclockwise"

## 3. 硬件发送给服务器的数据格式

### 3.1 传感器数据

```json
{
    "type": "sensor_data",
    "device_id": "DEVICE_192_168_1_100",
    "timestamp": 1234567890000,
    "temperature": 25.5,
    "humidity": 60.0,
    "light": 1000,
    "soil_moisture": 70.0
}
```

### 3.2 心跳包

```json
{
    "type": "heartbeat",
    "device_id": "DEVICE_192_168_1_100",
    "timestamp": 1234567890000,
    "status": "online"
}
```

### 3.3 执行结果

```json
{
    "type": "execution_result",
    "device_id": "DEVICE_192_168_1_100",
    "timestamp": 1234567890000,
    "command_id": "123456",
    "result": {
        "status": "success",
        "message": "Command executed successfully"
    }
}
```

## 4. 硬件端JSON处理流程

### 4.1 处理步骤

1. **接收数据**：从串口接收服务器发送的数据
2. **解析JSON**：使用JSON解析库解析接收到的JSON字符串
3. **验证格式**：检查JSON格式是否符合协议规范
4. **处理命令**：根据命令类型和设备类型执行相应的操作
5. **返回结果**：发送执行结果给服务器

### 4.2 示例代码流程

```c
void handle_received_data(const char* data, uint16_t len)
{
    // 1. 解析JSON
    json_t *root = json_loads(data, 0, NULL);
    if (!root) {
        printf("JSON解析失败\r\n");
        return;
    }
    
    // 2. 验证消息类型
    const char *type = json_string_value(json_object_get(root, "type"));
    if (strcmp(type, "control") != 0) {
        printf("未知消息类型\r\n");
        json_decref(root);
        return;
    }
    
    // 3. 解析action对象
    json_t *action = json_object_get(root, "action");
    const char *device = json_string_value(json_object_get(action, "device"));
    const char *command = json_string_value(json_object_get(action, "command"));
    json_t *params = json_object_get(action, "params");
    
    // 4. 根据设备类型和命令执行操作
    if (strcmp(device, "pump") == 0) {
        handle_pump_command(command, params);
    } else if (strcmp(device, "fan") == 0) {
        handle_fan_command(command, params);
    } else if (strcmp(device, "servo") == 0) {
        handle_servo_command(command, params);
    }
    
    // 5. 释放JSON对象
    json_decref(root);
}
```

## 5. 实现建议

1. **使用JSON解析库**：建议使用轻量级的JSON解析库，如cJSON或JSMN，避免手动解析JSON字符串
2. **错误处理**：完善的错误处理机制，包括JSON解析错误、命令不支持等
3. **日志记录**：记录收到的命令和执行结果，便于调试
4. **超时处理**：添加命令执行超时处理，避免设备卡死
5. **固件更新**：支持通过JSON命令进行固件更新

## 6. 版本历史

| 版本 | 日期 | 描述 |
|------|------|------|
| v1.0 | 2025-12-17 | 初始版本，定义基本通信协议 |

## 7. 附录

### 7.1 设备类型映射

| 服务器设备类型 | 硬件设备类型 |
|---------------|--------------|
| water_pump | pump |
| fan | fan |
| servo | servo |
| stepper_motor | stepper |
| pump | pump |
| stepper | stepper |

### 7.2 命令类型映射

| 服务器命令 | 硬件命令 |
|------------|----------|
| on | 开启设备 |
| off | 关闭设备 |
| set_angle | 设置角度 |
| set_speed | 设置速度 |
| set_flow | 设置流量 |
| reset | 重置设备 |
