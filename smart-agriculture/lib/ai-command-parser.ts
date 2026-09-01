/**
 * AI 命令解析器 - 内置规则引擎（v2.0 知识库集成版）
 * 当 Ollama 不可用时，使用知识库 + 规则解析处理用户自然语言命令
 * 确保 AI 对话与操控功能始终可用
 *
 * v2.0 变更：
 * - 移除硬编码 DEVICE_KEYWORDS，改为从 ai_device_knowledge 表动态获取
 * - 支持 device_type 和 device_instance 两类知识条目
 * - 基于 priority 的优先级匹配
 * - 增强动作检测，支持知识库定义的 actions
 */

/** 执行器摘要信息（来自数据库 actuators 表） */
export interface ActuatorSummary {
  id: string
  name: string
  type: string
  state: string
  control_type: string | null
  location: string
  area: string
}

/** 知识库条目（来自 ai_device_knowledge 表） */
export interface KnowledgeEntry {
  id: number
  target_type: 'device_type' | 'device_instance'
  device_type: string
  device_id?: string
  keywords: string[]
  actions: Record<string, string>
  parameters?: {
    control_type?: string
    control_range?: { min?: number; max?: number; step?: number; default?: number; unit?: string; on?: string; off?: string }
    unit?: string
    typical_range?: string
    color_map?: Record<number, string>
    brightness_range?: string
    tracking_colors?: string[]
    special_commands?: Record<string, string>
    modes?: string[]
  } | null
  description: string
  note?: string
  priority: number
  is_system: boolean
  is_active: boolean
}

/** 解析后的命令结果 */
export interface ParsedCommandResult {
  action: 'on' | 'off' | 'value' | 'query' | 'none'
  actuatorId: string
  actuatorType: string
  controlType: string | null
  controlValue?: number
  reply: string
}

// ========== 降级硬编码关键词（知识库不可用时的 fallback） ==========
/** 设备类型关键词映射（仅作 fallback 使用） */
const FALLBACK_DEVICE_KEYWORDS: Record<string, string[]> = {
  water_pump: ['水泵', '灌溉', '浇水', '抽水', '喷灌', '滴灌'],
  fan: ['风扇', '风机', '通风', '排气扇', '鼓风'],
  heater: ['加热器', '加热', '暖气', '取暖', '电热', '制热'],
  valve: ['阀门', '电磁阀', '水阀', '气阀'],
  // light 执行器：仅匹配照明/补光相关关键词
  light: ['补光灯', '照明', '灯光', '日光灯', '植物灯', '生长灯', 'LED灯', 'LED', '指示灯', '小灯', '信号灯', 'RGB灯', '彩灯', '彩色灯', '氛围灯', 'RGB', '彩色LED', '变色灯'],
  // light_sensor 传感器：仅匹配光照测量相关关键词
  light_sensor: ['光照强度', '光照传感器', '光照', '亮度传感器', '光线强度', '光线', '光照度'],
  ventilator: ['通风机', '换气', '排风'],
  fogger: ['雾化器', '喷雾', '加湿', '雾化', '造雾'],
  motor: ['电机', '马达', '驱动'],
  servo: ['舵机', '云台', '旋转'],
  relay: ['继电器', '开关'],
  laser: ['激光', '激光器'],
  buzzer: ['蜂鸣器', '报警', '警报', '鸣叫'],
  camera: ['摄像头', '相机', '监控', '视频'],
}

/** 开关动作关键词 */
const ON_KEYWORDS = ['打开', '开启', '启动', '开', '运行', '接通', '闭合', '开始', '启用']
const OFF_KEYWORDS = ['关闭', '停止', '关', '断开', '结束', '停用', '禁用', '停']
const QUERY_KEYWORDS = ['查询', '查看', '状态', '怎么样', '是多少', '什么状态', '当前', '现在']

/** 问候语关键词 */
const GREETING_KEYWORDS = ['你好', '您好', '嗨', 'hello', 'hi', '早上好', '晚上好', '下午好', '谢谢', '感谢', '再见', '拜拜']

/** 数值提取正则 */
const VALUE_PATTERNS = [
  /(\d+(?:\.\d+)?)\s*度/,           // 25度, 25.5度
  /(\d+(?:\.\d+)?)\s*℃/,           // 25℃
  /(\d+(?:\.\d+)?)\s*°C/,          // 25°C
  /(\d+(?:\.\d+)?)\s*%/,           // 50%
  /(\d+(?:\.\d+)?)\s*百分比/,       // 50百分比
  /(\d+(?:\.\d+)?)\s*档/,           // 3档
  /(\d+(?:\.\d+)?)\s*级/,           // 5级
  /设置为?\s*(\d+(?:\.\d+)?)/,       // 设置为50
  /调到?\s*(\d+(?:\.\d+)?)/,         // 调到50
  /调节到?\s*(\d+(?:\.\d+)?)/,       // 调节到50
  /调整到?\s*(\d+(?:\.\d+)?)/,       // 调整到50
  /(\d+(?:\.\d+)?)\s*秒/,           // 10秒
  /(\d+(?:\.\d+)?)\s*分钟/,         // 10分钟
  /(\d+(?:\.\d+)?)\s*小时/,         // 1小时
]

/**
 * 从用户消息中提取数值
 * @param message 用户输入
 * @returns 提取到的数值，如果未找到则返回 undefined
 */
function extractValue(message: string): number | undefined {
  for (const pattern of VALUE_PATTERNS) {
    const match = message.match(pattern)
    if (match) {
      return parseFloat(match[1])
    }
  }
  return undefined
}

/**
 * 构建关键词→设备类型映射表（从知识库中提取）
 * 按 priority 降序排列，高优先级的关键词优先匹配
 * @param knowledgeEntries 知识库条目列表
 * @returns 关键词→设备类型映射
 */
function buildKeywordMap(knowledgeEntries: KnowledgeEntry[]): { keyword: string; deviceType: string; priority: number }[] {
  const map: { keyword: string; deviceType: string; priority: number }[] = []

  for (const entry of knowledgeEntries) {
    if (!entry.is_active) continue
    const keywords = Array.isArray(entry.keywords) ? entry.keywords : []
    for (const kw of keywords) {
      // 过滤掉单字关键词（太短的关键词容易误匹配，如"灯"）
      if (kw.length < 2) continue
      map.push({ keyword: kw, deviceType: entry.device_type, priority: entry.priority })
    }
  }

  // 按优先级降序排列，同优先级下按关键词长度降序（长关键词优先匹配）
  map.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    return b.keyword.length - a.keyword.length
  })

  return map
}

/**
 * 使用知识库匹配设备类型
 * 匹配策略：长关键词优先 → 高优先级优先 → 设备实例优先
 * @param message 用户输入消息
 * @param knowledgeEntries 知识库条目
 * @returns 匹配到的设备类型，未匹配返回 null
 */
function matchDeviceTypeFromKnowledge(
  message: string,
  knowledgeEntries: KnowledgeEntry[]
): string | null {
  if (knowledgeEntries.length === 0) return null

  // 1. 先尝试匹配 device_instance（具体设备实例）
  const instanceEntries = knowledgeEntries.filter(
    (e) => e.target_type === 'device_instance' && e.is_active
  )
  for (const entry of instanceEntries) {
    const keywords = Array.isArray(entry.keywords) ? entry.keywords : []
    for (const kw of keywords) {
      if (message.includes(kw)) {
        return entry.device_type
      }
    }
  }

  // 2. 再匹配 device_type（通用设备类型），按优先级
  const keywordMap = buildKeywordMap(
    knowledgeEntries.filter((e) => e.target_type === 'device_type' && e.is_active)
  )
  for (const { keyword, deviceType } of keywordMap) {
    if (message.includes(keyword)) {
      return deviceType
    }
  }

  return null
}

/**
 * 使用知识库匹配具体设备实例 ID
 * @param message 用户输入消息
 * @param knowledgeEntries 知识库条目
 * @returns 匹配到的设备实例 ID，未匹配返回 null
 */
function matchDeviceInstanceFromKnowledge(
  message: string,
  knowledgeEntries: KnowledgeEntry[]
): string | null {
  const instanceEntries = knowledgeEntries.filter(
    (e) => e.target_type === 'device_instance' && e.is_active && e.device_id
  )
  for (const entry of instanceEntries) {
    const keywords = Array.isArray(entry.keywords) ? entry.keywords : []
    for (const kw of keywords) {
      if (message.includes(kw)) {
        return entry.device_id!
      }
    }
  }
  return null
}

/**
 * 使用降级硬编码关键词匹配设备类型
 * @param message 用户输入消息
 * @returns 匹配到的设备类型
 */
function matchDeviceTypeFallback(message: string): string | null {
  for (const [type, keywords] of Object.entries(FALLBACK_DEVICE_KEYWORDS)) {
    for (const kw of keywords) {
      if (message.includes(kw)) {
        return type
      }
    }
  }
  return null
}

/**
 * 在可用执行器列表中查找匹配的设备
 * 匹配优先级：1. 名称精确匹配 → 2. 知识库实例匹配 → 3. 类型匹配 → 4. 位置/区域匹配
 * @param message 用户输入消息
 * @param actuators 可用执行器列表
 * @param deviceType 匹配到的设备类型
 * @param instanceId 知识库匹配到的实例 ID
 * @returns 匹配到的执行器，未匹配返回 null
 */
function findActuator(
  message: string,
  actuators: ActuatorSummary[],
  deviceType: string | null,
  instanceId?: string | null
): ActuatorSummary | null {
  if (actuators.length === 0) return null

  // 1. 名称完全匹配
  for (const a of actuators) {
    if (a.name && message.includes(a.name)) {
      return a
    }
  }

  // 2. 知识库实例 ID 匹配
  if (instanceId) {
    const matched = actuators.find((a) => a.id === instanceId)
    if (matched) return matched
  }

  // 3. 类型匹配
  if (deviceType) {
    for (const a of actuators) {
      if (a.type === deviceType) {
        return a
      }
    }
  }

  // 4. 位置/区域匹配
  for (const a of actuators) {
    if (a.location && message.includes(a.location)) {
      return a
    }
    if (a.area && message.includes(a.area)) {
      return a
    }
  }

  return null
}

/**
 * 判断动作类型
 * 优先使用知识库中定义的 actions 来判断设备支持的操作
 * @param message 用户输入消息
 * @param deviceType 匹配到的设备类型
 * @param knowledgeEntries 知识库条目
 * @returns 动作类型
 */
function detectAction(
  message: string,
  deviceType?: string | null,
  knowledgeEntries?: KnowledgeEntry[]
): 'on' | 'off' | 'value' | 'query' | 'none' {
  // 检查查询意图
  for (const kw of QUERY_KEYWORDS) {
    if (message.includes(kw)) return 'query'
  }

  // 检查数值控制意图
  const hasValue = VALUE_PATTERNS.some((p) => p.test(message))
  const hasValueIntent = /设置|调节|调整|调到|改为|改成|设为|设定/.test(message)

  // 检查开关
  const isOn = ON_KEYWORDS.some((kw) => message.includes(kw))
  const isOff = OFF_KEYWORDS.some((kw) => message.includes(kw))

  // 数值控制优先
  if (hasValue && hasValueIntent) {
    // 如果知识库中该设备不支持 value 操作，降级为 on/off
    if (deviceType && knowledgeEntries) {
      const deviceKnowledge = knowledgeEntries.find(
        (e) => e.device_type === deviceType && e.target_type === 'device_type'
      )
      if (deviceKnowledge && deviceKnowledge.actions && !deviceKnowledge.actions.value) {
        // 设备不支持数值控制，降级为开关
        if (isOn) return 'on'
        if (isOff) return 'off'
      }
    }
    return 'value'
  }

  if (isOn) return 'on'
  if (isOff) return 'off'

  return 'none'
}

/**
 * 检测是否为问候语
 * @param message 用户输入消息
 * @returns 是否为问候语
 */
function isGreeting(message: string): boolean {
  return GREETING_KEYWORDS.some((kw) => message.includes(kw))
}

/**
 * 获取设备的控制类型（从知识库中获取）
 * @param deviceType 设备类型
 * @param knowledgeEntries 知识库条目
 * @returns 控制类型字符串
 */
function getControlTypeFromKnowledge(
  deviceType: string,
  knowledgeEntries: KnowledgeEntry[]
): string | null {
  const entry = knowledgeEntries.find(
    (e) => e.device_type === deviceType && e.target_type === 'device_type'
  )
  if (entry?.parameters?.control_type) {
    return entry.parameters.control_type
  }
  return null
}

/**
 * 解析用户自然语言命令（v2.0 知识库集成版）
 * @param message 用户输入的消息
 * @param actuators 可用的执行器列表
 * @param knowledgeEntries AI 知识库条目（可选，传入后使用知识库匹配；不传则使用硬编码降级）
 * @returns 解析后的命令结果
 */
export function parseCommand(
  message: string,
  actuators: ActuatorSummary[],
  knowledgeEntries?: KnowledgeEntry[]
): ParsedCommandResult {
  const trimmed = message.trim()
  const hasKnowledge = knowledgeEntries && knowledgeEntries.length > 0

  // 1. 问候语处理
  if (isGreeting(trimmed)) {
    const greetings: Record<string, string> = {
      '你好': '您好！我是智慧农业助手，可以帮您控制设备。试试说"打开灌溉"或"查询温度"吧！',
      '您好': '您好！有什么可以帮助您的吗？',
      '嗨': '嗨！欢迎使用智慧农业平台，请告诉我您需要什么帮助？',
      'hello': 'Hello! 欢迎使用智慧农业平台，请告诉我您需要什么帮助？',
      'hi': 'Hi! 有什么可以帮您的吗？',
      '早上好': '早上好！新的一天开始啦，需要我帮您查看设备状态吗？',
      '晚上好': '晚上好！需要我帮您关闭设备或检查系统状态吗？',
      '下午好': '下午好！需要我帮您调整设备吗？',
      '谢谢': '不客气！随时为您服务。',
      '感谢': '不客气，很高兴能帮到您！',
      '再见': '再见！有需要随时找我。',
      '拜拜': '拜拜！祝您工作顺利！',
    }

    for (const [kw, reply] of Object.entries(greetings)) {
      if (trimmed.includes(kw)) {
        return {
          action: 'none',
          actuatorId: '',
          actuatorType: '',
          controlType: '',
          reply,
        }
      }
    }

    return {
      action: 'none',
      actuatorId: '',
      actuatorType: '',
      controlType: '',
      reply: '您好！我是智慧农业助手，可以帮您控制设备。试试说"打开灌溉"或"查询温度"吧！',
    }
  }

  // 2. 匹配设备类型（知识库优先，降级到硬编码）
  let deviceType: string | null = null
  let instanceId: string | null = null

  if (hasKnowledge) {
    deviceType = matchDeviceTypeFromKnowledge(trimmed, knowledgeEntries!)
    instanceId = matchDeviceInstanceFromKnowledge(trimmed, knowledgeEntries!)
  } else {
    deviceType = matchDeviceTypeFallback(trimmed)
  }

  // 3. 检测动作类型（传入知识库以验证设备支持的操作）
  const action = detectAction(trimmed, deviceType, knowledgeEntries)

  // 4. 查询意图
  if (action === 'query') {
    const actuator = findActuator(trimmed, actuators, deviceType, instanceId)

    if (actuator) {
      return {
        action: 'query',
        actuatorId: actuator.id,
        actuatorType: actuator.type,
        controlType: actuator.control_type,
        reply: `${actuator.name} 当前状态：${actuator.state === 'on' ? '已开启' : '已关闭'}（位于${actuator.location || actuator.area || '未知位置'}）`,
      }
    }

    // 查询所有设备
    if (trimmed.includes('所有') || trimmed.includes('全部') || trimmed.includes('设备')) {
      const statusList = actuators
        .filter((a) => a.state)
        .map((a) => `  • ${a.name}：${a.state === 'on' ? '已开启' : '已关闭'}`)
        .join('\n')
      return {
        action: 'none',
        actuatorId: '',
        actuatorType: '',
        controlType: '',
        reply: `当前设备状态：\n${statusList || '暂无设备数据'}`,
      }
    }

    return {
      action: 'none',
      actuatorId: '',
      actuatorType: '',
      controlType: '',
      reply: '请告诉我您想查询哪个设备？例如"查询灌溉状态"或"查看所有设备状态"。',
    }
  }

  // 5. 控制命令（on/off/value）
  if (action === 'none') {
    return {
      action: 'none',
      actuatorId: '',
      actuatorType: '',
      controlType: '',
      reply: '抱歉，我没有理解您的命令。请尝试说"打开灌溉"、"关闭风扇"、"设置温度为25度"或"查询设备状态"。',
    }
  }

  // 匹配设备
  const actuator = findActuator(trimmed, actuators, deviceType, instanceId)

  if (!actuator) {
    const deviceNames = actuators.map((a) => a.name).join('、')
    let hint = ''
    if (deviceType && hasKnowledge) {
      // 知识库匹配到了设备类型但没有对应执行器实例，给出提示
      const knowledgeEntry = knowledgeEntries!.find(
        (e) => e.device_type === deviceType && e.target_type === 'device_type'
      )
      if (knowledgeEntry) {
        hint = `\n系统识别到您想操作「${knowledgeEntry.description.split('，')[0] || deviceType}」类型设备，但当前没有在线的该类型设备。`
      }
    }
    return {
      action: 'none',
      actuatorId: '',
      actuatorType: '',
      controlType: '',
      reply: `抱歉，没有找到匹配的设备。当前可用的设备有：${deviceNames || '暂无设备'}。${hint}请尝试使用设备名称，如"打开水泵"、"关闭风扇"。`,
    }
  }

  // 数值控制
  if (action === 'value') {
    const value = extractValue(trimmed)
    if (value !== undefined) {
      // 从知识库获取控制类型信息
      let controlType = actuator.control_type
      let unitText = ''

      if (hasKnowledge && deviceType) {
        const kControlType = getControlTypeFromKnowledge(deviceType, knowledgeEntries!)
        if (kControlType) controlType = kControlType

        const knowledgeEntry = knowledgeEntries!.find(
          (e) => e.device_type === deviceType && e.target_type === 'device_type'
        )
        if (knowledgeEntry?.parameters?.control_range?.unit) {
          unitText = knowledgeEntry.parameters.control_range.unit
        }
      }

      if (!unitText) {
        unitText = controlType === 'angle' ? '°' : controlType === 'integer' ? '%' : ''
      }

      return {
        action: 'value',
        actuatorId: actuator.id,
        actuatorType: actuator.type,
        controlType,
        controlValue: value,
        reply: `正在将${actuator.name}设置为 ${value}${unitText}...`,
      }
    }
    return {
      action: 'none',
      actuatorId: '',
      actuatorType: '',
      controlType: '',
      reply: '请指定具体的数值，例如"设置风扇速度为50%"或"设置温度为25度"。',
    }
  }

  // 开关控制
  let stateText = action === 'on' ? '已开启' : '已关闭'

  // 从知识库获取更友好的描述
  if (hasKnowledge && deviceType) {
    const knowledgeEntry = knowledgeEntries!.find(
      (e) => e.device_type === deviceType && e.target_type === 'device_type'
    )
    if (knowledgeEntry?.actions) {
      const actionDesc = knowledgeEntry.actions[action]
      if (actionDesc) {
        stateText = `已执行：${actionDesc}`
      }
    }
  }

  return {
    action,
    actuatorId: actuator.id,
    actuatorType: actuator.type,
    controlType: actuator.control_type,
    reply: `${actuator.name}${stateText}（位于${actuator.location || actuator.area || '未知位置'}）`,
  }
}