# AI 自动化方案开发计划

## 更新日期：2026-08-11

---

## 1. 背景与问题分析

### 1.1 当前系统存在的问题

| 序号 | 问题描述 | 根因分析 | 影响范围 |
|------|---------|---------|---------|
| 1 | `light` 类型在 `sensor_types`（光照传感器）和 `actuator_types`（补光灯）中同时存在 | `device-types.ts` 中 `light` 同时注册为 SENSOR 和 ACTUATOR，系统靠 `state`/`value` 字段区分，但 AI 解析时无法正确区分 | AI 命令解析器无法区分"查询光照"和"打开灯光" |
| 2 | LED 灯参数表不清晰 | LT-1-001（普通补光灯，boolean）和 LT-1-002（RGB-LED，integer）同属 `light` 类型，但控制方式完全不同 | AI 无法正确选择控制类型，控制卡片加载错误 |
| 3 | 缺少 AI 可理解的自动化方案存储 | 系统有 `strategies` 表用于自动化策略，但缺少自然语言→设备操作的映射方案 | AI 无法主动推荐或执行自动化策略 |
| 4 | 知识库缺少用户编辑入口 | `ai_device_knowledge` 表仅有 API，缺少管理界面 | 用户无法自主调整设备匹配规则 |

### 1.2 日志证据

```
[Report] 设备 LT-1-002 类型 light 同时存在于传感器和执行器，根据state字段判断为执行器
[syncToActuator] 开始同步: deviceId=LT-1-002, type=light, name=RGB-LED
```

- LT-1-002 的 `type=light`、`name=RGB-LED`，实际是 RGB-LED 灯
- 系统虽然正确判断了"执行器"类别，但不知道它是 RGB-LED（支持颜色控制），只能按普通补光灯处理

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         AI 聊天层                                │
│              app/api/ai/chat/route.ts  ← 统一入口                │
└──────────────┬──────────────┬──────────────┬────────────────────┘
               │              │              │
     ┌─────────▼──────┐ ┌────▼──────┐ ┌─────▼───────────────────┐
     │  知识库匹配     │ │  命令解析  │ │  自动化方案推荐          │
     │  ai_device_    │ │  ai-      │ │  ai_automation_         │
     │  knowledge     │ │  command- │ │  schemes (NEW)          │
     │  (已有 ✅)     │ │  parser   │ │  (新建 ✅)             │
     └───────┬────────┘ └───────────┘ └─────────┬────────────────┘
             │                                   │
     ┌───────▼────────┐                  ┌───────▼────────────────┐
     │  知识库管理页面  │                  │  自动化方案管理页面      │
     │  /admin/ai-    │                  │  /admin/ai-           │
     │  knowledge     │                  │  automation (NEW)     │
     │  (已有 ✅)     │                  │  (新建 ✅)            │
     └────────────────┘                  └────────────────────────┘
```

### 2.2 两张核心表的分工

| 维度 | `ai_device_knowledge`（已有 ✅） | `ai_automation_schemes`（新建 ✅） |
|------|------------------------------|--------------------------------|
| **用途** | 关键词 → 设备类型映射 | 自然语言 → 自动化策略 |
| **存储内容** | "水泵"、"灌溉" → water_pump | "温度超过30度时打开风扇" → 触发风扇 on |
| **示例** | `{keywords:["水泵","灌溉"], actions:{on:"开启"}}` | `{trigger:"温度>30°C", action:"开启风扇", device:"fan"}` |
| **用户可见性** | 管理员可见，可编辑 | 仅后台存储，AI 引擎使用 |
| **数据量** | 1 条/设备类型（~27条） | 多条/设备类型（22条系统预设） |

### 2.3 数据流

```
用户输入: "温室太热了，帮我降温"
         │
         ▼
┌─────────────────────────────────────────────────┐
│  AI Chat Route (app/api/ai/chat/route.ts)       │
│                                                  │
│  1. 查询 ai_device_knowledge → 匹配关键词       │
│     "降温" → fan, fogger, ventilator            │
│                                                  │
│  2. 查询 ai_automation_schemes → 匹配场景       │
│     "太热" → 温度过高降温方案                     │
│     trigger: "温度>30°C"                        │
│     action: "开启风扇 + 开启雾化器"              │
│                                                  │
│  3. 解析命令 → 下发控制指令                       │
│     fan: on, fogger: on                         │
└─────────────────────────────────────────────────┘
```

---

## 3. 新建表设计

### 3.1 `ai_automation_schemes` 表结构

```sql
CREATE TABLE IF NOT EXISTS ai_automation_schemes (
  id INT AUTO_INCREMENT PRIMARY KEY
    COMMENT '方案ID',
  name VARCHAR(100) NOT NULL
    COMMENT '方案名称（如"高温自动降温"、"夜间补光"）',
  description TEXT NOT NULL
    COMMENT 'AI可理解的自然语言描述（用于语义匹配）',
  trigger_condition TEXT
    COMMENT '触发条件（自然语言描述，如"温度超过30度"）',
  action_desc TEXT NOT NULL
    COMMENT '执行动作描述（自然语言，如"开启风扇并开启雾化器"）',
  device_type VARCHAR(50) NOT NULL
    COMMENT '主要目标设备类型（如 fan, water_pump, light）',
  related_sensors JSON
    COMMENT '关联传感器类型 ["temperature","humidity"]',
  related_actuators JSON
    COMMENT '关联执行器类型 ["fan","fogger"]',
  action_type ENUM('on','off','value','composite') DEFAULT 'on'
    COMMENT '动作类型：on=开启, off=关闭, value=数值控制, composite=组合动作',
  action_value DECIMAL(10,2)
    COMMENT '动作值（action_type=value时使用）',
  action_unit VARCHAR(20)
    COMMENT '动作值单位（如 %, °C, Lux）',
  composite_actions JSON
    COMMENT '组合动作定义（action_type=composite时使用）',
  priority INT DEFAULT 0
    COMMENT '推荐优先级（数值越大越优先推荐）',
  is_system TINYINT(1) DEFAULT 0
    COMMENT '是否系统预设（0=用户自建，1=系统预设）',
  is_active TINYINT(1) DEFAULT 1
    COMMENT '是否启用',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_device_type (device_type),
  INDEX idx_priority (priority DESC),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI自动化方案表 - 存储AI可理解的自动化策略';
```

### 3.2 `composite_actions` 字段结构

```json
{
  "actions": [
    {
      "device_type": "fan",
      "action": "on",
      "value": null,
      "delay_seconds": 0
    },
    {
      "device_type": "fogger",
      "action": "on",
      "value": null,
      "delay_seconds": 5
    }
  ],
  "description": "先开启风扇，5秒后开启雾化器"
}
```

---

## 4. 系统预设自动化方案（22条，已全部预填充 ✅）

### 4.1 温度控制方案

| 方案名称 | 触发条件 | 动作 | 目标设备 |
|---------|---------|------|---------|
| 高温自动降温 | 温度 > 30°C | 开启风扇 + 开启雾化器 | fan, fogger |
| 低温自动供暖 | 温度 < 15°C | 开启加热器 | heater |
| 温和通风 | 温度 25-30°C | 仅开启风扇 | fan |
| 温度恢复正常 | 温度 20-25°C | 关闭风扇、关闭加热器 | fan, heater |

### 4.2 湿度控制方案

| 方案名称 | 触发条件 | 动作 | 目标设备 |
|---------|---------|------|---------|
| 湿度过高排湿 | 湿度 > 85% | 开启风扇 + 开启通风机 | fan, ventilator |
| 湿度过低加湿 | 湿度 < 40% | 开启雾化器 | fogger |
| 湿度恢复正常 | 湿度 50-70% | 关闭风扇、关闭雾化器 | fan, fogger |

### 4.3 光照控制方案

| 方案名称 | 触发条件 | 动作 | 目标设备 |
|---------|---------|------|---------|
| 光照不足补光 | 光照 < 5000 Lux | 开启补光灯 | light |
| 夜间补光模式 | 时间 18:00-06:00 | 开启补光灯 50% | light |
| 光照过强遮光 | 光照 > 80000 Lux | 关闭补光灯 | light |
| 光照恢复正常 | 光照 5000-80000 Lux | 关闭补光灯 | light |

### 4.4 土壤/灌溉控制方案

| 方案名称 | 触发条件 | 动作 | 目标设备 |
|---------|---------|------|---------|
| 土壤缺水灌溉 | 土壤湿度 < 30% | 开启水泵 | water_pump |
| 土壤过湿排水 | 土壤湿度 > 80% | 关闭水泵 | water_pump |
| 定时灌溉 | 每天 06:00 | 开启水泵 10分钟 | water_pump |
| 土壤湿度正常 | 土壤湿度 30-80% | 关闭水泵 | water_pump |

### 4.5 CO2/空气质量方案

| 方案名称 | 触发条件 | 动作 | 目标设备 |
|---------|---------|------|---------|
| CO2浓度过高 | CO2 > 1500ppm | 开启通风机 | ventilator |
| CO2恢复正常 | CO2 < 1000ppm | 关闭通风机 | ventilator |
| PM2.5浓度过高 | PM2.5 > 100μg/m³ | 开启风扇 | fan |

### 4.6 综合场景方案

| 方案名称 | 触发条件 | 动作 | 目标设备 |
|---------|---------|------|---------|
| 全自动温室模式 | 综合判断 | 根据实际情况自动调节 | 多设备 |
| 节能模式 | 夜间 | 关闭非必要设备 | 多设备 |
| 暴雨预警 | 湿度↑ + 气压↓ | 关闭水泵、关闭通风机 | water_pump, ventilator |
| 高温强光保护 | 温度>35°C + 光照>80000 Lux | 开启风扇、关闭补光灯 | fan, light |

---

## 5. API 设计

### 5.1 自动化方案 CRUD API ✅

**路径**: `/api/ai/automation`

| 方法 | 功能 | 参数 | 状态 |
|------|------|------|------|
| GET | 获取方案列表 | `?device_type=fan&is_active=true&search=降温` | ✅ 已实现 |
| POST | 创建新方案 | 请求体：完整的方案 JSON | ✅ 已实现 |
| PUT | 更新方案 | `?id=1` + 请求体：要更新的字段 | ✅ 已实现 |
| DELETE | 删除方案 | `?id=1`（系统预设不可删除） | ✅ 已实现 |

**GET 响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "高温自动降温",
      "description": "当温度超过30度时，自动开启风扇和雾化器进行降温",
      "trigger_condition": "温度 > 30°C",
      "action_desc": "开启风扇并开启雾化器",
      "device_type": "fan",
      "related_sensors": ["temperature"],
      "related_actuators": ["fan", "fogger"],
      "action_type": "composite",
      "composite_actions": {
        "actions": [
          {"device_type": "fan", "action": "on", "delay_seconds": 0},
          {"device_type": "fogger", "action": "on", "delay_seconds": 5}
        ]
      },
      "priority": 10,
      "is_system": true,
      "is_active": true
    }
  ],
  "total": 1
}
```

### 5.2 AI 聊天集成增强 ✅ 已完成

**路径**: `/api/ai/chat`（已有，已增强）

增强逻辑：
1. 解析用户输入时，同时查询 `ai_automation_schemes` 表 ✅ 已实现
2. 在系统提示词中注入可用自动化方案 ✅ 已实现
3. 通过自然语言匹配找到最相关的自动化方案 ✅ 已实现（action="automation" 类型处理）
4. 在回复中推荐方案，并询问是否执行 ✅ 已实现（前端蓝色卡片 + 执行/忽略按钮）
5. 用户确认后，根据 `composite_actions` 依次下发指令 ✅ 已实现（含延迟执行、逐设备结果反馈）

---

## 6. 前端页面设计

### 6.1 自动化方案管理页面 ✅

**路径**: `/admin/ai-automation`

**功能模块**:
- 方案列表（卡片式展示，支持搜索/筛选） ✅
- 新建方案（表单：名称、描述、触发条件、动作、设备类型等） ✅
- 编辑方案（点击编辑按钮，弹出编辑对话框） ✅
- 启用/禁用开关 ✅
- 删除确认（系统预设仅可禁用，不可删除） ✅

### 6.2 AI 聊天增强 ✅ 已完成

**路径**: 仪表盘 AI 聊天面板（已有）

增强内容：
- 对话中匹配到自动化方案时，以卡片形式展示推荐方案 ✅
- 用户点击"执行"按钮后，自动下发组合指令 ✅
- 显示执行进度（多设备依次执行的状态） ✅

---

## 7. 开发计划（带进度标记）

### Phase 1：修复 light 类型冲突 ✅ 已完成
- [x] 在 `device-types.ts` 中明确区分 `light_sensor`（传感器）和 `light`（执行器）
- [x] 更新 `ai_device_knowledge` 表中 light 相关的知识条目
- [x] 更新 `ai-command-parser.ts` 中的冲突处理逻辑
- [x] 更新 `migrate-ai-knowledge.js` 脚本

### Phase 2：创建 ai_automation_schemes 表 ✅ 已完成
- [x] 编写迁移脚本 `scripts/migrate-ai-automation.js`
- [x] 创建 `ai_automation_schemes` 表
- [x] 预填充 22 条系统默认自动化方案

### Phase 3：实现自动化方案 CRUD API ✅ 已完成
- [x] 创建 `app/api/ai/automation/route.ts`
- [x] 实现 GET/POST/PUT/DELETE 方法
- [x] 添加参数校验和错误处理
- [x] 系统预设保护（不可删除）

### Phase 4：创建管理前端页面 ✅ 已完成
- [x] 创建 `app/admin/ai-automation/page.tsx`
- [x] 实现方案列表、搜索、筛选
- [x] 实现新增/编辑对话框
- [x] 实现启用/禁用/删除功能

### Phase 5：AI 聊天集成 ✅ 已完成
- [x] 在 `app/api/ai/chat/route.ts` 中集成自动化方案查询
- [x] 在系统提示词中注入自动化方案信息
- [x] 添加 `action="automation"` 动作类型处理（含 Ollama 和内置解析器降级匹配）
- [x] 实现组合动作执行（composite_actions 解析与下发，支持 composite/on/off/value 四种动作类型）
- [x] 前端 AI 聊天面板展示自动化方案推荐卡片（蓝色卡片 + 执行/忽略按钮）
- [x] 用户确认后依次执行组合动作（含延迟执行、逐设备结果反馈）

### Phase 6：端到端测试 ✅ 已完成
- [x] 测试 light 类型匹配正确性
- [x] 测试自动化方案 CRUD 功能（22条方案正常加载）
- [x] 测试 AI 聊天中的方案推荐（"降温" → 高温自动降温方案）
- [x] 测试组合动作执行（高温自动降温：风扇开启成功，雾化器报告未找到设备）

---

## 8. 版本记录

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| v1.0 | 2026-08-11 | 初始版本，制定完整开发计划 |
| v1.1 | 2026-08-11 | 更新 Phase 1-4 完成状态，详细记录已实施内容 |
| v1.2 | 2026-08-11 | Phase 5-6 全部完成，AI 自动化方案推荐与执行功能完整上线 |

---

## 9. 相关文档

- [项目说明文档](./项目说明文档.md)
- [API参考文档](./API参考文档.md)
- [硬件通信协议](./硬件通信协议.md)
- [设备数据绑定方案](./设备数据绑定方案.md)
- [AI模块升级文档](./AI模块升级文档.md)
- [测试报告](./测试报告.md)
- [AI自动化方案实施文档](./AI自动化方案实施文档.md)