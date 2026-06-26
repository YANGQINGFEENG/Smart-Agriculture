import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'

interface PromptTemplate extends RowDataPacket {
  id: number
  name: string
  type: string
  content: string
  description: string | null
  variables: string | null
  version: number
  status: 'active' | 'inactive'
  created_at: Date
  updated_at: Date
}

/**
 * GET /api/prompts/[id]
 * 获取模板详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rows = await db.query<PromptTemplate[]>(
      'SELECT * FROM prompt_templates WHERE id = ?',
      [id]
    )

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '模板不存在' },
        { status: 404 }
      )
    }

    const row = rows[0]
    return NextResponse.json({
      success: true,
      data: {
        ...row,
        variables: row.variables ? JSON.parse(row.variables) : [],
      },
    })
  } catch (error) {
    console.error('获取模板详情失败:', error)
    return NextResponse.json(
      { success: false, error: '获取模板详情失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/prompts/[id]
 * 更新模板
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await db.query<PromptTemplate[]>(
      'SELECT id FROM prompt_templates WHERE id = ?',
      [id]
    )

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: '模板不存在' },
        { status: 404 }
      )
    }

    const updates: string[] = []
    const values: any[] = []

    if (body.name !== undefined) { updates.push('name = ?'); values.push(body.name) }
    if (body.type !== undefined) { updates.push('type = ?'); values.push(body.type) }
    if (body.content !== undefined) { updates.push('content = ?'); values.push(body.content) }
    if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description) }
    if (body.variables !== undefined) { updates.push('variables = ?'); values.push(JSON.stringify(body.variables)) }
    if (body.status !== undefined) { updates.push('status = ?'); values.push(body.status) }
    if (body.version !== undefined) { updates.push('version = ?'); values.push(body.version) }
    
    updates.push('updated_at = CURRENT_TIMESTAMP')

    if (updates.length > 0) {
      values.push(id)
      await db.execute<ResultSetHeader>(
        `UPDATE prompt_templates SET ${updates.join(', ')} WHERE id = ?`,
        values
      )
    }

    return NextResponse.json({
      success: true,
      message: '模板更新成功',
    })
  } catch (error) {
    console.error('更新模板失败:', error)
    return NextResponse.json(
      { success: false, error: '更新模板失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/prompts/[id]
 * 删除模板
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.query<PromptTemplate[]>(
      'SELECT id FROM prompt_templates WHERE id = ?',
      [id]
    )

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: '模板不存在' },
        { status: 404 }
      )
    }

    await db.execute<ResultSetHeader>(
      'DELETE FROM prompt_templates WHERE id = ?',
      [id]
    )

    return NextResponse.json({
      success: true,
      message: '模板删除成功',
    })
  } catch (error) {
    console.error('删除模板失败:', error)
    return NextResponse.json(
      { success: false, error: '删除模板失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
