import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'
import { OLLAMA_HOST, AI_CHAT_MODEL, AI_CHAT_HISTORY_LIMIT } from '@/lib/ai-config'
import { parseCommand, ActuatorSummary, KnowledgeEntry } from '@/lib/ai-command-parser'
import { createLogger } from '@/lib/logger';

const log = createLogger('AIChat');

/**
 * 执行器记录接口（从数据库 actuators 表获取）
 */
interface ActuatorRecord extends RowDataPacket {
  id: string
  name: string
  type: string
  state: string
  mode: string
  status: string
  locked: number
  control_type: string | null
  location: string
  area: string
}

/**
 * AI 解析的命令结构
 */
interface ParsedCommand {
  action: 'on' | 'off' | 'value' | 'query' | 'none' | 'automation' | 'execute_automation'
  actuatorId: string
  actuatorType: string
  controlType: string | null
  controlValue?: number
  automationId?: number
  automationScheme?: {
    id: number
    name: string
    description: string
    action_desc: string
    composite_actions?: any
    action_type: string
  }
  parameters?: Record<string, any>
  reply: string
}

/**
 * AI 聊天接口（v2.2.2 知识库集成版）
 * POST /api/ai/chat
 *
 * 功能：
 * 1. 解析用户自然语言命令，匹配执行器
 * 2. 自动下发控制命令到 /api/actuators/[id]/commands
 * 3. 持久化聊天历史到 ai_chat_history 表
 *
 * 请求体: { message: string, actuators?: Actuator[] }
 * 返回: { success, data: { response, commandInfo, executionResult } }
 */
export async function POST(request: NextRequest) {
  // 初始化默认值，避免变量未定义
  let commandInfo: ParsedCommand = {
    action: 'none',
    actuatorId: '',
    actuatorType: '',
    controlType: '',
    reply: 'AI 服务暂不可用，请稍后重试或直接在控制面板操作设备。',
  }
  let executionResult: { success: boolean; message: string; command_id?: number } = {
    success: true,
    message: '无需执行设备操作',
  }

  try {
    const body = await request.json()
    const { message, action: bodyAction, automationId: bodyAutomationId } = body

    if (!message || !message.trim()) {
      return NextResponse.json({ success: false, error: '缺少消息内容' }, { status: 400 })
    }

    // 如果请求体直接指定了 execute_automation 动作，跳过 AI 解析
    const isDirectExecution = bodyAction === 'execute_automation' && bodyAutomationId

    // 从数据库获取最新执行器列表（确保 AI 能匹配到实际存在的设备）
    let actuators: ActuatorRecord[] = []
    let actuatorsInfo: any[] = []

    try {
      actuators = await db.query<ActuatorRecord[]>(
        `SELECT a.id, a.name, at.type, a.state, a.mode, a.status, a.locked, a.control_type, a.location, a.area
         FROM actuators a
         INNER JOIN actuator_types at ON a.type_id = at.id
         WHERE a.status != 'deleted'
         ORDER BY a.id`
      )

      actuatorsInfo = actuators.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        state: a.state,
        control_type: a.control_type,
        location: a.location,
        area: a.area,
      }))
    } catch (dbErr) {
      log.error('数据库查询执行器失败:', dbErr instanceof Error ? dbErr.message : dbErr)
      // 数据库不可用时仍可提供基本的 AI 对话（不依赖执行器列表）
    }

    // 查询 AI 知识库（用于增强命令解析精度）
    let knowledgeEntries: KnowledgeEntry[] = []
    let knowledgeQueryTime = 0
    try {
      const t0 = Date.now()
      const rawKnowledge = await db.query<RowDataPacket[]>(
        `SELECT * FROM ai_device_knowledge WHERE is_active = 1 ORDER BY priority DESC, id ASC`
      )
      knowledgeQueryTime = Date.now() - t0
      // 解析 JSON 字段
      knowledgeEntries = rawKnowledge.map((row: any) => ({
        id: row.id,
        target_type: row.target_type,
        device_type: row.device_type,
        device_id: row.device_id || undefined,
        keywords: typeof row.keywords === 'string' ? JSON.parse(row.keywords) : row.keywords,
        actions: typeof row.actions === 'string' ? JSON.parse(row.actions) : row.actions,
        parameters: row.parameters
          ? (typeof row.parameters === 'string' ? JSON.parse(row.parameters) : row.parameters)
          : null,
        description: row.description || '',
        note: row.note || undefined,
        priority: row.priority || 0,
        is_system: !!row.is_system,
        is_active: !!row.is_active,
      }))
      log.info(`知识库加载完成: ${knowledgeEntries.length} 条 (${knowledgeQueryTime}ms)`)
    } catch (kbErr) {
      log.warn('知识库查询失败，使用降级硬编码:', kbErr instanceof Error ? kbErr.message : kbErr)
      // 知识库不可用时，parseCommand 会自动降级到硬编码关键词
    }

    // 查询 AI 自动化方案（用于智能推荐）
    let automationSchemes: any[] = []
    try {
      const rawSchemes = await db.query<RowDataPacket[]>(
        `SELECT id, name, description, trigger_condition, action_desc, device_type,
                related_sensors, related_actuators, action_type, composite_actions, priority
         FROM ai_automation_schemes WHERE is_active = 1 ORDER BY priority DESC`
      )
      automationSchemes = rawSchemes.map((row: any) => ({
        ...row,
        related_sensors: typeof row.related_sensors === 'string' ? JSON.parse(row.related_sensors) : row.related_sensors,
        related_actuators: typeof row.related_actuators === 'string' ? JSON.parse(row.related_actuators) : row.related_actuators,
        composite_actions: typeof row.composite_actions === 'string' ? JSON.parse(row.composite_actions) : row.composite_actions,
      }))
      log.info(`自动化方案加载完成: ${automationSchemes.length} 条`)
    } catch (schemeErr) {
      log.warn('自动化方案查询失败:', schemeErr instanceof Error ? schemeErr.message : schemeErr)
    }

    const systemPrompt = `你是智慧农业物联网平台的 AI 助手，负责解析用户的自然语言命令并转换为设备控制指令。

可用执行器列表：${JSON.stringify(actuatorsInfo)}

可用自动化方案：${JSON.stringify(automationSchemes.map((s: any) => ({ name: s.name, trigger: s.trigger_condition, action: s.action_desc, device: s.device_type, priority: s.priority })))}

请按以下 JSON 格式输出：
{
  "action": "on" | "off" | "value" | "query" | "none" | "automation",
  "actuatorId": "执行器ID（仅 on/off/value 需要）",
  "actuatorType": "执行器类型（如 water_pump, fan, light, camera, valve, heater 等）",
  "controlType": "控制类型（boolean/integer/angle/float/rgb/camera）",
  "controlValue": 数值控制值（仅 value 类型需要）,
  "automationId": 自动化方案ID（仅 action=automation 时需要，填入对应的方案id数字）,
  "reply": "对用户的回复文本"
}

规则：
1. 只输出 JSON 格式，不要包含其他文字
2. 问候/闲聊时 action=none，actuatorId 为空，reply 给出友好回复
3. 控制命令必须匹配列表中的执行器
4. on/off 命令 action 值对应为 "on"/"off"
5. 数值调节命令 action 为 "value"，需提供 controlValue
6. 摄像头命令 action 为 "on"/"off"/"value"，controlType 为 "camera"
7. 当用户描述的场景匹配某个自动化方案时，action="automation"，automationId 填对应方案id
8. 同一场景匹配多个方案时，选择优先级（priority）最高的那个`

    const ollamaHost = OLLAMA_HOST
    const apiUrl = `${ollamaHost}/api/chat`

    let aiResponse = '{"action":"none","actuatorId":"","actuatorType":"","controlType":"","reply":"抱歉，我无法解析您的命令。"}'
    let ollamaAvailable = false

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: AI_CHAT_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          stream: false,
        }),
        signal: AbortSignal.timeout(30000),
      })

      if (!response.ok) {
        throw new Error(`Ollama API 错误: ${response.status}`)
      }

      const result = await response.json()
      aiResponse = result.message?.content || aiResponse
      ollamaAvailable = true
    } catch (err) {
      log.warn('Ollama 不可用，使用内置规则解析器:', err instanceof Error ? err.message : err)
      // Ollama 不可用，使用内置规则解析器
    }

    // 解析 AI 响应
    if (isDirectExecution) {
      // 直接执行模式：跳过 AI 解析，直接设置 action
      commandInfo = {
        action: 'execute_automation',
        actuatorId: '',
        actuatorType: '',
        controlType: '',
        automationId: bodyAutomationId,
        reply: '正在执行自动化方案...',
      }
    } else if (ollamaAvailable) {
      // Ollama 路径：解析 LLM 返回的 JSON
      try {
        const cleanedResponse = aiResponse
          .replace(/```json\s*/g, '')
          .replace(/```\s*/g, '')
          .trim()
        commandInfo = JSON.parse(cleanedResponse)
      } catch {
        commandInfo = {
          action: 'none',
          actuatorId: '',
          actuatorType: '',
          controlType: '',
          reply: '抱歉，我无法解析您的命令，请尝试使用更明确的设备控制指令。',
        }
      }
    } else {
      // 降级路径：使用内置规则解析器（传入知识库增强匹配精度）
      const parsed = parseCommand(
        message,
        actuatorsInfo as ActuatorSummary[],
        knowledgeEntries.length > 0 ? knowledgeEntries : undefined
      )
      log.info(`解析器结果: action=${parsed.action}, actuatorId=${parsed.actuatorId}, type=${parsed.actuatorType}, reply=${parsed.reply.substring(0, 50)}`)
      commandInfo = {
        action: parsed.action,
        actuatorId: parsed.actuatorId,
        actuatorType: parsed.actuatorType,
        controlType: parsed.controlType,
        controlValue: parsed.controlValue,
        reply: parsed.reply,
      }
    }

    // 二次验证：匹配的执行器必须在列表中
    // 内置解析器降级：当解析器返回 none 时，尝试匹配自动化方案
    if (commandInfo.action === 'none' && automationSchemes.length > 0) {
      const msg = message.toLowerCase()
      /**
       * 中文关键词匹配：从消息中提取2-4字片段，与方案关键词进行子串匹配
       * 同时支持双向匹配：消息片段在方案中，方案关键词在消息中
       */
      const matchedScheme = automationSchemes.find((s: any) => {
        const keywords = [
          s.name || '',
          s.description || '',
          s.trigger_condition || '',
          s.action_desc || '',
        ].join(' ').toLowerCase()
        // 从消息中提取所有2-4字连续片段
        for (let len = 4; len >= 2; len--) {
          for (let i = 0; i <= msg.length - len; i++) {
            const fragment = msg.substring(i, i + len)
            if (keywords.includes(fragment)) return true
          }
        }
        // 反向：方案名称中的2-4字片段是否在消息中
        const schemeName = (s.name || '').toLowerCase()
        for (let len = 4; len >= 2; len--) {
          for (let i = 0; i <= schemeName.length - len; i++) {
            const fragment = schemeName.substring(i, i + len)
            if (msg.includes(fragment)) return true
          }
        }
        return false
      })
      if (matchedScheme) {
        log.info(`降级匹配自动化方案: ${matchedScheme.name} (id=${matchedScheme.id})`)
        commandInfo = {
          action: 'automation',
          actuatorId: '',
          actuatorType: '',
          controlType: '',
          automationId: matchedScheme.id,
          reply: `检测到您可能需要「${matchedScheme.name}」方案：${matchedScheme.action_desc}。是否执行？`,
        }
      }
    }

    // 二次验证：匹配的执行器必须在列表中
    if (commandInfo.action !== 'none' && commandInfo.action !== 'automation' && commandInfo.action !== 'execute_automation' && actuators.length > 0) {
      const matched = actuators.find((a) => a.id === commandInfo.actuatorId)
      if (!matched) {
        commandInfo = {
          action: 'none',
          actuatorId: '',
          actuatorType: '',
          controlType: '',
          reply: `抱歉，未找到名为"${commandInfo.actuatorId}"的设备。您可以使用以下设备：${actuators.map((a) => a.name).join('、')}`,
        }
      } else {
        commandInfo.controlType = matched.control_type || commandInfo.controlType
        commandInfo.actuatorType = matched.type
      }
    }

    // 处理自动化方案推荐（action=automation，仅返回方案信息，不执行）
    if (commandInfo.action === 'automation' && commandInfo.automationId) {
      const scheme = automationSchemes.find((s: any) => s.id === commandInfo.automationId)
      if (scheme) {
        commandInfo.automationScheme = {
          id: scheme.id,
          name: scheme.name,
          description: scheme.description,
          action_desc: scheme.action_desc,
          composite_actions: scheme.composite_actions,
          action_type: scheme.action_type,
        }
        executionResult = {
          success: true,
          message: '自动化方案已推荐，等待用户确认执行',
        }
      } else {
        commandInfo.action = 'none'
        commandInfo.reply = '抱歉，未找到匹配的自动化方案。'
        executionResult = { success: false, message: '自动化方案不存在' }
      }
    }

    // 执行自动化方案（action=execute_automation，执行组合动作）
    if (commandInfo.action === 'execute_automation' && commandInfo.automationId) {
      const scheme = automationSchemes.find((s: any) => s.id === commandInfo.automationId)
      if (!scheme) {
        executionResult = { success: false, message: '自动化方案不存在' }
      } else {
        const results: { device_type: string; success: boolean; message: string }[] = []
        commandInfo.reply = `正在执行「${scheme.name}」方案...`

        if (scheme.action_type === 'composite' && scheme.composite_actions?.actions) {
          // 组合动作：依次执行每个子动作
          for (const action of scheme.composite_actions.actions) {
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
            try {
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
            } catch (execErr) {
              results.push({
                device_type: scheme.device_type,
                success: false,
                message: `执行异常: ${execErr instanceof Error ? execErr.message : '未知错误'}`,
              })
            }
          } else {
            results.push({
              device_type: scheme.device_type,
              success: false,
              message: `未找到 ${scheme.device_type} 类型的执行器`,
            })
          }
        } else if (scheme.action_type === 'value') {
          // 数值控制
          const targetActuator = actuators.find((a) => a.type === scheme.device_type)
          if (targetActuator) {
            try {
              const cmdBody: Record<string, any> = {
                control_type: 'integer',
                command: 'value',
                value: scheme.action_value,
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
            } catch (execErr) {
              results.push({
                device_type: scheme.device_type,
                success: false,
                message: `执行异常: ${execErr instanceof Error ? execErr.message : '未知错误'}`,
              })
            }
          }
        }

        const allSuccess = results.length > 0 && results.every((r) => r.success)
        executionResult = {
          success: allSuccess,
          message: results.map((r) => r.message).join('；'),
          results,
        } as any
        commandInfo.reply = allSuccess
          ? `「${scheme.name}」方案执行完成：${executionResult.message}`
          : `「${scheme.name}」方案部分执行失败：${executionResult.message}`
      }
    }

    // 实际执行命令（如果是有效控制命令，query 动作仅返回状态不执行）
    if (commandInfo.action !== 'none' && commandInfo.action !== 'query' && commandInfo.action !== 'automation' && commandInfo.action !== 'execute_automation' && commandInfo.actuatorId) {
      try {
        const cmdBody: Record<string, any> = {
          control_type: commandInfo.controlType || 'boolean',
          command: commandInfo.action,
        }
        if (commandInfo.action === 'value' && commandInfo.controlValue !== undefined) {
          cmdBody.value = commandInfo.controlValue
        }

        const cmdRes = await fetch(
          `http://localhost:3000/api/actuators/${commandInfo.actuatorId}/commands`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cmdBody),
            signal: AbortSignal.timeout(5000),
          }
        )
        const cmdResult = await cmdRes.json()
        executionResult = {
          success: cmdResult.success === true,
          message: cmdResult.success ? '命令已下发' : (cmdResult.error || '命令下发失败'),
          command_id: cmdResult.data?.id,
        }
      } catch (execErr) {
        log.error('命令执行异常:', execErr instanceof Error ? execErr.message : execErr)
        executionResult = {
          success: false,
          message: `命令执行异常: ${execErr instanceof Error ? execErr.message : '未知错误'}`,
        }
      }
    }

    // 持久化聊天历史
    try {
      await db.execute(
        `INSERT INTO ai_chat_history (user_message, ai_response, action, actuator_id, control_value, execution_status, model)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          message,
          commandInfo.reply,
          commandInfo.action,
          commandInfo.actuatorId || null,
          commandInfo.controlValue ?? null,
          executionResult.success ? 'success' : 'failed',
          AI_CHAT_MODEL,
        ]
      )
      // 清理历史记录（保留最近 N 条）
      await db.execute(
        `DELETE FROM ai_chat_history WHERE id NOT IN (
           SELECT id FROM (SELECT id FROM ai_chat_history ORDER BY id DESC LIMIT ?) AS recent
         )`,
        [AI_CHAT_HISTORY_LIMIT]
      )
    } catch (dbErr) {
      log.warn('聊天历史保存失败（表可能不存在）:', dbErr instanceof Error ? dbErr.message : dbErr)
    }

    return NextResponse.json({
      success: true,
      data: {
        response: commandInfo.reply,
        commandInfo,
        executionResult,
      },
    })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '未知错误'
    log.error('未捕获异常:', errMsg, error)
    // 即使发生未捕获异常，也返回降级响应而非 500 错误
    return NextResponse.json({
      success: true,
      data: {
        response: '系统处理您的请求时遇到问题，请稍后重试。',
        commandInfo: {
          action: 'none' as const,
          actuatorId: '',
          actuatorType: '',
          controlType: '',
          reply: '系统处理您的请求时遇到问题，请稍后重试。',
        },
        executionResult: {
          success: false,
          message: `服务异常: ${errMsg}`,
        },
      },
    })
  }
}

/**
 * GET /api/ai/chat
 * 获取聊天历史记录
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

    const rows = await db.query<RowDataPacket[]>(
      'SELECT id, user_message, ai_response, action, actuator_id, control_value, execution_status, model, created_at FROM ai_chat_history ORDER BY id DESC LIMIT ?',
      [limit]
    )

    return NextResponse.json({ success: true, data: { history: rows, total: rows.length } })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '获取聊天历史失败' },
      { status: 500 }
    )
  }
}
