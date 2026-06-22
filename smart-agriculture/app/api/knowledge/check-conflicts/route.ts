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
 * 冲突检测 - 内容级别相似度检测
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
    const searchText = `${title || ''} ${content || ''}`

    // 1. 提取关键短语
    const keyPhrases = extractKeyPhrases(searchText)

    // 2. 搜索包含关键短语的知识
    if (keyPhrases.length > 0) {
      const likeParts: string[] = []
      const params: any[] = []

      keyPhrases.forEach(phrase => {
        likeParts.push('title LIKE ?')
        likeParts.push('content LIKE ?')
        params.push(`%${phrase}%`, `%${phrase}%`)
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

        const similarity = calculateMultiSimilarity(
          title || '', content || '',
          row.title, row.content
        )

        if (similarity.score > 0.25) {
          conflicts.push({
            id: row.id,
            title: row.title,
            category: row.category,
            similarity: Math.round(similarity.score * 100),
            existing_content: row.content.substring(0, 300) + (row.content.length > 300 ? '...' : ''),
            created_at: row.created_at,
            type: similarity.type,
            suggestion: getSuggestion(similarity.type, similarity.score),
            match_details: similarity.details,
          })
        }
      })
    }

    // 3. 同分类统计
    const sameCategoryCount = category
      ? await db.query<{ count: number }[]>(
          `SELECT COUNT(*) as count FROM knowledge_base WHERE category = ? AND status = 'published'`,
          [category]
        )
      : [{ count: 0 }]

    return NextResponse.json({
      success: true,
      data: {
        conflicts: conflicts.sort((a, b) => b.similarity - a.similarity).slice(0, 5),
        total_conflicts: conflicts.length,
        has_high_conflicts: conflicts.some(c => c.similarity > 70),
        has_medium_conflicts: conflicts.some(c => c.similarity > 40),
        same_category_count: sameCategoryCount[0]?.count || 0,
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

/**
 * 提取关键短语
 */
function extractKeyPhrases(text: string): string[] {
  const cleaned = text.replace(/[，。！？、；：""''（）\[\]【】\s]/g, '')
  const phrases: string[] = []

  for (let i = 0; i < cleaned.length - 1; i++) {
    for (let len = 2; len <= 4; len++) {
      if (i + len <= cleaned.length) {
        const phrase = cleaned.substring(i, i + len)
        if (!/^[的了在是我有和就不人都一]/.test(phrase)) {
          phrases.push(phrase)
        }
      }
    }
  }

  return [...new Set(phrases)].slice(0, 10)
}

/**
 * 多维度相似度计算
 */
function calculateMultiSimilarity(
  title1: string, content1: string,
  title2: string, content2: string
): { score: number; type: string; details: string[] } {
  const details: string[] = []

  // 标题相似度
  const titleSim = calculateTextSimilarity(title1, title2)
  if (titleSim > 0.5) details.push(`标题相似: ${Math.round(titleSim * 100)}%`)

  // 内容关键词重叠
  const contentSim = calculateKeywordOverlap(content1, content2)
  if (contentSim > 0.3) details.push(`内容重叠: ${Math.round(contentSim * 100)}%`)

  // 共同实体（数字、单位）
  const entitySim = calculateEntityOverlap(
    title1 + content1,
    title2 + content2
  )
  if (entitySim > 0.3) details.push(`共同数据: ${Math.round(entitySim * 100)}%`)

  // 加权总分
  const score = titleSim * 0.4 + contentSim * 0.4 + entitySim * 0.2

  let type = 'low_overlap'
  if (score > 0.7) type = 'high_overlap'
  else if (score > 0.5) type = 'medium_overlap'
  else if (score > 0.25) type = 'related'

  if (titleSim > 0.8) type = 'similar_title'

  return { score, type, details }
}

function calculateTextSimilarity(text1: string, text2: string): number {
  const chars1 = new Set(text1.replace(/[，。！？、；：""''（）\s]/g, '').split(''))
  const chars2 = new Set(text2.replace(/[，。！？、；：""''（）\s]/g, '').split(''))
  const intersection = new Set([...chars1].filter(c => chars2.has(c)))
  const union = new Set([...chars1, ...chars2])
  return union.size > 0 ? intersection.size / union.size : 0
}

function calculateKeywordOverlap(text1: string, text2: string): number {
  const kw1 = extractKeyPhrases(text1)
  const kw2 = extractKeyPhrases(text2)
  const set1 = new Set(kw1)
  const set2 = new Set(kw2)
  const intersection = new Set([...set1].filter(k => set2.has(k)))
  const union = new Set([...set1, ...set2])
  return union.size > 0 ? intersection.size / union.size : 0
}

function calculateEntityOverlap(text1: string, text2: string): number {
  const entityPattern = /\d+[%倍亩斤克升℃°]|\d+[月日天时分]/g
  const entities1 = new Set(text1.match(entityPattern) || [])
  const entities2 = new Set(text2.match(entityPattern) || [])
  if (entities1.size === 0 && entities2.size === 0) return 0
  const intersection = new Set([...entities1].filter(e => entities2.has(e)))
  const union = new Set([...entities1, ...entities2])
  return union.size > 0 ? intersection.size / union.size : 0
}

function getSuggestion(type: string, score: number): string {
  switch (type) {
    case 'similar_title': return '标题高度相似，建议合并'
    case 'high_overlap': return '内容高度重叠，建议合并'
    case 'medium_overlap': return '内容有较多重叠，可补充差异化'
    case 'related': return '内容相关，可独立添加'
    default: return '可以添加'
  }
}
