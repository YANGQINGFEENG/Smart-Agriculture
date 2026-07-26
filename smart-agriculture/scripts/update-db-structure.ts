import { db } from '@/lib/db'

/**
 * 数据库结构更新脚本
 * 添加区域(area)、控制值(control_value)、锁定(locked)等字段
 */
async function updateDatabaseStructure() {
  try {
    console.log('[DB Update] 开始更新数据库结构...')

    // 1. 为sensors表添加area字段
    try {
      await db.execute(`
        ALTER TABLE sensors 
        ADD COLUMN IF NOT EXISTS area VARCHAR(100) DEFAULT ''
      `)
      console.log('[DB Update] 已为sensors表添加area字段')
    } catch (error) {
      console.warn('[DB Update] sensors表area字段可能已存在:', error)
    }

    // 2. 为actuators表添加area字段
    try {
      await db.execute(`
        ALTER TABLE actuators 
        ADD COLUMN IF NOT EXISTS area VARCHAR(100) DEFAULT ''
      `)
      console.log('[DB Update] 已为actuators表添加area字段')
    } catch (error) {
      console.warn('[DB Update] actuators表area字段可能已存在:', error)
    }

    // 3. 为actuators表添加control_value字段（用于存储电机速度、舵机角度等）
    try {
      await db.execute(`
        ALTER TABLE actuators 
        ADD COLUMN IF NOT EXISTS control_value DECIMAL(10,2) DEFAULT NULL
      `)
      console.log('[DB Update] 已为actuators表添加control_value字段')
    } catch (error) {
      console.warn('[DB Update] actuators表control_value字段可能已存在:', error)
    }

    // 4. 为actuators表添加locked字段（用于控制指令执行期间的锁定）
    try {
      await db.execute(`
        ALTER TABLE actuators 
        ADD COLUMN IF NOT EXISTS locked TINYINT(1) DEFAULT 0
      `)
      console.log('[DB Update] 已为actuators表添加locked字段')
    } catch (error) {
      console.warn('[DB Update] actuators表locked字段可能已存在:', error)
    }

    // 5. 创建执行器控制指令表（如果不存在）
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS actuator_commands (
          id INT PRIMARY KEY AUTO_INCREMENT,
          actuator_id VARCHAR(20) NOT NULL,
          command ENUM('on', 'off', 'value') NOT NULL,
          control_value DECIMAL(10,2) DEFAULT NULL,
          status ENUM('pending', 'executing', 'executed', 'failed', 'timeout') DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          executed_at TIMESTAMP NULL,
          FOREIGN KEY (actuator_id) REFERENCES actuators(id),
          INDEX idx_actuator_id (actuator_id),
          INDEX idx_status (status),
          INDEX idx_created_at (created_at)
        )
      `)
      console.log('[DB Update] 已创建actuator_commands表')
    } catch (error) {
      console.warn('[DB Update] actuator_commands表可能已存在:', error)
    }

    // 6. 添加新的执行器类型（电机、舵机、LED）
    const newActuatorTypes = [
      { type: 'motor', name: '电机', description: '用于驱动控制，支持速度调节' },
      { type: 'servo', name: '舵机', description: '用于角度控制，支持0-180度旋转' },
      { type: 'led', name: 'LED灯', description: '用于照明和指示，支持开关控制' },
      { type: 'ventilator', name: '通风机', description: '用于空气循环' },
      { type: 'fogger', name: '雾化器', description: '用于湿度调节和降温' },
    ]

    for (const actuatorType of newActuatorTypes) {
      try {
        await db.execute(`
          INSERT INTO actuator_types (type, name, description) 
          VALUES (?, ?, ?) 
          ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)
        `, [actuatorType.type, actuatorType.name, actuatorType.description])
        console.log(`[DB Update] 已添加执行器类型: ${actuatorType.name}`)
      } catch (error) {
        console.warn(`[DB Update] 执行器类型${actuatorType.name}可能已存在:`)
      }
    }

    // 7. 添加新的传感器类型
    const newSensorTypes = [
      { type: 'co2', name: 'CO₂浓度传感器', unit: 'ppm' },
      { type: 'pm25', name: 'PM2.5传感器', unit: 'μg/m³' },
      { type: 'water_level', name: '水位传感器', unit: 'cm' },
      { type: 'pressure', name: '气压传感器', unit: 'hPa' },
      { type: 'vibration', name: '振动传感器', unit: 'mm/s' },
      { type: 'altitude', name: '海拔传感器', unit: 'm' },
      { type: 'soil_moisture', name: '土壤湿度传感器', unit: '%' },
    ]

    for (const sensorType of newSensorTypes) {
      try {
        await db.execute(`
          INSERT INTO sensor_types (type, name, unit) 
          VALUES (?, ?, ?) 
          ON DUPLICATE KEY UPDATE name = VALUES(name), unit = VALUES(unit)
        `, [sensorType.type, sensorType.name, sensorType.unit])
        console.log(`[DB Update] 已添加传感器类型: ${sensorType.name}`)
      } catch (error) {
        console.warn(`[DB Update] 传感器类型${sensorType.name}可能已存在:`)
      }
    }

    console.log('[DB Update] 数据库结构更新完成！')
  } catch (error) {
    console.error('[DB Update] 数据库结构更新失败:', error)
    process.exit(1)
  }
}

updateDatabaseStructure().then(() => {
  process.exit(0)
})
