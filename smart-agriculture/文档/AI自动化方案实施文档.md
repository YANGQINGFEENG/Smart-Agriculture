# AI 自动化方案实施文档

## 更新日期：2026-08-11

---

## 1. 概述

本文档详细描述 AI 自动化方案系统的实施细节，包括已完成部分的技术实现和新功能的开发指南。

### 1.1 已完成模块

| 模块 | 文件 | 状态 |
|------|------|------|
| 数据库迁移 | `scripts/migrate-ai-automation.js` | ✅ 已完成 |
| CRUD API | `app/api/ai/automation/route.ts` | ✅ 已完成 |
| 管理页面 | `app/admin/ai-automation/page.tsx` | ✅ 已完成 |
| 方案查询注入 | `app/api/ai/chat/route.ts`（部分） | 🚧 进行中 |

### 1.2 待完成模块

| 模块 | 涉及文件 | 优先级 |
|------|---------|--------|
| automation 动作类型处理 | `app/api/ai/chat/route.ts` | 🔴 高 |
| 组合动作执行器 | `app/api/ai/chat/route.ts`（新增逻辑） | 🔴 高 |
| 前端方案推荐卡片 | `components/dashboard/ai-command-control.tsx` | 🟡 中 |
| 端到端测试 | 测试脚本 | 🟡 中 |

---

## 2. 数据库设计

### 2.1 `ai_automation_schemes` 表

```sql
CREATE TABLE IF NOT EXISTS ai_automation_schemes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  trigger_condition TEXT,
  action_desc TEXT NOT NULL,
  device_type VARCHAR(50) NOT NULL,
  related_sensors JSON,
  related_actuators JSON,
  action_type ENUM('on','off','value','composite') DEFAULT 'on',
  action_value DECIMAL(10,2),
  action_unit VARCHAR(20),
  composite_actions JSON,
  priority INT DEFAULT 0,
  is_system TINYINT(1) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_device_type (device_type),
  INDEX idx_priority (priority DESC),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2.2 数据迁移

迁移脚本位于 `scripts/migrate-ai-automation.js`，执行方式：

```bash
cd e:\tghy\smart-agriculture
node scripts/migrate-ai-automation.js
```

预设 22 条系统方案，覆盖温度、湿度、光照、灌溉、CO2、综合场景六大类。

---

## 3. API 设计

### 3.1 自动化方案 CRUD API

**路径**: `/api/ai/automation`

#### GET - 获取方案列表

```
GET /api/ai/automation?device_type=fan&action_type=composite&search=降温&limit=20
```

**响应**:
```json
{
  "success": true,
  "data": [...],
  "total": 22
}
```

#### POST - 创建方案

```json
{
  "name": "自定义方案",
  "description": "方案描述",
  "trigger_condition": "温度 > 28°C",
  "action_desc": "开启风扇",
  "device_type": "fan",
  "related_sensors": ["temperature"],
  "related_actuators": ["fan"],
  "action_type": "on",
  "priority": 5
}
```

#### PUT - 更新方案

```
PUT /api/ai/automation?id=1
```

#### DELETE - 删除方案

```
DELETE /api/ai/automation?id=1
```
> 系统预设方案（is_system=1）返回 403 禁止删除

### 3.2 AI 聊天集成 API（增强）

**路径**: `/api/ai/chat`

#### 新增 action 类型：`automation`

当 AI 判断用户意图匹配某个自动化方案时，返回：
```json
{
  "action": "automation",
  "automationId": 1,
  "reply": "检测到温室温度较高，推荐执行「高温自动降温」方案：开启风扇 + 开启雾化器。是否执行？"
}
```

#### 新增 action 类型：`composite`

前端确认执行后，再次调用 API 下发组合动作：
```json
{
  "action": "composite",
  "automationId": 1,
  "reply": "正在执行「高温自动降温」方案..."
}
```

---

## 4. 后端实现

### 4.1 系统提示词增强

在 `app/api/ai/chat/route.ts` 的 `systemPrompt` 中：

```typescript
const systemPrompt = `你是智慧农业物联网平台的 AI 助手...

可用执行器列表：${JSON.stringify(actuatorsInfo)}

可用自动化方案：${JSON.stringify(automationSchemes.map(s => ({
  id: s.id,
  name: s.name,
  trigger: s.trigger_condition,
  action: s.action_desc,
  device: s.device_type,
  priority: s.priority
})))}

请按以下 JSON 格式输出：
{
  "action": "on" | "off" | "value" | "query" | "none" | "automation",
  "actuatorId": "执行器ID（仅 on/off/value 需要）",
  "actuatorType": "执行器类型",
  "controlType": "控制类型",
  "controlValue": 数值控制值（仅 value 需要）,
  "automationId": 自动化方案ID（仅 automation 需要）,
  "reply": "对用户的回复文本"
}

规则：
1. 只输出 JSON 格式
2. 当用户描述的场景匹配某个自动化方案时，action="automation"，automationId 填方案ID
3. 同一场景可能匹配多个方案时，选择优先级最高的
4. 问候/闲聊时 action="none"
5. 控制命令必须匹配列表中的执行器`
```

### 4.2 automation 动作处理

在 `app/api/ai/chat/route.ts` 的命令执行逻辑中，新增对 `action === 'automation'` 的处理：

```typescript
// 处理自动化方案推荐（仅返回方案信息，不执行）
if (commandInfo.action === 'automation' && commandInfo.automationId) {
  const scheme = automationSchemes.find((s: any) => s.id === commandInfo.automationId)
  if (scheme) {
    commandInfo = {
      ...commandInfo,
      action: 'automation',
      automationScheme: {
        id: scheme.id,
        name: scheme.name,
        description: scheme.description,
        action_desc: scheme.action_desc,
        composite_actions: scheme.composite_actions,
        action_type: scheme.action_type,
      },
    }
    executionResult = {
      success: true,
      message: '自动化方案已推荐，等待用户确认执行',
    }
  }
}
```

### 4.3 组合动作执行

当用户确认执行自动化方案后，前端发送 `action: 'execute_automation'`：

```typescript
// 执行自动化方案（组合动作）
if (commandInfo.action === 'execute_automation' && commandInfo.automationId) {
  const scheme = automationSchemes.find((s: any) => s.id === commandInfo.automationId)
  if (!scheme) {
    executionResult = { success: false, message: '自动化方案不存在' }
  } else {
    const results: { device_type: string; success: boolean; message: string }[] = []

    if (scheme.action_type === 'composite' && scheme.composite_actions?.actions) {
      for (const action of scheme.composite_actions.actions) {
        // 按 device_type 查找匹配的执行器
        const targetActuator = actuators.find(
          (a) => a.type === action.device_type
        )
        if (!targetActuator) {
          results.push({
            device_type: action.device_type,
            success: false,
            message: `未找到 ${action.device_type} 类型的执行器`,
          })
          continue
        }

        // 延迟执行
        if (action.delay_seconds > 0) {
          await new Promise((r) => setTimeout(r, action.delay_seconds * 1000))
        }

        try {
          const cmdBody: Record<string, any> = {
            control_type: 'boolean',
            command: action.action,
          }
          if (action.value !== null && action.value !== undefined) {
            cmdBody.value = action.value
          }

          const cmdRes = await fetch(
            `http://localhost:3000/api/actuators/${targetActuator.id}/commands`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(cmdBody),
              signal: AbortSignal.timeout(5000),
            }
          )
          const cmdResult = await cmdRes.json()
          results.push({
            device_type: action.device_type,
            success: cmdResult.success === true,
            message: cmdResult.success
              ? `${targetActuator.name} 已${action.action === 'on' ? '开启' : '关闭'}`
              : (cmdResult.error || '命令下发失败'),
          })
        } catch (execErr) {
          results.push({
            device_type: action.device_type,
            success: false,
            message: `执行异常: ${execErr instanceof Error ? execErr.message : '未知错误'}`,
          })
        }
      }
    } else if (scheme.action_type === 'on' || scheme.action_type === 'off') {
      // 单一动作
      const targetActuator = actuators.find((a) => a.type === scheme.device_type)
      if (targetActuator) {
        const cmdBody: Record<string, any> = {
          control_type: 'boolean',
          command: scheme.action_type,
        }
        if (scheme.action_value !== null) {
          cmdBody.value = scheme.action_value
        }
        const cmdRes = await fetch(
          `http://localhost:3000/api/actuators/${targetActuator.id}/commands`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cmdBody),
            signal: AbortSignal.timeout(5000),
          }
        )
        const cmdResult = await cmdRes.json()
        results.push({
          device_type: scheme.device_type,
          success: cmdResult.success === true,
          message: cmdResult.success ? '命令已下发' : (cmdResult.error || '命令下发失败'),
        })
      }
    }

    executionResult = {
      success: results.every((r) => r.success),
      message: results.map((r) => r.message).join('；'),
      results,
    }
  }
}
```

---

## 5. 前端实现

### 5.1 AI 聊天面板增强

需要在 `components/dashboard/ai-command-control.tsx` 中新增：

#### 5.1.1 自动化方案推荐卡片

当 AI 返回 `action: 'automation'` 时，展示方案推荐卡片：

```tsx
// 自动化方案推荐卡片
{commandInfo?.action === 'automation' && commandInfo?.automationScheme && (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
    <div className="flex items-center gap-2 mb-2">
      <Zap className="h-4 w-4 text-blue-600" />
      <span className="font-semibold text-blue-800">
        {commandInfo.automationScheme.name}
      </span>
    </div>
    <p className="text-sm text-blue-700 mb-2">
      {commandInfo.automationScheme.action_desc}
    </p>
    <div className="flex gap-2">
      <Button
        size="sm"
        onClick={() => handleExecuteAutomation(commandInfo.automationScheme.id)}
      >
        执行方案
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {/* 忽略 */}}
      >
        忽略
      </Button>
    </div>
  </div>
)}
```

#### 5.1.2 执行自动化方案

```tsx
const handleExecuteAutomation = async (automationId: number) => {
  setAiLoading(true)
  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `执行自动化方案 ${automationId}`,
        action: 'execute_automation',
        automationId,
      }),
    })
    const result = await response.json()
    if (result.success) {
      // 处理执行结果
      setExecutionResult(result.data.executionResult)
    }
  } catch (error) {
    setAiError('执行自动化方案失败')
  } finally {
    setAiLoading(false)
  }
}
```

### 5.2 执行进度展示

```tsx
// 执行结果展示
{executionResult?.results && (
  <div className="mt-2 space-y-1">
    {executionResult.results.map((r: any, i: number) => (
      <div key={i} className="flex items-center gap-2 text-sm">
        {r.success ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <X className="h-4 w-4 text-red-500" />
        )}
        <span>{r.message}</span>
      </div>
    ))}
  </div>
)}
```

---

## 6. 测试计划

### 6.1 单元测试（API 级别）

```bash
# 测试自动化方案 CRUD
curl http://localhost:3000/api/ai/automation
curl -X POST http://localhost:3000/api/ai/automation -H "Content-Type: application/json" -d "{...}"
curl -X PUT "http://localhost:3000/api/ai/automation?id=1" -H "Content-Type: application/json" -d "{...}"
curl -X DELETE "http://localhost:3000/api/ai/automation?id=1"

# 测试 AI 聊天（自动化方案推荐）
curl -X POST http://localhost:3000/api/ai/chat -H "Content-Type: application/json" -d '{"message":"温室太热了，帮我降温"}'

# 测试组合动作执行
curl -X POST http://localhost:3000/api/ai/chat -H "Content-Type: application/json" -d '{"message":"执行自动化方案 1","action":"execute_automation","automationId":1}'
```

### 6.2 端到端测试场景

| 场景 | 用户输入 | 预期结果 |
|------|---------|---------|
| 方案推荐 | "温室太热了" | 推荐「高温自动降温」方案 |
| 方案确认 | 点击"执行方案" | 依次开启风扇和雾化器 |
| 单设备方案 | "温度低了" | 推荐「低温自动供暖」方案，执行开启加热器 |
| 数值控制方案 | "光线不够" | 推荐「光照不足补光」方案 |
| 综合场景 | "进入节能模式" | 推荐「节能模式」方案 |
| 无匹配方案 | "今天天气怎么样" | action=none，友好回复 |
| 系统预设保护 | 删除系统方案 | 返回 403 错误 |

---

## 7. 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `app/api/ai/chat/route.ts` | 修改 | 新增 automation/composite 动作类型处理 |
| `components/dashboard/ai-command-control.tsx` | 修改 | 新增方案推荐卡片和执行逻辑 |
| `文档/AI自动化方案开发计划.md` | 更新 | 更新进度标记 |
| `文档/AI自动化方案实施文档.md` | 新建 | 本文档 |

---

## 8. 注意事项

1. **Ollama 降级**：当 Ollama 不可用时，内置解析器 `parseCommand()` 无法识别"自动化方案"意图，需要额外添加降级匹配逻辑
2. **设备匹配**：组合动作执行时，按 `device_type` 匹配执行器，需要确保数据库中执行器已正确注册
3. **并发控制**：组合动作中的 `delay_seconds` 通过 `setTimeout` 实现，需注意超时时间
4. **错误处理**：部分子动作失败时不影响其他子动作的执行，最终结果汇总展示
5. **系统预设保护**：`is_system=1` 的方案不可删除，仅可禁用

---

## 9. 版本记录

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| v1.0 | 2026-08-11 | 初始版本，完整实施文档 |