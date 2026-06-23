import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'

interface AlarmRecord extends RowDataPacket {
  id: number
  rule_id: number | null
  sensor_id: string | null
  sensor_type: string | null
  alarm_type: string
  severity: string
  message: string
  value: number | null
  threshold_info: string | null
  status: string
  acknowledged_by: string | null
  acknowledged_at: Date | null
  resolved_at: Date | null
  created_at: Date
}

/**
 * GET /api/alarms/records
 * 获取报警记录列表
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20')
    const status = url.searchParams.get('status')
    const severity = url.searchParams.get('severity')
    const alarmType = url.searchParams.get('alarm_type')

    let query = 'SELECT * FROM alarm_records'
    const conditions: string[] = []
    const params: any[] = []

    if (status) {
      conditions.push('status = ?')
      params.push(status)
    }
    if (severity) {
      conditions.push('severity = ?')
      params.push(severity)
    }
    if (alarmType) {
      conditions.push('alarm_type = ?')
      params.push(alarmType)
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
    const countResult = await db.query<{ total: number }[]>(countQuery, params)
    const total = countResult[0]?.total || 0

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(pageSize, (page - 1) * pageSize)

    const rows = await db.query<AlarmRecord[]>(query, params)

    return NextResponse.json({
      success: true,
      data: rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('获取报警记录失败:', error)
    return NextResponse.json(
      { success: false, error: '获取报警记录失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/alarms/records
 * 创建报警记录（系统自动触发）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { rule_id, sensor_id, sensor_type, alarm_type, severity, message, value, threshold_info } = body

    if (!alarm_type || !severity || !message) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      )
    }

    const result = await db.execute<ResultSetHeader>(
      `INSERT INTO alarm_records (rule_id, sensor_id, sensor_type, alarm_type, severity, message, value, threshold_info)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [rule_id || null, sensor_id || null, sensor_type || null, alarm_type, severity, message, value || null, threshold_info || null]
    )

    const newId = (result as any).lastID || (result as any).insertId

    return NextResponse.json({
      success: true,
      data: { id: newId },
      message: '报警记录创建成功',
    })
  } catch (error) {
    console.error('创建报警记录失败:', error)
    return NextResponse.json(
      { success: false, error: '创建报警记录失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/alarms/records
 * 更新报警记录状态（确认/解决）
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, acknowledged_by } = body

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数：id, status' },
        { status: 400 }
      )
    }

    let updateQuery = 'UPDATE alarm_records SET status = ?'
    const params: any[] = [status]

    if (status === 'acknowledged') {
      updateQuery += ', acknowledged_by = ?, acknowledged_at = CURRENT_TIMESTAMP'
      params.push(acknowledged_by || 'system')
    } else if (status === 'resolved') {
      updateQuery += ', resolved_at = CURRENT_TIMESTAMP'
    }

    updateQuery += ' WHERE id = ?'
    params.push(id)

    await db.execute(updateQuery, params)

    return NextResponse.json({
      success: true,
      message: '报警记录更新成功',
    })
  } catch (error) {
    console.error('更新报警记录失败:', error)
    return NextResponse.json(
      { success: false, error: '更新报警记录失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
