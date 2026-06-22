import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket } from '@/lib/db'

interface KnowledgeItem extends RowDataPacket {
  id: number
  title: string
  content: string
  category: string
  tags: string | null
}

// 中文停用词（常见无意义词）
const STOP_WORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
  '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
  '自己', '这', '他', '她', '它', '们', '那', '些', '被', '从', '对', '把', '能',
  '可以', '这个', '那个', '什么', '怎么', '如何', '为', '而', '与', '及', '等',
  '但', '或', '如', '若', '则', '因', '所以', '但是', '然后', '因为', '如果',
])

/**
 * POST /api/knowledge/check-conflicts
 * 冲突检测API - 优化版
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

    // 1. 标题精确匹配 - 最高优先级
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

    // 2. 标题关键词匹配（提取有意义的关键词）
    if (title) {
      const titleKeywords = extractMeaningfulKeywords(title)
      if (titleKeywords.length > 0) {
        // 构建查询：标题包含任意关键词
        const likeParts = titleKeywords.map(() => 'title LIKE ?')
        const params: any[] = titleKeywords.map(kw => `%${kw}%`)

        const whereClause = `status != 'archived' ${exclude_id ? 'AND id != ?' : ''}`
        if (exclude_id) params.push(exclude_id)

        const rows = await db.query<KnowledgeItem[]>(
          `SELECT id, title, content, category, tags, created_at FROM knowledge_base
           WHERE ${whereClause} AND (${likeParts.join(' OR ')})
           ORDER BY updated_at DESC LIMIT 10`,
          params
        )

        rows.forEach(row => {
          if (conflicts.find(c => c.id === row.id)) return

          // 计算标题相似度（基于关键词匹配）
          const titleSimilarity = calculateTitleSimilarity(title, row.title)
          if (titleSimilarity > 0.5) {
            conflicts.push({
              id: row.id,
              title: row.title,
              category: row.category,
              similarity: Math.round(titleSimilarity * 100),
              existing_content: row.content.substring(0, 300) + (row.content.length > 300 ? '...' : ''),
              created_at: row.created_at,
              type: titleSimilarity > 0.8 ? 'high_overlap' : 'medium_overlap',
              suggestion: titleSimilarity > 0.8
                ? '高度重叠：建议合并到已有知识'
                : '中度重叠：建议补充差异化内容',
            })
          }
        })
      }
    }

    // 3. 内容关键词匹配（只在标题匹配不多时才检查内容）
    if (content && conflicts.length < 3) {
      const contentKeywords = extractMeaningfulKeywords(content)
      if (contentKeywords.length >= 2) {
        const likeParts = contentKeywords.slice(0, 5).map(() => 'content LIKE ?')
        const params: any[] = contentKeywords.slice(0, 5).map(kw => `%${kw}%`)

        const whereClause = `status != 'archived' ${exclude_id ? 'AND id != ?' : ''}`
        if (exclude_id) params.push(exclude_id)

        const rows = await db.query<KnowledgeItem[]>(
          `SELECT id, title, content, category, tags, created_at FROM knowledge_base
           WHERE ${whereClause} AND (${likeParts.join(' OR ')})
           ORDER BY updated_at DESC LIMIT 5`,
          params
        )

        rows.forEach(row => {
          if (conflicts.find(c => c.id === row.id)) return

          const contentSimilarity = calculateContentSimilarity(content, row.content)
          if (contentSimilarity > 0.4) {
            conflicts.push({
              id: row.id,
              title: row.title,
              category: row.category,
              similarity: Math.round(contentSimilarity * 100),
              existing_content: row.content.substring(0, 300) + (row.content.length > 300 ? '...' : ''),
              created_at: row.created_at,
              type: contentSimilarity > 0.7 ? 'high_overlap' : 'medium_overlap',
              suggestion: contentSimilarity > 0.7
                ? '内容高度相似：建议合并'
                : '内容有部分重叠，可考虑补充差异化内容',
            })
          }
        })
      }
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

/**
 * 提取有意义的关键词（过滤停用词）
 */
function extractMeaningfulKeywords(text: string): string[] {
  // 清理文本
  const cleaned = text.replace(/[，。！？、；：""''（）\[\]【】\(\)《》]/g, ' ')

  // 方法1：按标点和空格分词，保留2字以上的词
  const words = cleaned.split(/[\s,，.。!！?？;；:：]+/).filter(w => w.length >= 2 && !STOP_WORDS.has(w))

  // 方法2：提取连续2-4字的词组
  const charCleaned = text.replace(/[，。！？、；：""''（）\[\]【】\s]/g, '')
  const phrases: string[] = []
  for (let i = 0; i < charCleaned.length - 1; i++) {
    const phrase = charCleaned.substring(i, i + 2)
    if (!STOP_WORDS.has(phrase) && /[一-龥]/.test(phrase)) {
      phrases.push(phrase)
    }
  }

  // 合并并去重
  const allKeywords = [...words, ...phrases]
  const unique = [...new Set(allKeywords)]

  // 过滤掉太常见的词
  return unique.filter(kw => kw.length >= 2).slice(0, 8)
}

/**
 * 计算标题相似度（基于关键词匹配）
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  const keywords1 = extractMeaningfulKeywords(title1)
  const keywords2 = extractMeaningfulKeywords(title2)

  if (keywords1.length === 0 || keywords2.length === 0) return 0

  // 计算关键词匹配率
  const set2 = new Set(keywords2)
  const matched = keywords1.filter(kw => set2.has(kw))
  const matchRate = matched.length / Math.min(keywords1.length, keywords2.length)

  // 如果标题长度相近且匹配率高，相似度更高
  const lengthRatio = Math.min(title1.length, title2.length) / Math.max(title1.length, title2.length)

  return matchRate * 0.7 + lengthRatio * 0.3
}

/**
 * 计算内容相似度（基于关键词重叠）
 */
function calculateContentSimilarity(content1: string, content2: string): number {
  const keywords1 = extractMeaningfulKeywords(content1)
  const keywords2 = extractMeaningfulKeywords(content2)

  if (keywords1.length === 0 || keywords2.length === 0) return 0

  const set1 = new Set(keywords1)
  const set2 = new Set(keywords2)

  const intersection = new Set([...set1].filter(kw => set2.has(kw)))
  const union = new Set([...set1, ...set2])

  return union.size > 0 ? intersection.size / union.size : 0
}
