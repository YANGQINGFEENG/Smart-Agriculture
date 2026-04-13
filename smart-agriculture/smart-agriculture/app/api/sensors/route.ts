import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'

/**
 * 传感器数据接口
 */
interface Sensor extends RowDataPacket {
  id: string
  name: string
  type_id: number
  location: string
  status: 'online' | 'offline'
  battery: number
  last_update: Date | null
  created_at: Date
  type?: string
  type_name?: string
  unit?: string
}

/**
 * 传感器类型数据接口
 */
interface SensorType extends RowDataPacket {
  id: number
  type: string
  name: string
  unit: string
}

/**
 * GET /api/sensors
 * 获取所有传感器
 * 支持按类型过滤：?type=temperature
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const type = url.searchParams.get('type')

    let query = `
      SELECT 
        s.id, 
        s.name, 
        s.type_id, 
        s.location, 
        s.status, 
        s.battery, 
        s.last_update, 
        s.created_at,
        st.type,
        st.name as type_name,
        st.unit
      FROM sensors s
      INNER JOIN sensor_types st ON s.type_id = st.id
    `

    const params: any[] = []

    if (type) {
      query += ' WHERE st.type = ?'
      params.push(type)
    }

    query += ' ORDER BY s.id'

    const rows = await db.query<Sensor[]>(query, params)

    return NextResponse.json({
      success: true,
      data: rows,
      total: rows.length,
    })
  } catch (error) {
    console.error('获取传感器列表失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '获取传感器列表失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/sensors
 * 新增传感器
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    if (!body.name || !body.type_id || !body.location) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数：name, type_id, location' },
        { status: 400 }
      )
    }

    const types = await db.query<SensorType[]>(
      'SELECT id, type FROM sensor_types WHERE id = ?',
      [body.type_id]
    )

    if (types.length === 0) {
      return NextResponse.json(
        { success: false, error: '传感器类型不存在' },
        { status: 400 }
      )
    }

    const typePrefix = types[0].type.charAt(0).toUpperCase()
    
    const existingSensors = await db.query<Sensor[]>(
      'SELECT id FROM sensors WHERE id LIKE ? ORDER BY id DESC',
      [`${typePrefix}-%`]
    )

    let newIdNumber = 1
    if (existingSensors.length > 0) {
      const lastId = existingSensors[0].id
      const lastNumber = parseInt(lastId.split('-')[1])
      if (!isNaN(lastNumber)) {
        newIdNumber = lastNumber + 1
      }
    }

    const sensorId = `${typePrefix}-${newIdNumber.toString().padStart(3, '0')}`

    await db.execute<ResultSetHeader>(
      `INSERT INTO sensors (id, name, type_id, location, status, battery, last_update) 
       VALUES (?, ?, ?, ?, 'offline', 100, NULL)`,
      [sensorId, body.name, body.type_id, body.location]
    )

    const newSensors = await db.query<Sensor[]>(
      `SELECT 
        s.id, 
        s.name, 
        s.type_id, 
        s.location, 
        s.status, 
        s.battery, 
        s.last_update, 
        s.created_at,
        st.type,
        st.name as type_name,
        st.unit
      FROM sensors s
      INNER JOIN sensor_types st ON s.type_id = st.id
      WHERE s.id = ?`,
      [sensorId]
    )

    return NextResponse.json({
      success: true,
      data: newSensors[0],
      message: '传感器创建成功',
    })
  } catch (error) {
    console.error('创建传感器失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '创建传感器失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}
