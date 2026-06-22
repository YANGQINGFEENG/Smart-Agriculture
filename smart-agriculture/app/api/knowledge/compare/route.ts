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
 * POST /api/knowledge/compare
 * 多条知识对比分析
 *
 * 输入: ids (知识ID数组)
 * 输出: 每对知识的相似度对比结果
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length < 2) {
      return NextResponse.json(
        { success: false, error: '请选择至少2条知识进行对比' },
        { status: 400 }
      )
    }

    // 获取选中的知识
    const placeholders = ids.map(() => '?').join(',')
    const items = await db.query<KnowledgeItem[]>(
      `SELECT id, title, content, category, tags FROM knowledge_base
       WHERE id IN (${placeholders}) AND status != 'archived'`,
      ids
    )

    if (items.length < 2) {
      return NextResponse.json(
        { success: false, error: '找到的知识不足2条' },
        { status: 400 }
      )
    }

    // 两两对比
    const comparisons: any[] = []
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const result = compareKnowledge(items[i], items[j])
        comparisons.push(result)
      }
    }

    // 统计分析
    const stats = {
      total_pairs: comparisons.length,
      high_overlap: comparisons.filter(c => c.similarity > 70).length,
      medium_overlap: comparisons.filter(c => c.similarity > 40 && c.similarity <= 70).length,
      low_overlap: comparisons.filter(c => c.similarity <= 40).length,
      same_category: items.filter(item =>
        items.some(other => other.id !== item.id && other.category === item.category)
      ).length,
    }

    // 生成合并建议
    const mergeSuggestions = generateMergeSuggestions(comparisons, items)

    return NextResponse.json({
      success: true,
      data: {
        items,
        comparisons,
        stats,
        merge_suggestions: mergeSuggestions,
      },
    })
  } catch (error) {
    console.error('对比分析失败:', error)
    return NextResponse.json(
      { success: false, error: '对比分析失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * 对比两条知识
 */
function compareKnowledge(item1: KnowledgeItem, item2: KnowledgeItem) {
  // 1. 标题相似度
  const titleSimilarity = calculateTextSimilarity(item1.title, item2.title)

  // 2. 内容相似度
  const contentSimilarity = calculateKeywordOverlap(item1.content, item2.content)

  // 3. 共同关键词
  const commonKeywords = findCommonKeywords(item1.content, item2.content)

  // 4. 综合相似度
  const similarity = Math.round((titleSimilarity * 0.4 + contentSimilarity * 0.6) * 100)

  // 5. 判断关系类型
  let relationType = 'unrelated'
  let suggestion = '可以独立保留'

  if (similarity > 80) {
    relationType = 'near_duplicate'
    suggestion = '高度重复，建议合并为一条'
  } else if (similarity > 60) {
    relationType = 'high_overlap'
    suggestion = '内容重叠较多，建议合并或整合'
  } else if (similarity > 40) {
    relationType = 'related'
    suggestion = '内容相关，可以互相引用'
  } else if (similarity > 20) {
    relationType = 'loosely_related'
    suggestion = '有一定关联，建议添加关联链接'
  }

  // 6. 检查分类是否相同
  const sameCategory = item1.category === item2.category

  return {
    item1: { id: item1.id, title: item1.title, category: item1.category },
    item2: { id: item2.id, title: item2.title, category: item2.category },
    similarity,
    title_similarity: Math.round(titleSimilarity * 100),
    content_similarity: Math.round(contentSimilarity * 100),
    common_keywords: commonKeywords.slice(0, 5),
    relation_type: relationType,
    suggestion,
    same_category: sameCategory,
  }
}

/**
 * 计算文本相似度
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const chars1 = new Set(text1.replace(/[，。！？、；：""''（）\s]/g, '').split(''))
  const chars2 = new Set(text2.replace(/[，。！？、；：""''（）\s]/g, '').split(''))
  const intersection = new Set([...chars1].filter(c => chars2.has(c)))
  const union = new Set([...chars1, ...chars2])
  return union.size > 0 ? intersection.size / union.size : 0
}

/**
 * 计算关键词重叠度
 */
function calculateKeywordOverlap(text1: string, text2: string): number {
  const kw1 = extractKeyPhrases(text1)
  const kw2 = extractKeyPhrases(text2)
  const set1 = new Set(kw1)
  const set2 = new Set(kw2)
  const intersection = new Set([...set1].filter(k => set2.has(k)))
  const union = new Set([...set1, ...set2])
  return union.size > 0 ? intersection.size / union.size : 0
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
  return [...new Set(phrases)]
}

/**
 * 查找共同关键词
 */
function findCommonKeywords(text1: string, text2: string): string[] {
  const kw1 = extractKeyPhrases(text1)
  const kw2 = extractKeyPhrases(text2)
  const set2 = new Set(kw2)
  return [...new Set(kw1)].filter(k => set2.has(k))
}

/**
 * 生成合并建议
 */
function generateMergeSuggestions(comparisons: any[], items: KnowledgeItem[]) {
  const suggestions: any[] = []

  // 找出高度重叠的对
  const highOverlapPairs = comparisons.filter(c => c.similarity > 60)

  highOverlapPairs.forEach(pair => {
    const item1 = items.find(i => i.id === pair.item1.id)
    const item2 = items.find(i => i.id === pair.item2.id)

    if (item1 && item2) {
      suggestions.push({
        type: 'merge',
        reason: `相似度 ${pair.similarity}%，${pair.suggestion}`,
        items: [
          { id: item1.id, title: item1.title },
          { id: item2.id, title: item2.title },
        ],
        merged_title: item1.title.length >= item2.title.length ? item1.title : item2.title,
        merged_content: item1.content + '\n\n' + item2.content,
      })
    }
  })

  // 找出可以关联的对
  const relatedPairs = comparisons.filter(c => c.similarity > 20 && c.similarity <= 60)

  if (relatedPairs.length > 0) {
    suggestions.push({
      type: 'link',
      reason: `${relatedPairs.length} 对知识内容相关，建议添加关联`,
      pairs: relatedPairs.map(p => ({
        item1: p.item1,
        item2: p.item2,
        similarity: p.similarity,
      })),
    })
  }

  return suggestions
}
