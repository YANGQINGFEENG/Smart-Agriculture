import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'

interface AlarmRule extends RowDataPacket {
  id: number
  name: string
  sensor_type: string
  condition_type: string
  min_value: number | null
  max_value: number | null
  severity: string
  enabled: number
  notify_email: number
  notify_sms: number
  created_at: Date
  updated_at: Date
}

/**
 * GET /api/alarms/rules
 * 获取报警规则列表
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const sensorType = url.searchParams.get('sensor_type')
    const enabled = url.searchParams.get('enabled')

    let query = 'SELECT * FROM alarm_rules'
    const conditions: string[] = []
    const params: any[] = []

    if (sensorType) {
      conditions.push('sensor_type = ?')
      params.push(sensorType)
    }
    if (enabled !== null) {
      conditions.push('enabled = ?')
      params.push(enabled === 'true' ? 1 : 0)
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }

    query += ' ORDER BY created_at DESC'

    const rows = await db.query<AlarmRule[]>(query, params)

    return NextResponse.json({
      success: true,
      data: rows,
      total: rows.length,
    })
  } catch (error) {
    console.error('获取报警规则失败:', error)
    return NextResponse.json(
      { success: false, error: '获取报警规则失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/alarms/rules
 * 创建报警规则
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, sensor_type, condition_type, min_value, max_value, severity, notify_email, notify_sms } = body

    if (!name || !sensor_type || !condition_type) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数：name, sensor_type, condition_type' },
        { status: 400 }
      )
    }

    const result = await db.execute<ResultSetHeader>(
      `INSERT INTO alarm_rules (name, sensor_type, condition_type, min_value, max_value, severity, notify_email, notify_sms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, sensor_type, condition_type, min_value || null, max_value || null, severity || 'warning', notify_email ? 1 : 0, notify_sms ? 1 : 0]
    )

    const newId = (result as any).lastID || (result as any).insertId

    return NextResponse.json({
      success: true,
      data: { id: newId, name },
      message: '报警规则创建成功',
    })
  } catch (error) {
    console.error('创建报警规则失败:', error)
    return NextResponse.json(
      { success: false, error: '创建报警规则失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
