/**
 * AI 自动化方案迁移脚本
 * 创建 ai_automation_schemes 表，预填充系统默认的自动化方案
 *
 * 运行: node scripts/migrate-ai-automation.js
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
 * 系统预设自动化方案
 * 覆盖温度、湿度、光照、灌溉、CO2、综合场景
 */
const SYSTEM_SCHEMES = [
  // ========== 温度控制方案 ==========
  {
    name: '高温自动降温',
    description: '当温度超过30度时，自动开启风扇和雾化器进行降温，保持温室温度在适宜范围',
    trigger_condition: '温度 > 30°C',
    action_desc: '开启风扇并开启雾化器',
    device_type: 'fan',
    related_sensors: ['temperature'],
    related_actuators: ['fan', 'fogger'],
    action_type: 'composite',
    composite_actions: {
      actions: [
        { device_type: 'fan', action: 'on', value: null, delay_seconds: 0 },
        { device_type: 'fogger', action: 'on', value: null, delay_seconds: 5 },
      ],
      description: '先开启风扇，5秒后开启雾化器',
    },
    priority: 10,
  },
  {
    name: '低温自动供暖',
    description: '当温度低于15度时，自动开启加热器保持温室温度',
    trigger_condition: '温度 < 15°C',
    action_desc: '开启加热器',
    device_type: 'heater',
    related_sensors: ['temperature'],
    related_actuators: ['heater'],
    action_type: 'on',
    priority: 10,
  },
  {
    name: '温和通风',
    description: '当温度在25-30度之间时，仅开启风扇进行温和通风',
    trigger_condition: '25°C ≤ 温度 ≤ 30°C',
    action_desc: '仅开启风扇通风',
    device_type: 'fan',
    related_sensors: ['temperature'],
    related_actuators: ['fan'],
    action_type: 'on',
    priority: 8,
  },
  {
    name: '温度恢复正常',
    description: '当温度恢复到适宜范围（20-25度）时，关闭所有温控设备',
    trigger_condition: '20°C ≤ 温度 ≤ 25°C',
    action_desc: '关闭风扇、加热器和雾化器',
    device_type: 'fan',
    related_sensors: ['temperature'],
    related_actuators: ['fan', 'heater', 'fogger'],
    action_type: 'composite',
    composite_actions: {
      actions: [
        { device_type: 'fan', action: 'off', value: null, delay_seconds: 0 },
        { device_type: 'heater', action: 'off', value: null, delay_seconds: 0 },
        { device_type: 'fogger', action: 'off', value: null, delay_seconds: 0 },
      ],
      description: '关闭所有温控设备',
    },
    priority: 7,
  },

  // ========== 湿度控制方案 ==========
  {
    name: '湿度过高排湿',
    description: '当湿度超过85%时，开启风扇和通风机进行排湿',
    trigger_condition: '湿度 > 85%',
    action_desc: '开启风扇和通风机',
    device_type: 'fan',
    related_sensors: ['humidity'],
    related_actuators: ['fan', 'ventilator'],
    action_type: 'composite',
    composite_actions: {
      actions: [
        { device_type: 'fan', action: 'on', value: null, delay_seconds: 0 },
        { device_type: 'ventilator', action: 'on', value: null, delay_seconds: 0 },
      ],
      description: '同时开启风扇和通风机排湿',
    },
    priority: 10,
  },
  {
    name: '湿度过低加湿',
    description: '当湿度低于40%时，开启雾化器进行加湿',
    trigger_condition: '湿度 < 40%',
    action_desc: '开启雾化器加湿',
    device_type: 'fogger',
    related_sensors: ['humidity'],
    related_actuators: ['fogger'],
    action_type: 'on',
    priority: 10,
  },
  {
    name: '湿度恢复正常',
    description: '当湿度恢复到适宜范围（50-70%）时，关闭排湿/加湿设备',
    trigger_condition: '50% ≤ 湿度 ≤ 70%',
    action_desc: '关闭风扇、通风机和雾化器',
    device_type: 'fan',
    related_sensors: ['humidity'],
    related_actuators: ['fan', 'ventilator', 'fogger'],
    action_type: 'composite',
    composite_actions: {
      actions: [
        { device_type: 'fan', action: 'off', value: null, delay_seconds: 0 },
        { device_type: 'ventilator', action: 'off', value: null, delay_seconds: 0 },
        { device_type: 'fogger', action: 'off', value: null, delay_seconds: 0 },
      ],
      description: '关闭所有湿度控制设备',
    },
    priority: 7,
  },

  // ========== 光照控制方案 ==========
  {
    name: '光照不足补光',
    description: '当光照强度低于5000 Lux时，开启补光灯为植物提供光照',
    trigger_condition: '光照强度 < 5000 Lux',
    action_desc: '开启补光灯',
    device_type: 'light',
    related_sensors: ['light_sensor'],
    related_actuators: ['light'],
    action_type: 'on',
    priority: 10,
  },
  {
    name: '夜间补光模式',
    description: '夜间（18:00-06:00）开启补光灯50%亮度，为植物提供生长光照',
    trigger_condition: '时间在 18:00-06:00 之间',
    action_desc: '开启补光灯至50%亮度',
    device_type: 'light',
    related_sensors: ['light_sensor'],
    related_actuators: ['light'],
    action_type: 'value',
    action_value: 50,
    action_unit: '%',
    priority: 8,
  },
  {
    name: '光照过强遮光',
    description: '当光照强度超过80000 Lux时，关闭补光灯避免光照过强',
    trigger_condition: '光照强度 > 80000 Lux',
    action_desc: '关闭补光灯',
    device_type: 'light',
    related_sensors: ['light_sensor'],
    related_actuators: ['light'],
    action_type: 'off',
    priority: 9,
  },
  {
    name: '光照恢复正常',
    description: '当光照强度恢复到正常范围（5000-80000 Lux）时，关闭补光灯',
    trigger_condition: '5000 Lux ≤ 光照强度 ≤ 80000 Lux',
    action_desc: '关闭补光灯',
    device_type: 'light',
    related_sensors: ['light_sensor'],
    related_actuators: ['light'],
    action_type: 'off',
    priority: 7,
  },

  // ========== 土壤/灌溉控制方案 ==========
  {
    name: '土壤缺水灌溉',
    description: '当土壤湿度低于30%时，开启水泵进行灌溉',
    trigger_condition: '土壤湿度 < 30%',
    action_desc: '开启水泵灌溉',
    device_type: 'water_pump',
    related_sensors: ['soil_moisture'],
    related_actuators: ['water_pump'],
    action_type: 'on',
    priority: 10,
  },
  {
    name: '土壤过湿排水',
    description: '当土壤湿度超过80%时，关闭水泵停止灌溉',
    trigger_condition: '土壤湿度 > 80%',
    action_desc: '关闭水泵停止灌溉',
    device_type: 'water_pump',
    related_sensors: ['soil_moisture'],
    related_actuators: ['water_pump'],
    action_type: 'off',
    priority: 10,
  },
  {
    name: '定时灌溉',
    description: '每天早上6点自动开启水泵灌溉10分钟',
    trigger_condition: '每天 06:00',
    action_desc: '开启水泵定时灌溉',
    device_type: 'water_pump',
    related_sensors: ['soil_moisture'],
    related_actuators: ['water_pump'],
    action_type: 'on',
    priority: 8,
  },
  {
    name: '土壤湿度正常',
    description: '当土壤湿度恢复到适宜范围（40-70%）时，关闭水泵',
    trigger_condition: '40% ≤ 土壤湿度 ≤ 70%',
    action_desc: '关闭水泵',
    device_type: 'water_pump',
    related_sensors: ['soil_moisture'],
    related_actuators: ['water_pump'],
    action_type: 'off',
    priority: 7,
  },

  // ========== CO2/空气质量方案 ==========
  {
    name: 'CO2浓度过高通风',
    description: '当CO2浓度超过1500ppm时，开启通风机换气',
    trigger_condition: 'CO2浓度 > 1500 ppm',
    action_desc: '开启通风机换气',
    device_type: 'ventilator',
    related_sensors: ['co2'],
    related_actuators: ['ventilator'],
    action_type: 'on',
    priority: 9,
  },
  {
    name: '空气质量差通风',
    description: '当PM2.5超过100μg/m³时，开启风扇改善空气质量',
    trigger_condition: 'PM2.5 > 100 μg/m³',
    action_desc: '开启风扇改善空气',
    device_type: 'fan',
    related_sensors: ['pm25'],
    related_actuators: ['fan'],
    action_type: 'on',
    priority: 8,
  },
  {
    name: 'CO2浓度恢复正常',
    description: '当CO2浓度恢复到正常范围（<1000ppm）时，关闭通风机',
    trigger_condition: 'CO2浓度 < 1000 ppm',
    action_desc: '关闭通风机',
    device_type: 'ventilator',
    related_sensors: ['co2'],
    related_actuators: ['ventilator'],
    action_type: 'off',
    priority: 7,
  },

  // ========== 综合场景方案 ==========
  {
    name: '全自动温室模式',
    description: '根据温度、湿度、光照、土壤湿度等综合数据，自动调节所有设备以达到最佳温室环境',
    trigger_condition: '综合环境数据判断',
    action_desc: '根据实际情况自动调节所有设备',
    device_type: 'fan',
    related_sensors: ['temperature', 'humidity', 'light_sensor', 'soil_moisture', 'co2'],
    related_actuators: ['fan', 'heater', 'fogger', 'light', 'water_pump', 'ventilator'],
    action_type: 'composite',
    composite_actions: {
      actions: [],
      description: '综合判断后自动调节，需AI进一步分析具体环境数据后决定',
    },
    priority: 5,
  },
  {
    name: '节能模式',
    description: '夜间（22:00-06:00）关闭非必要设备，仅保留必要的温湿度监控',
    trigger_condition: '时间在 22:00-06:00 之间',
    action_desc: '关闭补光灯、通风机等非必要设备',
    device_type: 'light',
    related_sensors: ['temperature', 'humidity'],
    related_actuators: ['light', 'ventilator', 'fogger'],
    action_type: 'composite',
    composite_actions: {
      actions: [
        { device_type: 'light', action: 'off', value: null, delay_seconds: 0 },
        { device_type: 'ventilator', action: 'off', value: null, delay_seconds: 0 },
        { device_type: 'fogger', action: 'off', value: null, delay_seconds: 0 },
      ],
      description: '夜间关闭非必要设备节省能源',
    },
    priority: 6,
  },
  {
    name: '暴雨预警保护',
    description: '当湿度快速上升且气压下降时，关闭水泵和通风机防止设备损坏',
    trigger_condition: '湿度快速上升 + 气压下降',
    action_desc: '关闭水泵和通风机',
    device_type: 'water_pump',
    related_sensors: ['humidity', 'pressure'],
    related_actuators: ['water_pump', 'ventilator'],
    action_type: 'composite',
    composite_actions: {
      actions: [
        { device_type: 'water_pump', action: 'off', value: null, delay_seconds: 0 },
        { device_type: 'ventilator', action: 'off', value: null, delay_seconds: 0 },
      ],
      description: '暴雨预警，关闭水泵和通风机',
    },
    priority: 9,
  },
  {
    name: '高温强光保护',
    description: '当温度超过35度且光照超过80000 Lux时，开启风扇降温并关闭补光灯',
    trigger_condition: '温度 > 35°C 且 光照 > 80000 Lux',
    action_desc: '开启风扇降温，关闭补光灯',
    device_type: 'fan',
    related_sensors: ['temperature', 'light_sensor'],
    related_actuators: ['fan', 'light'],
    action_type: 'composite',
    composite_actions: {
      actions: [
        { device_type: 'fan', action: 'on', value: null, delay_seconds: 0 },
        { device_type: 'light', action: 'off', value: null, delay_seconds: 0 },
      ],
      description: '高温强光下开启风扇并关闭补光灯',
    },
    priority: 9,
  },
]

async function main() {
  console.log('=== AI 自动化方案迁移 ===\n')

  const conn = await mysql.createConnection(dbConfig)

  // 1. 创建 ai_automation_schemes 表
  console.log('[1] 创建 ai_automation_schemes 表...')
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS ai_automation_schemes (
      id INT AUTO_INCREMENT PRIMARY KEY
        COMMENT '方案ID',
      name VARCHAR(100) NOT NULL
        COMMENT '方案名称',
      description TEXT NOT NULL
        COMMENT 'AI可理解的自然语言描述',
      trigger_condition TEXT
        COMMENT '触发条件（自然语言描述）',
      action_desc TEXT NOT NULL
        COMMENT '执行动作描述',
      device_type VARCHAR(50) NOT NULL
        COMMENT '主要目标设备类型',
      related_sensors JSON
        COMMENT '关联传感器类型',
      related_actuators JSON
        COMMENT '关联执行器类型',
      action_type ENUM('on','off','value','composite') DEFAULT 'on'
        COMMENT '动作类型',
      action_value DECIMAL(10,2)
        COMMENT '动作值',
      action_unit VARCHAR(20)
        COMMENT '动作值单位',
      composite_actions JSON
        COMMENT '组合动作定义',
      priority INT DEFAULT 0
        COMMENT '推荐优先级',
      is_system TINYINT(1) DEFAULT 0
        COMMENT '是否系统预设',
      is_active TINYINT(1) DEFAULT 1
        COMMENT '是否启用',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_device_type (device_type),
      INDEX idx_priority (priority DESC),
      INDEX idx_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI自动化方案表'
  `)
  console.log('  ✓ ai_automation_schemes 表已创建')

  // 2. 预填充系统预设方案
  console.log('\n[2] 预填充系统预设自动化方案...')
  let insertedCount = 0
  let updatedCount = 0

  for (const scheme of SYSTEM_SCHEMES) {
    const [existing] = await conn.execute(
      'SELECT id FROM ai_automation_schemes WHERE name = ? AND is_system = 1',
      [scheme.name]
    )

    if (existing.length === 0) {
      await conn.execute(
        `INSERT INTO ai_automation_schemes 
         (name, description, trigger_condition, action_desc, device_type, 
          related_sensors, related_actuators, action_type, action_value, action_unit, 
          composite_actions, priority, is_system)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          scheme.name,
          scheme.description,
          scheme.trigger_condition || null,
          scheme.action_desc,
          scheme.device_type,
          JSON.stringify(scheme.related_sensors || []),
          JSON.stringify(scheme.related_actuators || []),
          scheme.action_type,
          scheme.action_value || null,
          scheme.action_unit || null,
          scheme.composite_actions ? JSON.stringify(scheme.composite_actions) : null,
          scheme.priority,
        ]
      )
      insertedCount++
      console.log(`  + 新增: ${scheme.name} (${scheme.action_type}, priority=${scheme.priority})`)
    } else {
      // 更新已有系统预设
      await conn.execute(
        `UPDATE ai_automation_schemes 
         SET description = ?, trigger_condition = ?, action_desc = ?, device_type = ?,
             related_sensors = ?, related_actuators = ?, action_type = ?, 
             action_value = ?, action_unit = ?, composite_actions = ?, priority = ?
         WHERE id = ?`,
        [
          scheme.description,
          scheme.trigger_condition || null,
          scheme.action_desc,
          scheme.device_type,
          JSON.stringify(scheme.related_sensors || []),
          JSON.stringify(scheme.related_actuators || []),
          scheme.action_type,
          scheme.action_value || null,
          scheme.action_unit || null,
          scheme.composite_actions ? JSON.stringify(scheme.composite_actions) : null,
          scheme.priority,
          existing[0].id,
        ]
      )
      updatedCount++
      console.log(`  ~ 更新: ${scheme.name}`)
    }
  }

  console.log(`\n  新增 ${insertedCount} 条，更新 ${updatedCount} 条`)

  // 3. 统计
  const [count] = await conn.execute(
    'SELECT COUNT(*) as total FROM ai_automation_schemes WHERE is_active = 1'
  )
  console.log(`\n  当前活跃方案总数: ${count[0].total}`)

  await conn.end()
  console.log('\n=== AI 自动化方案迁移完成 ===')
}

main().catch((e) => {
  console.error('迁移失败:', e.message)
  process.exit(1)
})