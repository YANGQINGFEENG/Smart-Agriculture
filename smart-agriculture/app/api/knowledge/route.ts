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
 * GET /api/knowledge
 * 获取知识库列表（支持分页、筛选）
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20')
    const category = url.searchParams.get('category')
    const status = url.searchParams.get('status')
    const search = url.searchParams.get('search')

    let query = 'SELECT * FROM knowledge_base'
    const conditions: string[] = []
    const params: any[] = []

    if (category) {
      conditions.push('category = ?')
      params.push(category)
    }
    if (status) {
      conditions.push('status = ?')
      params.push(status)
    }
    if (search) {
      conditions.push('(title LIKE ? OR content LIKE ? OR tags LIKE ?)')
      params.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
    const countResult = await db.query<{ total: number }[]>(countQuery, params)
    const total = countResult[0]?.total || 0

    query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?'
    params.push(pageSize, (page - 1) * pageSize)

    const rows = await db.query<KnowledgeItem[]>(query, params)

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
    console.error('获取知识库列表失败:', error)
    return NextResponse.json(
      { success: false, error: '获取知识库列表失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/knowledge
 * 新增知识
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.title || !body.content || !body.category) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数：title, content, category' },
        { status: 400 }
      )
    }

    const result = await db.execute<ResultSetHeader>(
      `INSERT INTO knowledge_base (title, content, category, tags, source, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        body.title,
        body.content,
        body.category,
        body.tags || null,
        body.source || null,
        body.status || 'draft',
      ]
    )

    const newId = (result as any).lastID || (result as any).insertId

    return NextResponse.json({
      success: true,
      data: {
        id: newId,
        title: body.title,
        status: body.status || 'draft',
      },
      message: '知识添加成功',
    })
  } catch (error) {
    console.error('添加知识失败:', error)
    return NextResponse.json(
      { success: false, error: '添加知识失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
