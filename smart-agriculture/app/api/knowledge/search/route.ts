import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket } from '@/lib/db'

interface KnowledgeItem extends RowDataPacket {
  id: number
  title: string
  content: string
  category: string
  tags: string | null
  source: string | null
  status: string
}

/**
 * POST /api/knowledge/search
 * 搜索知识（关键词检索）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, mode = 'keyword', top_k = 5, category } = body

    if (!query) {
      return NextResponse.json(
        { success: false, error: '缺少搜索关键词' },
        { status: 400 }
      )
    }

    let sqlQuery = `
      SELECT id, title, content, category, tags, source, status,
        CASE
          WHEN title LIKE ? THEN 3
          WHEN content LIKE ? THEN 2
          WHEN tags LIKE ? THEN 1
          ELSE 0
        END as relevance
      FROM knowledge_base
      WHERE status = 'published'
    `
    const params: any[] = [`%${query}%`, `%${query}%`, `%${query}%`]

    if (category) {
      sqlQuery += ' AND category = ?'
      params.push(category)
    }

    sqlQuery += ' ORDER BY relevance DESC, updated_at DESC LIMIT ?'
    params.push(top_k)

    const rows = await db.query<KnowledgeItem[]>(sqlQuery, params)

    const results = rows.map(row => ({
      id: row.id,
      title: row.title,
      content: row.content,
      category: row.category,
      tags: row.tags,
      source: row.source,
      similarity: row.relevance / 3,
    }))

    return NextResponse.json({
      success: true,
      data: results,
      total: results.length,
    })
  } catch (error) {
    console.error('搜索知识失败:', error)
    return NextResponse.json(
      { success: false, error: '搜索知识失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
