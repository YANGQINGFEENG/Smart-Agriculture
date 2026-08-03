/**
 * AI 模块数据库迁移脚本
 * 创建 ai_chat_history、ai_diagnosis_logs 表
 * 升级 image_recognition_history 表结构
 *
 * 运行: node scripts/migrate-ai-tables.js
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

async function main() {
  console.log('=== AI 模块数据库迁移 ===\n')

  const conn = await mysql.createConnection(dbConfig)

  // 1. 升级 image_recognition_history 表
  console.log('[1] 检查 image_recognition_history 表结构...')
  const [imgCols] = await conn.execute("SHOW COLUMNS FROM image_recognition_history")
  const existingCols = imgCols.map((c) => c.Field)

  const newColumns = [
    { name: 'detection_data', def: `JSON NULL COMMENT '完整检测结果JSON'` },
    { name: 'source', def: `VARCHAR(50) NULL DEFAULT 'server' COMMENT '数据来源(server/hardware_raspberry)'` },
    { name: 'node_id', def: `VARCHAR(50) NULL COMMENT '硬件节点ID'` },
  ]

  for (const col of newColumns) {
    if (!existingCols.includes(col.name)) {
      console.log(`  添加列: ${col.name}...`)
      await conn.execute(`ALTER TABLE image_recognition_history ADD COLUMN ${col.name} ${col.def}`)
      console.log(`  ✓ 已添加 ${col.name}`)
    } else {
      console.log(`  ✓ ${col.name} 已存在`)
    }
  }

  // 2. 创建 ai_chat_history 表
  console.log('\n[2] 检查 ai_chat_history 表...')
  const [chatTables] = await conn.execute("SHOW TABLES LIKE 'ai_chat_history'")
  if (chatTables.length === 0) {
    await conn.execute(`
      CREATE TABLE ai_chat_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_message TEXT NOT NULL COMMENT '用户输入的消息',
        ai_response TEXT NOT NULL COMMENT 'AI 回复内容',
        action VARCHAR(20) NOT NULL DEFAULT 'none' COMMENT '解析的动作(on/off/value/none)',
        actuator_id VARCHAR(50) NULL COMMENT '目标执行器ID',
        control_value DECIMAL(10,2) NULL COMMENT '控制数值',
        execution_status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT '执行状态(success/failed/pending)',
        model VARCHAR(100) NULL COMMENT '使用的LLM模型',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        INDEX idx_action (action),
        INDEX idx_actuator (actuator_id),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI聊天历史记录'
    `)
    console.log('  ✓ ai_chat_history 表已创建')
  } else {
    console.log('  ✓ ai_chat_history 表已存在')
  }

  // 3. 创建 ai_diagnosis_logs 表
  console.log('\n[3] 检查 ai_diagnosis_logs 表...')
  const [diagTables] = await conn.execute("SHOW TABLES LIKE 'ai_diagnosis_logs'")
  if (diagTables.length === 0) {
    await conn.execute(`
      CREATE TABLE ai_diagnosis_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        summary TEXT NOT NULL COMMENT '诊断摘要',
        sensor_analysis JSON NULL COMMENT '传感器分析结果',
        issues JSON NULL COMMENT '发现的问题列表',
        suggestions JSON NULL COMMENT '建议措施列表',
        actions JSON NULL COMMENT '执行动作列表',
        sensor_count INT DEFAULT 0 COMMENT '分析的传感器数量',
        detection_count INT DEFAULT 0 COMMENT '图片识别结果数量',
        model VARCHAR(100) NULL COMMENT '使用的LLM模型',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        INDEX idx_created (created_at),
        INDEX idx_model (model)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI诊断历史记录'
    `)
    console.log('  ✓ ai_diagnosis_logs 表已创建')
  } else {
    console.log('  ✓ ai_diagnosis_logs 表已存在')
  }

  await conn.end()
  console.log('\n=== AI 模块数据库迁移完成 ===')
}

main().catch((e) => {
  console.error('迁移失败:', e.message)
  process.exit(1)
})
