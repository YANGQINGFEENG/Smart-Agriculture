/**
 * SQLite数据库结构更新脚本
 * 用于为现有数据库添加缺失的字段（area, control_value, control_type等）
 * 
 * 使用方法：
 * npx tsx scripts/update-sqlite-db.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

async function updateDatabase() {
  console.log('🚀 开始更新SQLite数据库结构...\n')

  const db = await open({
    filename: process.env.SQLITE_DB_PATH || './smart_agriculture.db',
    driver: sqlite3.Database
  })

  console.log('✅ 数据库连接成功')

  // ========== 1. 更新 sensors 表 - 添加 area 字段 ==========
  console.log('📝 更新 sensors 表 - 添加 area 字段...')
  try {
    await db.run('ALTER TABLE sensors ADD COLUMN area TEXT DEFAULT ""')
    console.log('✅ sensors 表添加 area 字段成功')
  } catch (error: any) {
    if (error.message.includes('duplicate column name')) {
      console.log('⏭️ area 字段已存在，跳过')
    } else {
      console.error('❌ sensors 表添加 area 字段失败:', error.message)
    }
  }

  // ========== 2. 更新 actuators 表 - 添加控制相关字段 ==========
  console.log('📝 更新 actuators 表 - 添加控制相关字段...')

  const actuatorColumns = [
    { name: 'control_value', type: 'REAL DEFAULT NULL' },
    { name: 'control_type', type: 'TEXT DEFAULT "boolean"' },
    { name: 'control_min', type: 'REAL DEFAULT 0' },
    { name: 'control_max', type: 'REAL DEFAULT 100' },
    { name: 'control_step', type: 'REAL DEFAULT 1' },
    { name: 'control_default', type: 'REAL DEFAULT 0' },
    { name: 'area', type: 'TEXT DEFAULT ""' },
  ]

  for (const col of actuatorColumns) {
    try {
      await db.run(`ALTER TABLE actuators ADD COLUMN ${col.name} ${col.type}`)
      console.log(`✅ actuators 表添加 ${col.name} 字段成功`)
    } catch (error: any) {
      if (error.message.includes('duplicate column name')) {
        console.log(`⏭️ ${col.name} 字段已存在，跳过`)
      } else {
        console.error(`❌ actuators 表添加 ${col.name} 字段失败:`, error.message)
      }
    }
  }

  // ========== 3. 更新 actuator_commands 表 - 添加 control_value 字段 ==========
  console.log('📝 更新 actuator_commands 表 - 添加 control_value 字段...')
  try {
    await db.run('ALTER TABLE actuator_commands ADD COLUMN control_value REAL DEFAULT NULL')
    console.log('✅ actuator_commands 表添加 control_value 字段成功')
  } catch (error: any) {
    if (error.message.includes('duplicate column name')) {
      console.log('⏭️ control_value 字段已存在，跳过')
    } else {
      console.error('❌ actuator_commands 表添加 control_value 字段失败:', error.message)
    }
  }

  // 查询统计信息
  const sensorTypesCount = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM sensor_types')
  const sensorsCount = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM sensors')
  const actuatorTypesCount = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM actuator_types')
  const actuatorsCount = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM actuators')

  console.log('\n📈 数据统计：')
  console.log(`- 传感器类型: ${sensorTypesCount?.count || 0} 条`)
  console.log(`- 传感器设备: ${sensorsCount?.count || 0} 条`)
  console.log(`- 执行器类型: ${actuatorTypesCount?.count || 0} 条`)
  console.log(`- 执行器设备: ${actuatorsCount?.count || 0} 条`)

  await db.close()

  console.log('\n✨ SQLite数据库结构更新完成！')
}

updateDatabase().catch((error) => {
  console.error('❌ 数据库更新失败:', error)
  process.exit(1)
})