import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'
import { successResponse, errorResponse, serverErrorResponse, validateParams, handleApiRequest } from '@/lib/api-utils'
import { cacheService } from '@/lib/redis'

/**
 * 执行器数据接口
 */
interface Actuator extends RowDataPacket {
  id: string
  name: string
  type_id: number
  location: string
  status: 'online' | 'offline'
  state: 'on' | 'off'
  mode: 'auto' | 'manual'
  last_update: Date | null
  created_at: Date
  type?: string
  type_name?: string
}

/**
 * 执行器类型数据接口
 */
interface ActuatorType extends RowDataPacket {
  id: number
  type: string
  name: string
  description: string
}

/**
 * GET /api/actuators
 * 获取所有执行器
 * 支持按类型过滤：?type=water_pump
 */
export async function GET(request: NextRequest) {
  return handleApiRequest(async () => {
    const url = new URL(request.url)
    const type = url.searchParams.get('type')

    // 生成缓存键
    const cacheKey = type ? `actuators:list:${type}` : 'actuators:list'

    // 尝试从缓存获取数据
    const cachedData = await cacheService.get(cacheKey)
    if (cachedData) {
      return NextResponse.json(cachedData)
    }

    let query = `
      SELECT 
        a.id, 
        a.name, 
        a.type_id, 
        a.location, 
        a.status, 
        a.state, 
        a.mode,
        a.last_update, 
        a.created_at,
        at.type,
        at.name as type_name,
        at.description
      FROM actuators a
      INNER JOIN actuator_types at ON a.type_id = at.id
    `

    const params: any[] = []

    if (type) {
      query += ' WHERE at.type = ?'
      params.push(type)
    }

    query += ' ORDER BY a.id'

    const rows = await db.query<Actuator[]>(query, params)

    const responseData = {
      success: true,
      data: rows,
      total: rows.length,
    }

    // 将结果缓存
    await cacheService.set(cacheKey, responseData, 600) // 10分钟过期

    return successResponse(rows, undefined, rows.length)
  })
}

/**
 * POST /api/actuators
 * 新增执行器
 */
export async function POST(request: NextRequest) {
  return handleApiRequest(async () => {
    const body = await request.json()
    
    // 验证参数
    const validation = validateParams(body, ['name', 'type_id', 'location'])
    if (!validation.valid) {
      return errorResponse(validation.error!)
    }

    const types = await db.query<ActuatorType[]>(
      'SELECT id, type FROM actuator_types WHERE id = ?',
      [body.type_id]
    )

    if (types.length === 0) {
      return errorResponse('执行器类型不存在')
    }

    const typePrefix = types[0].type.split('_').map(word => word.charAt(0).toUpperCase()).join('')
    
    const existingActuators = await db.query<Actuator[]>(
      'SELECT id FROM actuators WHERE id LIKE ? ORDER BY id DESC',
      [`${typePrefix}-%`]
    )

    let newIdNumber = 1
    if (existingActuators.length > 0) {
      const lastId = existingActuators[0].id
      const lastNumber = parseInt(lastId.split('-')[1])
      if (!isNaN(lastNumber)) {
        newIdNumber = lastNumber + 1
      }
    }

    const actuatorId = `${typePrefix}-${newIdNumber.toString().padStart(3, '0')}`

    await db.execute<ResultSetHeader>(
      `INSERT INTO actuators (id, name, type_id, location, status, state, mode, last_update) 
       VALUES (?, ?, ?, ?, 'offline', 'off', 'auto', NULL)`,
      [actuatorId, body.name, body.type_id, body.location]
    )

    const newActuators = await db.query<Actuator[]>(
      `SELECT 
        a.id, 
        a.name, 
        a.type_id, 
        a.location, 
        a.status, 
        a.state, 
        a.mode,
        a.last_update, 
        a.created_at,
        at.type,
        at.name as type_name,
        at.description
      FROM actuators a
      INNER JOIN actuator_types at ON a.type_id = at.id
      WHERE a.id = ?`,
      [actuatorId]
    )

    // 清除缓存
    await cacheService.delete('actuators:list*')

    return successResponse(newActuators[0], '执行器创建成功')
  })
}
