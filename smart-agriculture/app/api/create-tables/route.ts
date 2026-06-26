import { NextRequest, NextResponse } from 'next/server'
import { db, ResultSetHeader } from '@/lib/db'

/**
 * 创建策略表和策略执行日志表
 */
export async function POST(request: NextRequest) {
  try {
    console.log('开始创建策略表和策略执行日志表')
    
    // 创建策略表
    console.log('开始创建策略表...')
    await db.execute<ResultSetHeader>(`
      CREATE TABLE IF NOT EXISTS strategies (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        actuator_id VARCHAR(20) NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        trigger_condition JSON NOT NULL,
        time_range JSON,
        action ENUM('on', 'off') NOT NULL,
        stop_condition JSON,
        safety_config JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)
    console.log('策略表创建成功')

    // 创建策略执行日志表
    console.log('开始创建策略执行日志表...')
    await db.execute<ResultSetHeader>(`
      CREATE TABLE IF NOT EXISTS strategy_execution_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        strategy_id VARCHAR(50) NOT NULL,
        actuator_id VARCHAR(20) NOT NULL,
        execution_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        action ENUM('on', 'off') NOT NULL,
        status ENUM('success', 'failed', 'pending') DEFAULT 'pending',
        error_message TEXT
      )
    `)
    console.log('策略执行日志表创建成功')

    return NextResponse.json({
      success: true,
      message: '策略表和策略执行日志表创建成功'
    }, { status: 200 })
  } catch (error) {
    console.error('创建表失败:', error)
    return NextResponse.json({
      success: false,
      message: '创建表失败',
      error: (error as Error).message
    }, { status: 500 })
  }
}
