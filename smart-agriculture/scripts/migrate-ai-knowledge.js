/**
 * AI 设备知识库迁移脚本
 * 创建 ai_device_knowledge 表，预填充现有执行器和传感器的 AI 知识数据
 *
 * 运行: node scripts/migrate-ai-knowledge.js
 */
const mysql = require('mysql2/promise')
const fs = require('fs')
const path = require('path')

// 加载 .env.local
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=')
    if (key && rest.length > 0 && !key.startsWith('#')) {
      process.env[key.trim()] = rest.join('=').trim()
    }
  })
}

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
}

/**
 * 系统预设的 AI 知识数据
 * 覆盖所有执行器类型和传感器类型
 */
const SYSTEM_KNOWLEDGE = [
  // ========== 执行器 ==========
  {
    target_type: 'device_type',
    device_type: 'water_pump',
    keywords: ['水泵', '灌溉', '浇水', '抽水', '喷灌', '滴灌', '洒水', '喷水', '灌溉系统'],
    actions: { on: '开启灌溉', off: '关闭灌溉', query: '查询灌溉状态' },
    parameters: { control_type: 'boolean', control_range: { on: '开启', off: '关闭' } },
    description: '灌溉水泵，用于农田灌溉和排水控制，支持开关操作。',
    priority: 10,
  },
  {
    target_type: 'device_type',
    device_type: 'fan',
    keywords: ['风扇', '风机', '通风', '排气扇', '鼓风', '电扇', '通风设备', '换气扇'],
    actions: { on: '开启风扇', off: '关闭风扇', value: '设置风扇速度{0-100}%' },
    parameters: { control_type: 'integer', control_range: { min: 0, max: 100, step: 1, default: 0, unit: '%' } },
    description: '通风风扇，用于温室通风和温度调节，支持0-100%速度调节。',
    priority: 10,
  },
  {
    target_type: 'device_type',
    device_type: 'heater',
    keywords: ['加热器', '加热', '暖气', '取暖', '电热', '制热', '供暖', '加热设备', '暖风机'],
    actions: { on: '开启加热', off: '关闭加热', value: '设置加热功率{0-100}%' },
    parameters: { control_type: 'integer', control_range: { min: 0, max: 100, step: 5, default: 0, unit: '%' } },
    description: '加热器，用于温室温度控制，支持0-100%功率调节。',
    priority: 10,
  },
  {
    target_type: 'device_type',
    device_type: 'valve',
    keywords: ['阀门', '电磁阀', '水阀', '气阀', '开关阀', '水路'],
    actions: { on: '打开阀门', off: '关闭阀门', query: '查询阀门状态' },
    parameters: { control_type: 'boolean', control_range: { on: '打开', off: '关闭' } },
    description: '电磁阀，用于水流或气路控制，支持开关操作。',
    priority: 10,
  },
  {
    target_type: 'device_type',
    device_type: 'light',
    keywords: ['补光灯', '照明', '灯光', '日光灯', '植物灯', '生长灯', 'LED灯', 'LED', '指示灯', '小灯', '信号灯', 'RGB灯', '彩灯', '彩色灯', '氛围灯', 'RGB', '彩色LED', '变色灯'],
    actions: {
      on: '开启补光灯',
      off: '关闭补光灯',
      value: '设置灯光亮度{0-100}% 或 RGB颜色{1-9}',
    },
    parameters: {
      control_type: 'integer',
      control_range: { min: 0, max: 100, step: 10, default: 0, unit: '%' },
      color_map: {
        0: '关闭',
        1: '红色',
        2: '绿色',
        3: '蓝色',
        4: '黄色',
        5: '青色',
        6: '品红色',
        7: '白色',
        8: '橙色',
        9: '紫色',
      },
      brightness_range: '10-100表示亮度百分比',
      device_variants: {
        'LT-1-001': { name: '普通补光灯', control_type: 'boolean', description: '仅支持开关控制' },
        'LT-1-002': { name: 'RGB-LED灯', control_type: 'integer', description: '支持亮度调节(0-100%)和RGB颜色选择(1-9号预设颜色)' },
      },
      note: 'LT-1-001为普通补光灯（boolean），LT-1-002为RGB-LED灯（integer, 支持颜色和亮度）',
    },
    description: '补光灯/LED灯（执行器），用于温室植物光照补充。注意：和光照传感器(light_sensor)不同，这是主动发光的设备。普通补光灯仅支持开关，RGB-LED灯支持亮度(0-100%)和颜色(1-9号预设)调节。',
    priority: 10,
    note: '与光照传感器(light_sensor)同名不同类型，此为执行器。硬件上报 type=light 且有 state 字段时识别为执行器。包含普通补光灯和RGB-LED灯两种子类型。',
  },
  {
    target_type: 'device_type',
    device_type: 'ventilator',
    keywords: ['通风机', '换气', '排风', '新风', '空气循环'],
    actions: { on: '开启通风机', off: '关闭通风机', query: '查询通风机状态' },
    parameters: { control_type: 'boolean', control_range: { on: '开启', off: '关闭' } },
    description: '通风机，用于温室空气循环和换气，支持开关操作。',
    priority: 8,
  },
  {
    target_type: 'device_type',
    device_type: 'fogger',
    keywords: ['雾化器', '喷雾', '加湿', '雾化', '造雾', '增湿', '湿度调节'],
    actions: { on: '开启雾化', off: '关闭雾化', query: '查询雾化器状态' },
    parameters: { control_type: 'boolean', control_range: { on: '开启', off: '关闭' } },
    description: '雾化器，用于温室湿度调节和降温，支持开关操作。',
    priority: 8,
  },
  {
    target_type: 'device_type',
    device_type: 'motor',
    keywords: ['电机', '马达', '驱动', '电动机', '减速电机'],
    actions: { on: '开启电机', off: '关闭电机', value: '设置电机转速{0-100}%' },
    parameters: { control_type: 'integer', control_range: { min: 0, max: 100, step: 5, default: 0, unit: '%' } },
    description: '电机，用于驱动控制，支持0-100%速度调节。',
    priority: 8,
  },
  {
    target_type: 'device_type',
    device_type: 'servo',
    keywords: ['舵机', '云台', '旋转', '角度', '转向', '云台控制'],
    actions: { on: '舵机归中', off: '舵机归零', value: '设置舵机角度{0-180}°' },
    parameters: { control_type: 'angle', control_range: { min: 0, max: 180, step: 1, default: 90, unit: '°' } },
    description: '舵机，用于角度控制，支持0-180度旋转。',
    priority: 8,
  },
  {
    target_type: 'device_type',
    device_type: 'relay',
    keywords: ['继电器', '开关', '通断', '电源开关', '电路开关'],
    actions: { on: '闭合继电器', off: '断开继电器', query: '查询继电器状态' },
    parameters: { control_type: 'boolean', control_range: { on: '闭合', off: '断开' } },
    description: '继电器，用于电路开关控制，支持通断操作。',
    priority: 7,
  },
  {
    target_type: 'device_type',
    device_type: 'laser',
    keywords: ['激光', '激光器', '激光头', '镭射'],
    actions: { on: '开启激光', off: '关闭激光', query: '查询激光状态' },
    parameters: { control_type: 'boolean', control_range: { on: '开启', off: '关闭' } },
    description: '激光器，用于激光发射控制，支持开关操作。',
    priority: 7,
  },
  {
    target_type: 'device_type',
    device_type: 'buzzer',
    keywords: ['蜂鸣器', '报警', '警报', '鸣叫', '蜂鸣', '喇叭', '声音报警'],
    actions: { on: '开启蜂鸣器', off: '关闭蜂鸣器', value: '设置蜂鸣模式{alarm/success/warning/click}' },
    parameters: { control_type: 'boolean', control_range: { on: '开启', off: '关闭' }, modes: ['alarm', 'success', 'warning', 'click'] },
    description: '蜂鸣器，用于声音提示和报警，支持多种蜂鸣模式（alarm连续长响/success短响3次/warning长短交替/click单次短响）。',
    priority: 7,
  },
  {
    target_type: 'device_type',
    device_type: 'camera',
    keywords: ['摄像头', '相机', '监控', '视频', '图像', '拍摄', '云台摄像头', '追踪'],
    actions: {
      on: '开启摄像头/追踪',
      off: '关闭摄像头/追踪',
      value: '设置追踪颜色{blue/red/green/yellow/orange}',
    },
    parameters: {
      control_type: 'string',
      control_range: { on: '开启', off: '关闭' },
      tracking_colors: ['blue', 'red', 'green', 'yellow', 'orange'],
      special_commands: {
        track: '开启颜色追踪',
        gyro: '开启手势控制',
      },
    },
    description: '云台摄像头，支持视频流、颜色追踪、手势控制。track命令开启追踪，gyro命令开启手势控制。',
    priority: 10,
  },
  // ========== 传感器 ==========
  {
    target_type: 'device_type',
    device_type: 'temperature',
    keywords: ['温度', '气温', '空气温度', '环境温度', '温度传感器'],
    actions: { query: '查询温度' },
    parameters: { unit: '°C', typical_range: '-10~50' },
    description: '温度传感器，用于测量环境空气温度，单位摄氏度。',
    priority: 10,
  },
  {
    target_type: 'device_type',
    device_type: 'humidity',
    keywords: ['湿度', '空气湿度', '环境湿度', '湿度传感器', '相对湿度'],
    actions: { query: '查询湿度' },
    parameters: { unit: '%', typical_range: '0~100' },
    description: '空气湿度传感器，用于测量环境相对湿度，单位百分比。',
    priority: 10,
  },
  {
    target_type: 'device_type',
    device_type: 'light_sensor',
    keywords: ['光照传感器', '光照强度', '光照', '亮度传感器', '光线强度', '光线', '光照度', 'Lux', 'lux'],
    actions: { query: '查询光照强度' },
    parameters: { unit: 'Lux', typical_range: '0~100000' },
    description: '光照强度传感器，用于测量环境光照强度，单位Lux。注意：和补光灯(light actuator)不同，这是被动测量的传感器。',
    priority: 9,
    note: '与补光灯(light actuator)同名不同类型，此为传感器。硬件上报 type=light 且有 value 字段时自动映射为 light_sensor。',
  },
  {
    target_type: 'device_type',
    device_type: 'soil_moisture',
    keywords: ['土壤湿度', '土壤水分', '墒情', '土壤含水量', '土湿'],
    actions: { query: '查询土壤湿度' },
    parameters: { unit: '%', typical_range: '0~100' },
    description: '土壤湿度传感器，用于测量土壤含水量，单位百分比。',
    priority: 9,
  },
  {
    target_type: 'device_type',
    device_type: 'soil_temperature',
    keywords: ['土壤温度', '地温', '土温', '地下温度'],
    actions: { query: '查询土壤温度' },
    parameters: { unit: '°C', typical_range: '-10~60' },
    description: '土壤温度传感器，用于测量土壤内部温度，单位摄氏度。',
    priority: 8,
  },
  {
    target_type: 'device_type',
    device_type: 'ph',
    keywords: ['pH值', '酸碱度', 'pH', '土壤pH', '酸碱性'],
    actions: { query: '查询pH值' },
    parameters: { unit: 'pH', typical_range: '0~14' },
    description: '土壤pH传感器，用于测量土壤酸碱度，pH值范围0-14。',
    priority: 8,
  },
  {
    target_type: 'device_type',
    device_type: 'ec',
    keywords: ['电导率', 'EC值', '土壤电导率', '盐分', 'EC'],
    actions: { query: '查询电导率' },
    parameters: { unit: 'μS/cm', typical_range: '0~20000' },
    description: '土壤电导率传感器，用于测量土壤盐分含量，单位μS/cm。',
    priority: 8,
  },
  {
    target_type: 'device_type',
    device_type: 'co2',
    keywords: ['二氧化碳', 'CO2', 'CO₂', '二氧化碳浓度', 'CO2浓度'],
    actions: { query: '查询CO2浓度' },
    parameters: { unit: 'ppm', typical_range: '0~5000' },
    description: 'CO2传感器，用于测量空气中二氧化碳浓度，单位ppm。',
    priority: 8,
  },
  {
    target_type: 'device_type',
    device_type: 'pressure',
    keywords: ['气压', '大气压', '气压计', 'BMP280', '大气压力'],
    actions: { query: '查询气压' },
    parameters: { unit: 'hPa', typical_range: '300~1100' },
    description: '气压传感器，用于测量大气压力，单位hPa。树莓派使用BMP280传感器。',
    priority: 7,
  },
  {
    target_type: 'device_type',
    device_type: 'altitude',
    keywords: ['海拔', '高度', '海拔高度', '高程'],
    actions: { query: '查询海拔高度' },
    parameters: { unit: 'm', typical_range: '-500~9000' },
    description: '海拔高度传感器，通过气压换算得出，单位米。',
    priority: 7,
  },
  {
    target_type: 'device_type',
    device_type: 'vibration',
    keywords: ['振动', '震动', '振动传感器', '震动检测'],
    actions: { query: '查询振动状态' },
    parameters: { unit: '', typical_range: '0/1' },
    description: '振动传感器，用于检测机械振动，返回0(无振动)或1(有振动)。',
    priority: 6,
  },
  {
    target_type: 'device_type',
    device_type: 'pm25',
    keywords: ['PM2.5', '颗粒物', '粉尘', '空气质量', 'PM25'],
    actions: { query: '查询PM2.5浓度' },
    parameters: { unit: 'μg/m³', typical_range: '0~500' },
    description: 'PM2.5传感器，用于测量空气中细颗粒物浓度，单位μg/m³。',
    priority: 6,
  },
]

async function main() {
  console.log('=== AI 设备知识库迁移 ===\n')

  const conn = await mysql.createConnection(dbConfig)

  // 1. 创建 ai_device_knowledge 表
  console.log('[1] 创建 ai_device_knowledge 表...')
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS ai_device_knowledge (
      id INT AUTO_INCREMENT PRIMARY KEY,
      target_type ENUM('device_type', 'device_instance') NOT NULL DEFAULT 'device_type'
        COMMENT '知识条目类型：device_type=设备类型通用知识，device_instance=特定设备实例',
      device_type VARCHAR(50) NOT NULL
        COMMENT '设备类型（如 water_pump, fan, temperature）',
      device_id VARCHAR(50) NULL
        COMMENT '设备实例ID（target_type=device_instance时填写）',
      keywords JSON NOT NULL
        COMMENT '自然语言关键词列表，如 ["水泵","灌溉","浇水"]',
      actions JSON NOT NULL
        COMMENT '支持的动作描述，如 {"on":"开启","off":"关闭","value":"设置速度"}',
      parameters JSON NULL
        COMMENT '参数描述（控制类型、范围、单位等）',
      description TEXT NOT NULL
        COMMENT 'AI可理解的设备功能描述',
      note VARCHAR(255) NULL
        COMMENT '备注说明（如类型冲突提示）',
      priority INT NOT NULL DEFAULT 0
        COMMENT '匹配优先级，数值越大越优先',
      is_system TINYINT(1) NOT NULL DEFAULT 0
        COMMENT '是否系统预设（0=用户自建，1=系统预设）',
      is_active TINYINT(1) NOT NULL DEFAULT 1
        COMMENT '是否启用',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_type (device_type),
      INDEX idx_device (device_id),
      INDEX idx_target (target_type, device_type),
      INDEX idx_priority (priority DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI设备知识库 - 存储AI理解设备所需的自然语言映射和参数信息'
  `)
  console.log('  ✓ ai_device_knowledge 表已创建')

  // 2. 预填充系统预设知识
  console.log('\n[2] 预填充系统预设知识...')
  let insertedCount = 0
  let updatedCount = 0

  for (const entry of SYSTEM_KNOWLEDGE) {
    const [existing] = await conn.execute(
      'SELECT id FROM ai_device_knowledge WHERE target_type = ? AND device_type = ? AND device_id IS NULL AND is_system = 1',
      [entry.target_type, entry.device_type]
    )

    if (existing.length === 0) {
      await conn.execute(
        `INSERT INTO ai_device_knowledge 
         (target_type, device_type, keywords, actions, parameters, description, note, priority, is_system)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          entry.target_type,
          entry.device_type,
          JSON.stringify(entry.keywords),
          JSON.stringify(entry.actions),
          entry.parameters ? JSON.stringify(entry.parameters) : null,
          entry.description,
          entry.note || null,
          entry.priority,
        ]
      )
      insertedCount++
      console.log(`  + 新增: ${entry.device_type} (${entry.target_type})`)
    } else {
      // 更新已有系统预设（确保数据最新）
      await conn.execute(
        `UPDATE ai_device_knowledge 
         SET keywords = ?, actions = ?, parameters = ?, description = ?, note = ?, priority = ?
         WHERE id = ?`,
        [
          JSON.stringify(entry.keywords),
          JSON.stringify(entry.actions),
          entry.parameters ? JSON.stringify(entry.parameters) : null,
          entry.description,
          entry.note || null,
          entry.priority,
          existing[0].id,
        ]
      )
      updatedCount++
      console.log(`  ~ 更新: ${entry.device_type} (${entry.target_type})`)
    }
  }

  console.log(`\n  新增 ${insertedCount} 条，更新 ${updatedCount} 条`)

  // 3. 为已存在的执行器实例创建知识条目
  console.log('\n[3] 为已有执行器实例创建知识条目...')
  const [actuators] = await conn.execute(
    "SELECT a.id, a.name, a.location, a.area, at.type FROM actuators a INNER JOIN actuator_types at ON a.type_id = at.id WHERE a.status != 'deleted'"
  )

  let instanceCount = 0
  for (const act of actuators) {
    const [existing] = await conn.execute(
      'SELECT id FROM ai_device_knowledge WHERE target_type = ? AND device_id = ?',
      ['device_instance', act.id]
    )

    if (existing.length === 0) {
      // 获取该设备类型的系统知识作为模板
      const [typeKnowledge] = await conn.execute(
        'SELECT keywords, actions, parameters, description FROM ai_device_knowledge WHERE target_type = ? AND device_type = ? AND is_system = 1 LIMIT 1',
        ['device_type', act.type]
      )

      let instanceKeywords = [act.name, act.id]
      let instanceDescription = `${act.name}（类型：${act.type}，位置：${act.location || act.area || '未知'}）`

      if (typeKnowledge.length > 0) {
        const tk = typeKnowledge[0]
        const baseKeywords = typeof tk.keywords === 'string' ? JSON.parse(tk.keywords) : tk.keywords
        instanceKeywords = [...new Set([...baseKeywords, act.name, act.id])]
        instanceDescription = `${act.name} - ${tk.description} 位于${act.location || act.area || '未知位置'}。`
      }

      const defaultActions = { on: `开启${act.name}`, off: `关闭${act.name}`, query: `查询${act.name}状态` }

      await conn.execute(
        `INSERT INTO ai_device_knowledge 
         (target_type, device_type, device_id, keywords, actions, parameters, description, priority, is_system)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          'device_instance',
          act.type,
          act.id,
          JSON.stringify(instanceKeywords),
          JSON.stringify(defaultActions),
          typeKnowledge.length > 0 ? (typeof typeKnowledge[0].parameters === 'string' ? typeKnowledge[0].parameters : JSON.stringify(typeKnowledge[0].parameters)) : null,
          instanceDescription,
          5,
        ]
      )
      instanceCount++
      console.log(`  + 实例: ${act.id} (${act.name})`)
    }
  }
  console.log(`  新增 ${instanceCount} 条设备实例知识`)

  await conn.end()
  console.log('\n=== AI 设备知识库迁移完成 ===')
}

main().catch((e) => {
  console.error('迁移失败:', e.message)
  process.exit(1)
})