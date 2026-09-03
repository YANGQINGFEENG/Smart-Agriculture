/**
 * AI 知识库匹配测试脚本
 * 运行: node scripts/test-knowledge-match.js
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

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  })

  const [rows] = await conn.execute(
    "SELECT device_type, keywords, priority FROM ai_device_knowledge WHERE is_active = 1 AND target_type = 'device_type' ORDER BY priority DESC"
  )

  const testMessages = [
    '打开LED灯',
    '打开补光灯',
    '关闭RGB灯',
    '设置灯光为50%',
    '打开水泵',
    '查询温度',
    '打开灌溉',
  ]

  for (const message of testMessages) {
    console.log(`\n=== 测试: "${message}" ===`)

    // 构建关键词映射
    const map = []
    for (const row of rows) {
      const keywords = typeof row.keywords === 'string' ? JSON.parse(row.keywords) : row.keywords
      for (const kw of keywords) {
        if (kw.length < 2) continue // 过滤单字关键词
        map.push({ keyword: kw, deviceType: row.device_type, priority: row.priority })
      }
    }

    // 排序
    map.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority
      return b.keyword.length - a.keyword.length
    })

    // 匹配
    let matched = false
    for (const { keyword, deviceType, priority } of map) {
      if (message.includes(keyword)) {
        console.log(`  ✓ 匹配: "${keyword}" → ${deviceType} (priority=${priority})`)
        matched = true
        break
      }
    }
    if (!matched) {
      console.log('  ✗ 未匹配到任何设备类型')
    }
  }

  await conn.end()
  console.log('\n=== 测试完成 ===')
}

main().catch(e => {
  console.error('测试失败:', e.message)
  process.exit(1)
})