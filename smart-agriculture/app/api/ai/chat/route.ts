import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'
import { OLLAMA_HOST, AI_CHAT_MODEL, AI_CHAT_HISTORY_LIMIT } from '@/lib/ai-config'

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
  action: 'on' | 'off' | 'value' | 'query' | 'none'
  actuatorId: string
  actuatorType: string
  controlType: string | null
  controlValue?: number
  parameters?: Record<string, any>
  reply: string
}

/**
 * AI 聊天接口
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
  try {
    const body = await request.json()
    const { message } = body

    if (!message || !message.trim()) {
      return NextResponse.json({ success: false, error: '缺少消息内容' }, { status: 400 })
    }

    // 从数据库获取最新执行器列表（确保 AI 能匹配到实际存在的设备）
    const actuators = await db.query<ActuatorRecord[]>(
      `SELECT id, name, type, state, mode, status, locked, control_type, location, area
       FROM actuators
       WHERE status != 'deleted'
       ORDER BY id`
    )

    const actuatorsInfo = actuators.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      state: a.state,
      control_type: a.control_type,
      location: a.location,
      area: a.area,
    }))

    const systemPrompt = `你是智慧农业物联网平台的 AI 助手，负责解析用户的自然语言命令并转换为设备控制指令。

可用执行器列表：${JSON.stringify(actuatorsInfo)}

请按以下 JSON 格式输出：
{
  "action": "on" | "off" | "value" | "query" | "none",
  "actuatorId": "执行器ID",
  "actuatorType": "执行器类型（如 water_pump, fan, light, camera, valve, heater 等）",
  "controlType": "控制类型（boolean/integer/angle/float/rgb/camera）",
  "controlValue": 数值控制值（仅 value 类型需要）,
  "reply": "对用户的回复文本"
}

规则：
1. 只输出 JSON 格式，不要包含其他文字
2. 问候/闲聊时 action=none，actuatorId 为空，reply 给出友好回复
3. 控制命令必须匹配列表中的执行器
4. on/off 命令 action 值对应为 "on"/"off"
5. 数值调节命令 action 为 "value"，需提供 controlValue
6. 摄像头命令 action 为 "on"/"off"/"value"，controlType 为 "camera"`

    const ollamaHost = OLLAMA_HOST
    const apiUrl = `${ollamaHost}/api/chat`

    let aiResponse = '{"action":"none","actuatorId":"","actuatorType":"","controlType":"","reply":"抱歉，我无法解析您的命令。"}'

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
    } catch (err) {
      console.error('[AI Chat] Ollama 调用失败:', err)
      // Ollama 不可用时返回降级响应
      aiResponse = JSON.stringify({
        action: 'none',
        actuatorId: '',
        actuatorType: '',
        controlType: '',
        reply: 'AI 服务暂不可用，请稍后重试或直接在控制面板操作设备。',
      })
    }

    // 解析 AI 响应
    let commandInfo: ParsedCommand
    try {
      // 尝试清理可能的 markdown 包裹
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

    // 二次验证：匹配的执行器必须在列表中
    if (commandInfo.action !== 'none') {
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

    // 实际执行命令（如果是有效控制命令）
    let executionResult: { success: boolean; message: string; command_id?: number }

    if (commandInfo.action !== 'none' && commandInfo.actuatorId) {
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
        executionResult = {
          success: false,
          message: `命令执行异常: ${execErr instanceof Error ? execErr.message : '未知错误'}`,
        }
      }
    } else {
      executionResult = {
        success: true,
        message: '无需执行设备操作',
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
      console.warn('[AI Chat] 聊天历史保存失败（表可能不存在）:', dbErr instanceof Error ? dbErr.message : dbErr)
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
    console.error('[AI Chat] 错误:', error)
    return NextResponse.json(
      { success: false, error: 'AI 聊天接口错误', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
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
