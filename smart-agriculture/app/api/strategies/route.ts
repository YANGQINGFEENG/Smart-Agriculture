import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'

/**
 * 策略数据接口
 */
interface Strategy extends RowDataPacket {
  id: string
  name: string
  actuator_id: string
  enabled: boolean
  trigger_condition: any
  time_range?: any
  action: 'on' | 'off'
  stop_condition?: any
  safety_config: any
  created_at: Date
  updated_at: Date
}

/**
 * 获取所有策略
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const actuatorId = searchParams.get('actuator_id')

    let query = 'SELECT * FROM strategies'
    const params: any[] = []

    if (actuatorId) {
      query += ' WHERE actuator_id = ?'
      params.push(actuatorId)
    }

    const strategies = await db.query<Strategy[]>(query, params)
    console.log('获取策略列表 - 查询到的策略数量:', strategies.length)
    console.log('获取策略列表 - 策略ID列表:', strategies.map(s => s.id))

    return NextResponse.json({
      success: true,
      data: strategies,
      message: '获取策略列表成功'
    }, { status: 200 })
  } catch (error) {
    console.error('获取策略列表失败:', error)
    return NextResponse.json({
      success: false,
      data: null,
      message: '获取策略列表失败'
    }, { status: 500 })
  }
}

/**
 * 创建策略
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, actuator_id, enabled, trigger_condition, time_range, action, stop_condition, safety_config } = body

    // 验证必填字段
    if (!name || !actuator_id || !trigger_condition || !action || !safety_config) {
      return NextResponse.json({
        success: false,
        data: null,
        message: '缺少必填字段'
      }, { status: 400 })
    }

    // 生成策略ID
    const strategyId = `STR-${Date.now()}`

    // 插入策略数据
    const result = await db.execute<ResultSetHeader>(
      `INSERT INTO strategies (id, name, actuator_id, enabled, trigger_condition, time_range, action, stop_condition, safety_config)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [strategyId, name, actuator_id, enabled, JSON.stringify(trigger_condition), time_range ? JSON.stringify(time_range) : null, action, stop_condition ? JSON.stringify(stop_condition) : null, JSON.stringify(safety_config)]
    )

    if (result.affectedRows === 0) {
      return NextResponse.json({
        success: false,
        data: null,
        message: '创建策略失败'
      }, { status: 500 })
    }

    // 获取创建的策略
    const createdStrategy = await db.query<Strategy[]>('SELECT * FROM strategies WHERE id = ?', [strategyId])

    return NextResponse.json({
      success: true,
      data: createdStrategy[0],
      message: '创建策略成功'
    }, { status: 201 })
  } catch (error) {
    console.error('创建策略失败:', error)
    return NextResponse.json({
      success: false,
      data: null,
      message: '创建策略失败'
    }, { status: 500 })
  }
}