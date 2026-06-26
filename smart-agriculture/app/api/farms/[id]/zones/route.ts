import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'

interface Zone extends RowDataPacket {
  id: number
  farm_id: number
  name: string
  code: string
}

/**
 * GET /api/farms/[id]/zones
 * 获取基地下的区域列表
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const rows = await db.query<Zone[]>(
      'SELECT * FROM zones WHERE farm_id = ? ORDER BY name',
      [id]
    )

    return NextResponse.json({
      success: true,
      data: rows,
      total: rows.length,
    })
  } catch (error) {
    console.error('获取区域列表失败:', error)
    return NextResponse.json(
      { success: false, error: '获取区域列表失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/farms/[id]/zones
 * 创建区域
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, code, zone_type, area, description } = body

    if (!name || !code) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数：name, code' },
        { status: 400 }
      )
    }

    // 检查基地是否存在
    const farmExists = await db.query<any[]>(
      'SELECT id FROM farms WHERE id = ?',
      [id]
    )

    if (farmExists.length === 0) {
      return NextResponse.json(
        { success: false, error: '基地不存在' },
        { status: 404 }
      )
    }

    // 检查区域编码是否已存在
    const existing = await db.query<Zone[]>(
      'SELECT id FROM zones WHERE farm_id = ? AND code = ?',
      [id, code]
    )

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: '区域编码已存在' },
        { status: 400 }
      )
    }

    const result = await db.execute<ResultSetHeader>(
      `INSERT INTO zones (farm_id, name, code, zone_type, area, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, code, zone_type || 'greenhouse', area || null, description || null]
    )

    const newId = (result as any).lastID || (result as any).insertId

    return NextResponse.json({
      success: true,
      data: { id: newId, name, code },
      message: '区域创建成功',
    })
  } catch (error) {
    console.error('创建区域失败:', error)
    return NextResponse.json(
      { success: false, error: '创建区域失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
