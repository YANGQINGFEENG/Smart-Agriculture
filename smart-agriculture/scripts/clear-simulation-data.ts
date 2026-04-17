/**
 * 清空模拟数据脚本
 * 用于删除所有传感器的模拟数据，为真实数据做准备
 * 
 * 使用方法：
 * 1. 确保 MySQL 服务已启动
 * 2. 修改 .env.local 文件中的数据库连接信息
 * 3. 运行：npx tsx scripts/clear-simulation-data.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// 加载 .env.local 文件
config({ path: resolve(process.cwd(), '.env.local') })

import mysql from 'mysql2/promise'

async function clearSimulationData() {
  console.log('🚀 开始清空模拟数据...\n')

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_agriculture',
  })

  console.log('✅ 数据库连接成功')

  try {
    // 清空传感器数据表
    console.log('📝 清空传感器数据表...')
    await connection.query('TRUNCATE TABLE sensor_data')
    console.log('✅ 传感器数据表清空成功')

    // 重置传感器状态为离线
    console.log('📝 重置传感器状态...')
    await connection.query('UPDATE sensors SET status = \'offline\', last_update = NULL')
    console.log('✅ 传感器状态重置成功')

    // 清空执行器状态历史表
    console.log('📝 清空执行器状态历史表...')
    await connection.query('TRUNCATE TABLE actuator_status_history')
    console.log('✅ 执行器状态历史表清空成功')

    // 清空设备状态历史表
    console.log('📝 清空设备状态历史表...')
    await connection.query('TRUNCATE TABLE device_status_history')
    console.log('✅ 设备状态历史表清空成功')

    console.log('\n🎉 模拟数据清空完成！')
    console.log('\n📋 接下来的步骤：')
    console.log('1. 确保硬件设备已连接并正常运行')
    console.log('2. 硬件设备将通过 POST /api/sensors/[id]/data 接口上传真实数据')
    console.log('3. 前端将自动显示真实的传感器数据')

  } catch (error) {
    console.error('❌ 清空模拟数据失败:', error)
  } finally {
    await connection.end()
    console.log('\n✅ 数据库连接已关闭')
  }
}

clearSimulationData().catch(console.error)
