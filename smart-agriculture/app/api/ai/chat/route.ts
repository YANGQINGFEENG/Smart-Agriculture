import { NextRequest, NextResponse } from 'next/server'

/**
 * 执行器类型定义
 */
type ActuatorType = 'irrigation' | 'ventilation' | 'shading' | 'heating' | 'cooling' | 'none'

/**
 * 命令类型定义
 */
interface Command {
  action: 'turn_on' | 'turn_off' | 'set' | 'query' | 'none'
  actuatorId: string
  actuatorType: ActuatorType
  parameters?: {
    temperature?: number
    humidity?: number
    duration?: number
    interval?: number
    time?: string
  }
  timestamp: string
  reply?: string
}

/**
 * AI 聊天接口
 * 用于与大语言模型进行通信
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, actuators } = body

    if (!message) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      )
    }

    // 构建系统提示词
    const systemPrompt = '你是一个智慧农业物联网平台的 AI 助手，负责解析用户的自然语言命令并转换为设备控制指令。'

    const formatPrompt = '请按照以下格式输出：{"action": "turn_on" | "turn_off" | "set" | "query" | "none", "actuatorId": "执行器ID或空字符串", "actuatorType": "irrigation" | "ventilation" | "shading" | "heating" | "cooling" | "none", "parameters": {}, "timestamp": "ISO时间字符串", "reply": "对用户的回复文本"}'

    const notesPrompt = '注意：1. 只输出 JSON 格式，不要包含其他文字 2. 如果用户只是问候、闲聊或没有明确的设备控制意图，action 必须设为 "none"，actuatorId 设为空字符串，actuatorType 设为 "none"，并在 reply 中给出友好的回复 3. 只有当用户明确提到要控制某个设备时，才输出具体的 action 和执行器信息 4. 问候语如"你好"、"您好"、"嗨"、"Hello"等应返回 action 为 "none" 5. 根据用户命令和执行器列表，选择合适的执行器 6. 如果无法解析命令，返回 action 为 "none" 并在 reply 中说明'

    const greetingWords = ['你好', '您好', '嗨', 'hello', 'hi', '哈喽', '早安', '晚安', '早上好', '晚上好', '下午好', '谢谢', '感谢', '拜拜', '再见']

    const isGreeting = greetingWords.some(word =>
      message.toLowerCase().includes(word.toLowerCase())
    ) && message.length < 20

    // 构建执行器信息
    const actuatorsInfo = actuators ? JSON.stringify(actuators) : '[]'

    // 如果是问候语，直接返回，不调用AI
    if (isGreeting) {
      const greetingReply = '您好！我是智慧农业物联网平台的AI助手。请问您需要控制哪些设备？比如：打开灌溉系统、关闭通风设备等。'
      return NextResponse.json({
        success: true,
        data: {
          response: JSON.stringify({
            action: 'none',
            actuatorId: '',
            actuatorType: 'none',
            timestamp: new Date().toISOString(),
            reply: greetingReply
          }),
          commandInfo: {
            action: 'none',
            actuatorId: '',
            actuatorType: 'none',
            timestamp: new Date().toISOString(),
            reply: greetingReply
          },
          executionResult: {
            success: true,
            message: '已识别为问候语，无需执行设备操作',
            command: {
              action: 'none',
              actuatorId: '',
              actuatorType: 'none',
              timestamp: new Date().toISOString(),
              reply: greetingReply
            }
          }
        }
      })
    }

    // 调用大语言模型 API
    const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434'
    const apiUrl = `${ollamaHost}/api/chat`
    const requestBody = {
      model: 'qwen3:1.7b-q4_K_M',
      messages: [
        {
          role: 'system',
          content: systemPrompt + ' ' + formatPrompt + ' ' + notesPrompt + ' 执行器列表: ' + actuatorsInfo
        },
        {
          role: 'user',
          content: message
        }
      ],
      stream: false
    }

    console.log('AI 聊天接口 - 调用 OLLAMA API:', {
      url: apiUrl,
      body: requestBody,
      host: ollamaHost
    })

    let aiResponse = '无法解析命令'

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      console.log('AI 聊天接口 - OLLAMA API 响应状态:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('AI 聊天接口 - OLLAMA API 错误响应:', errorText)
        throw new Error('模型 API 调用失败: ' + response.status + ' - ' + errorText)
      }

      const result = await response.json()
      console.log('AI 聊天接口 - OLLAMA API 响应内容:', result)

      aiResponse = result.message?.content || '无法解析命令'
    } catch (error) {
      console.error('AI 聊天接口 - OLLAMA API 调用失败:', error)
      throw new Error('模型 API 调用失败: ' + (error as Error).message)
    }

    // 解析 AI 响应
    let commandInfo: Command
    try {
      // 尝试直接解析响应
      commandInfo = JSON.parse(aiResponse)

      // 确保 timestamp 正确
      commandInfo.timestamp = new Date().toISOString()
    } catch (error) {
      console.error('解析 AI 响应失败:', error)
      // 生成默认命令
      commandInfo = {
        action: 'none',
        actuatorId: '',
        actuatorType: 'none',
        timestamp: new Date().toISOString(),
        reply: '抱歉，我无法解析您的命令，请尝试使用更明确的设备控制指令。'
      }
    }

    // 二次验证：如果AI返回的action不是none但没有有效的执行器ID，视为无效命令
    if (commandInfo.action !== 'none' && (!commandInfo.actuatorId || commandInfo.actuatorId === 'unknown' || commandInfo.actuatorId === 'null')) {
      commandInfo = {
        action: 'none',
        actuatorId: '',
        actuatorType: 'none',
        timestamp: new Date().toISOString(),
        reply: '抱歉，我无法识别您要控制的设备，请明确指定设备名称或ID。'
      }
    }

    // 执行设备控制逻辑
    // 这里可以添加与物联网平台的通信代码
    // 例如：调用设备控制 API、发送 MQTT 消息等

    // 模拟执行结果
    const executionResult = {
      success: true,
      message: '命令执行成功',
      command: commandInfo
    }

    return NextResponse.json({
      success: true,
      data: {
        response: aiResponse,
        commandInfo,
        executionResult
      }
    })
  } catch (error) {
    console.error('AI 聊天接口错误:', error)
    return NextResponse.json(
      { success: false, error: '内部服务器错误' },
      { status: 500 }
    )
  }
}