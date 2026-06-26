import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket } from '@/lib/db'
import { semanticSearch, getRagStatus } from '@/lib/knowledge-rag'

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
 * 搜索知识（支持关键词+语义检索）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, mode = 'hybrid', top_k = 5, category } = body

    if (!query) {
      return NextResponse.json(
        { success: false, error: '缺少搜索关键词' },
        { status: 400 }
      )
    }

    let results: any[] = []

    // 语义搜索
    if (mode === 'semantic' || mode === 'hybrid') {
      try {
        const semanticResults = await semanticSearch(query, top_k)
        results = semanticResults.map(r => ({
          ...r,
          search_type: 'semantic',
        }))
      } catch (error) {
        console.log('语义搜索不可用，使用关键词搜索')
      }
    }

    // 关键词搜索
    if (mode === 'keyword' || mode === 'hybrid') {
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

      const keywordResults = rows.map(row => ({
        id: row.id,
        title: row.title,
        content: row.content,
        category: row.category,
        tags: row.tags,
        source: row.source,
        score: row.relevance / 3,
        search_type: 'keyword',
      }))

      // 合并结果（去重）
      const existingIds = new Set(results.map(r => r.id))
      keywordResults.forEach(r => {
        if (!existingIds.has(r.id)) {
          results.push(r)
          existingIds.add(r.id)
        }
      })
    }

    // 按分数排序
    results.sort((a, b) => (b.score || 0) - (a.score || 0))

    return NextResponse.json({
      success: true,
      data: results.slice(0, top_k),
      total: results.length,
      mode,
    })
  } catch (error) {
    console.error('搜索知识失败:', error)
    return NextResponse.json(
      { success: false, error: '搜索失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
