import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket } from '@/lib/db'

/**
 * 策略执行日志接口
 */
interface StrategyExecutionLog extends RowDataPacket {
  id: number
  strategy_id: string
  actuator_id: string
  execution_time: Date
  action: 'on' | 'off'
  status: 'success' | 'failed' | 'pending'
  error_message?: string
}

/**
 * 获取策略执行日志
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const strategyId = searchParams.get('strategy_id')
    const actuatorId = searchParams.get('actuator_id')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    
    let query = 'SELECT * FROM strategy_execution_logs'
    const params: any[] = []
    
    // 构建查询条件
    if (strategyId || actuatorId) {
      query += ' WHERE'
      if (strategyId) {
        query += ' strategy_id = ?'
        params.push(strategyId)
      }
      if (strategyId && actuatorId) {
        query += ' AND'
      }
      if (actuatorId) {
        query += ' actuator_id = ?'
        params.push(actuatorId)
      }
    }
    
    // 添加排序和分页
    query += ' ORDER BY execution_time DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)
    
    const logs = await db.query<StrategyExecutionLog[]>(query, params)
    
    // 获取总记录数
    let countQuery = 'SELECT COUNT(*) as total FROM strategy_execution_logs'
    const countParams: any[] = []
    
    if (strategyId || actuatorId) {
      countQuery += ' WHERE'
      if (strategyId) {
        countQuery += ' strategy_id = ?'
        countParams.push(strategyId)
      }
      if (strategyId && actuatorId) {
        countQuery += ' AND'
      }
      if (actuatorId) {
        countQuery += ' actuator_id = ?'
        countParams.push(actuatorId)
      }
    }
    
    const countResult = await db.query<{ total: number }[]>(countQuery, countParams)
    const total = countResult[0]?.total || 0
    
    return NextResponse.json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          limit,
          offset,
          pages: Math.ceil(total / limit)
        }
      },
      message: '获取策略执行日志成功'
    }, { status: 200 })
  } catch (error) {
    console.error('获取策略执行日志失败:', error)
    return NextResponse.json({
      success: false,
      data: null,
      message: '获取策略执行日志失败'
    }, { status: 500 })
  }
}

/**
 * 创建策略执行日志
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { strategy_id, actuator_id, action, status, error_message } = body
    
    // 验证必填字段
    if (!strategy_id || !actuator_id || !action || !status) {
      return NextResponse.json({
        success: false,
        data: null,
        message: '缺少必填字段'
      }, { status: 400 })
    }
    
    // 插入日志数据
    const result = await db.execute(
      `INSERT INTO strategy_execution_logs (strategy_id, actuator_id, action, status, error_message) 
       VALUES (?, ?, ?, ?, ?)`,
      [strategy_id, actuator_id, action, status, error_message]
    )
    
    return NextResponse.json({
      success: true,
      data: null,
      message: '创建策略执行日志成功'
    }, { status: 201 })
  } catch (error) {
    console.error('创建策略执行日志失败:', error)
    return NextResponse.json({
      success: false,
      data: null,
      message: '创建策略执行日志失败'
    }, { status: 500 })
  }
}
