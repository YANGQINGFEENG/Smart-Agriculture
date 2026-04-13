import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'

/**
 * 传感器数据接口
 */
interface SensorData extends RowDataPacket {
  id: number
  sensor_id: string
  value: number
  timestamp: Date
}

/**
 * 传感器接口
 */
interface Sensor extends RowDataPacket {
  id: string
  name: string
  type_id: number
  location: string
  status: 'online' | 'offline'
  battery: number
  last_update: Date | null
}

/**
 * GET /api/sensors/[id]/data
 * 获取传感器历史数据
 * 支持参数：
 * - startTime: 开始时间
 * - endTime: 结束时间
 * - limit: 返回数量限制（默认100）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const startTime = url.searchParams.get('startTime')
    const endTime = url.searchParams.get('endTime')
    const limit = parseInt(url.searchParams.get('limit') || '100', 10)

    const sensors = await db.query<Sensor[]>(
      'SELECT id FROM sensors WHERE id = ?',
      [id]
    )

    if (sensors.length === 0) {
      return NextResponse.json(
        { success: false, error: '传感器不存在' },
        { status: 404 }
      )
    }

    let query = 'SELECT id, sensor_id, value, timestamp FROM sensor_data WHERE sensor_id = ?'
    const queryParams: any[] = [id]

    if (startTime) {
      query += ' AND timestamp >= ?'
      queryParams.push(new Date(startTime))
    }

    if (endTime) {
      query += ' AND timestamp <= ?'
      queryParams.push(new Date(endTime))
    }

    query += ' ORDER BY timestamp DESC LIMIT ?'
    queryParams.push(limit)

    const data = await db.query<SensorData[]>(query, queryParams)

    const statsQuery = `
      SELECT 
        AVG(value) as avg,
        MAX(value) as max,
        MIN(value) as min
      FROM sensor_data 
      WHERE sensor_id = ?
      ${startTime ? ' AND timestamp >= ?' : ''}
      ${endTime ? ' AND timestamp <= ?' : ''}
    `

    const statsParams: any[] = [id]
    if (startTime) statsParams.push(new Date(startTime))
    if (endTime) statsParams.push(new Date(endTime))

    const statsResult = await db.query<(RowDataPacket & { avg: number | string; max: number | string; min: number | string })[]>(
      statsQuery,
      statsParams
    )

    const stats = {
      avg: statsResult[0]?.avg ? parseFloat(Number(statsResult[0].avg).toFixed(2)) : 0,
      max: statsResult[0]?.max ? Number(statsResult[0].max) : 0,
      min: statsResult[0]?.min ? Number(statsResult[0].min) : 0,
    }

    return NextResponse.json({
      success: true,
      data,
      stats,
      total: data.length,
    })
  } catch (error) {
    console.error('获取传感器数据失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '获取传感器数据失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/sensors/[id]/data
 * 新增传感器数据
 * 用于硬件设备上传传感器数据
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const body = await request.json()
    
    console.log(`[Sensor] 收到传感器数据上传请求 - ID: ${id}, 数据:`, JSON.stringify(body))
    
    if (typeof body.value !== 'number') {
      console.log(`[Sensor] 参数错误 - ID: ${id}, value类型不正确`)
      return NextResponse.json(
        { success: false, error: '缺少必要参数：value（数值类型）' },
        { status: 400 }
      )
    }

    const sensors = await db.query<Sensor[]>(
      'SELECT id FROM sensors WHERE id = ?',
      [id]
    )

    if (sensors.length === 0) {
      console.log(`[Sensor] 传感器不存在 - ID: ${id}`)
      return NextResponse.json(
        { success: false, error: '传感器不存在' },
        { status: 404 }
      )
    }

    if (body.value === 0) {
      console.log(`[Sensor] 数据值为0，跳过更新 - ID: ${id}`)
      return NextResponse.json({
        success: true,
        data: null,
        message: 'OK',
      })
    }

    const result = await db.execute<ResultSetHeader>(
      'INSERT INTO sensor_data (sensor_id, value) VALUES (?, ?)',
      [id, parseFloat(body.value.toFixed(2))]
    )

    await db.execute<ResultSetHeader>(
      'UPDATE sensors SET status = ?, last_update = CURRENT_TIMESTAMP WHERE id = ?',
      ['online', id]
    )

    const newData = await db.query<SensorData[]>(
      'SELECT id, sensor_id, value, timestamp FROM sensor_data WHERE id = ?',
      [result.insertId]
    )

    console.log(`[Sensor] 传感器数据保存成功 - ID: ${id}, 值: ${newData[0].value}`)

    return NextResponse.json({
      success: true,
      data: newData[0],
      message: 'OK',
    })
  } catch (error) {
    console.error('[Sensor] 保存传感器数据失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '保存传感器数据失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}
