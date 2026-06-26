import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'

interface KnowledgeItem extends RowDataPacket {
  id: number
  title: string
  content: string
  category: string
  tags: string | null
  source: string | null
  status: 'draft' | 'published' | 'archived'
  created_at: Date
  updated_at: Date
  vector_index: number | null
}

/**
 * GET /api/knowledge/[id]
 * 获取单条知识详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rows = await db.query<KnowledgeItem[]>(
      'SELECT * FROM knowledge_base WHERE id = ?',
      [id]
    )

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '知识不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: rows[0],
    })
  } catch (error) {
    console.error('获取知识详情失败:', error)
    return NextResponse.json(
      { success: false, error: '获取知识详情失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/knowledge/[id]
 * 更新知识
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await db.query<KnowledgeItem[]>(
      'SELECT id FROM knowledge_base WHERE id = ?',
      [id]
    )

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: '知识不存在' },
        { status: 404 }
      )
    }

    const updates: string[] = []
    const values: any[] = []

    if (body.title !== undefined) { updates.push('title = ?'); values.push(body.title) }
    if (body.content !== undefined) { updates.push('content = ?'); values.push(body.content) }
    if (body.category !== undefined) { updates.push('category = ?'); values.push(body.category) }
    if (body.tags !== undefined) { updates.push('tags = ?'); values.push(body.tags) }
    if (body.source !== undefined) { updates.push('source = ?'); values.push(body.source) }
    if (body.status !== undefined) { updates.push('status = ?'); values.push(body.status) }
    
    updates.push('updated_at = CURRENT_TIMESTAMP')

    if (updates.length > 0) {
      values.push(id)
      await db.execute<ResultSetHeader>(
        `UPDATE knowledge_base SET ${updates.join(', ')} WHERE id = ?`,
        values
      )
    }

    return NextResponse.json({
      success: true,
      message: '知识更新成功',
    })
  } catch (error) {
    console.error('更新知识失败:', error)
    return NextResponse.json(
      { success: false, error: '更新知识失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/knowledge/[id]
 * 删除知识
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.query<KnowledgeItem[]>(
      'SELECT id FROM knowledge_base WHERE id = ?',
      [id]
    )

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: '知识不存在' },
        { status: 404 }
      )
    }

    await db.execute<ResultSetHeader>(
      'DELETE FROM knowledge_base WHERE id = ?',
      [id]
    )

    return NextResponse.json({
      success: true,
      message: '知识删除成功',
    })
  } catch (error) {
    console.error('删除知识失败:', error)
    return NextResponse.json(
      { success: false, error: '删除知识失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
