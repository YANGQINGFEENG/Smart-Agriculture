import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket } from '@/lib/db'

interface KnowledgeItem extends RowDataPacket {
  id: number
  title: string
  content: string
  category: string
  tags: string | null
}

/**
 * POST /api/knowledge/check-conflicts
 * 检查知识冲突（手动触发）
 *
 * 输入: title, content, category
 * 输出: 冲突列表，包含相似度和建议
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, content, category, exclude_id } = body

    if (!title && !content) {
      return NextResponse.json(
        { success: false, error: '请提供标题或内容进行冲突检测' },
        { status: 400 }
      )
    }

    const conflicts: any[] = []
    const searchText = `${title} ${content}`

    // 1. 标题完全匹配
    if (title) {
      const exactTitleRows = await db.query<KnowledgeItem[]>(
        `SELECT id, title, content, category, tags, created_at FROM knowledge_base
         WHERE title = ? AND status != 'archived' ${exclude_id ? 'AND id != ?' : ''}`,
        exclude_id ? [title, exclude_id] : [title]
      )

      exactTitleRows.forEach(row => {
        conflicts.push({
          id: row.id,
          title: row.title,
          category: row.category,
          similarity: 100,
          existing_content: row.content.substring(0, 300) + (row.content.length > 300 ? '...' : ''),
          created_at: row.created_at,
          type: 'exact_title',
          suggestion: '标题完全相同，建议合并或更新已有知识',
        })
      })
    }

    // 2. 关键词相似度搜索
    const keywords = extractKeywords(searchText)
    if (keywords.length > 0) {
      const likeParts: string[] = []
      const params: any[] = []

      keywords.forEach(kw => {
        likeParts.push('title LIKE ?')
        likeParts.push('content LIKE ?')
        params.push(`%${kw}%`, `%${kw}%`)
      })

      const whereClause = `status != 'archived' ${exclude_id ? 'AND id != ?' : ''}`
      if (exclude_id) params.push(exclude_id)

      const rows = await db.query<KnowledgeItem[]>(
        `SELECT id, title, content, category, tags, created_at FROM knowledge_base
         WHERE ${whereClause} AND (${likeParts.join(' OR ')})
         ORDER BY updated_at DESC LIMIT 20`,
        params
      )

      rows.forEach(row => {
        if (conflicts.find(c => c.id === row.id)) return

        const similarity = calculateSimilarity(searchText, row.title + ' ' + row.content)
        if (similarity > 0.25) {
          const type = similarity > 0.7 ? 'high_overlap' : similarity > 0.5 ? 'medium_overlap' : 'low_overlap'
          const suggestion = getSuggestion(type, similarity)

          conflicts.push({
            id: row.id,
            title: row.title,
            category: row.category,
            similarity: Math.round(similarity * 100),
            existing_content: row.content.substring(0, 300) + (row.content.length > 300 ? '...' : ''),
            created_at: row.created_at,
            type,
            suggestion,
          })
        }
      })
    }

    // 3. 同分类下的所有知识（用于对比）
    if (category) {
      const categoryRows = await db.query<KnowledgeItem[]>(
        `SELECT id, title, category, tags FROM knowledge_base
         WHERE category = ? AND status = 'published'
         ORDER BY updated_at DESC LIMIT 10`,
        [category]
      )

      return NextResponse.json({
        success: true,
        data: {
          conflicts: conflicts.sort((a, b) => b.similarity - a.similarity),
          same_category: categoryRows.map(r => ({ id: r.id, title: r.title })),
          total_conflicts: conflicts.length,
          has_high_conflicts: conflicts.some(c => c.similarity > 70),
          has_medium_conflicts: conflicts.some(c => c.similarity > 40),
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        conflicts: conflicts.sort((a, b) => b.similarity - a.similarity),
        total_conflicts: conflicts.length,
        has_high_conflicts: conflicts.some(c => c.similarity > 70),
        has_medium_conflicts: conflicts.some(c => c.similarity > 40),
      },
    })
  } catch (error) {
    console.error('冲突检测失败:', error)
    return NextResponse.json(
      { success: false, error: '冲突检测失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

function extractKeywords(text: string): string[] {
  const cleaned = text.replace(/[，。！？、；：""''（）\[\]【】]/g, ' ')
  const words = cleaned.split(/\s+/).filter(w => w.length >= 2)
  return [...new Set(words)].slice(0, 8)
}

function calculateSimilarity(text1: string, text2: string): number {
  const chars1 = new Set(text1.replace(/[，。！？、；：""''（）\[\]【】\s]/g, '').split(''))
  const chars2 = new Set(text2.replace(/[，。！？、；：""''（）\[\]【】\s]/g, '').split(''))
  const intersection = new Set([...chars1].filter(w => chars2.has(w)))
  const union = new Set([...chars1, ...chars2])
  return union.size > 0 ? intersection.size / union.size : 0
}

function getSuggestion(type: string, similarity: number): string {
  if (type === 'high_overlap' || similarity > 0.7) {
    return '高度重叠：建议合并到已有知识，或更新已有知识的内容'
  }
  if (type === 'medium_overlap' || similarity > 0.5) {
    return '中度重叠：建议补充差异化内容，或标记为相关知识'
  }
  return '低度重叠：内容有部分相似，可以作为独立知识添加'
}
