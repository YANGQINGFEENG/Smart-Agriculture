import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'

interface Farm extends RowDataPacket {
  id: number
  name: string
  code: string
  address: string | null
  latitude: number | null
  longitude: number | null
  area: number | null
  farm_type: string
  status: string
  created_at: Date
}

/**
 * GET /api/farms
 * 获取基地列表
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')

    let query = 'SELECT * FROM farms'
    const params: any[] = []

    if (status) {
      query += ' WHERE status = ?'
      params.push(status)
    }

    query += ' ORDER BY created_at DESC'

    const rows = await db.query<Farm[]>(query, params)

    return NextResponse.json({
      success: true,
      data: rows,
      total: rows.length,
    })
  } catch (error) {
    console.error('获取基地列表失败:', error)
    return NextResponse.json(
      { success: false, error: '获取基地列表失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/farms
 * 创建基地
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, code, address, latitude, longitude, area, farm_type } = body

    if (!name || !code) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数：name, code' },
        { status: 400 }
      )
    }

    // 检查编码是否已存在
    const existing = await db.query<Farm[]>(
      'SELECT id FROM farms WHERE code = ?',
      [code]
    )

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: '基地编码已存在' },
        { status: 400 }
      )
    }

    const result = await db.execute<ResultSetHeader>(
      `INSERT INTO farms (name, code, address, latitude, longitude, area, farm_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, code, address || null, latitude || null, longitude || null, area || null, farm_type || 'mixed']
    )

    const newId = (result as any).lastID || (result as any).insertId

    return NextResponse.json({
      success: true,
      data: { id: newId, name, code },
      message: '基地创建成功',
    })
  } catch (error) {
    console.error('创建基地失败:', error)
    return NextResponse.json(
      { success: false, error: '创建基地失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
