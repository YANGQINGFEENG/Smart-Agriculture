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

  // 4. 查找重复文字片段
  const overlappingSegments = findOverlappingSegments(item1.content, item2.content)

  // 5. 综合相似度
  const similarity = Math.round((titleSimilarity * 0.4 + contentSimilarity * 0.6) * 100)

  // 6. 判断关系类型
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

  // 7. 检查分类是否相同
  const sameCategory = item1.category === item2.category

  return {
    item1: { id: item1.id, title: item1.title, category: item1.category, content: item1.content },
    item2: { id: item2.id, title: item2.title, category: item2.category, content: item2.content },
    similarity,
    title_similarity: Math.round(titleSimilarity * 100),
    content_similarity: Math.round(contentSimilarity * 100),
    common_keywords: commonKeywords.slice(0, 5),
    overlapping_segments: overlappingSegments,
    relation_type: relationType,
    suggestion,
    same_category: sameCategory,
  }
}

/**
 * 查找重复文字片段
 * 返回两个文本中连续重复的片段
 */
function findOverlappingSegments(text1: string, text2: string): Array<{ text: string; positions: { text1: number; text2: number } }> {
  const segments: Array<{ text: string; positions: { text1: number; text2: number } }> = []

  // 清理文本
  const clean1 = text1.replace(/\s+/g, '')
  const clean2 = text2.replace(/\s+/g, '')

  // 查找连续重复的字符（至少6个字符）
  const minSegmentLength = 4

  for (let i = 0; i < clean1.length - minSegmentLength; i++) {
    for (let len = minSegmentLength; len <= Math.min(50, clean1.length - i); len++) {
      const segment = clean1.substring(i, i + len)

      // 在第二个文本中查找
      const pos2 = clean2.indexOf(segment)
      if (pos2 !== -1) {
        // 检查是否已被更长的片段包含
        const isContained = segments.some(s =>
          s.text.includes(segment) &&
          Math.abs(s.positions.text1 - i) < segment.length
        )

        if (!isContained) {
          // 尝试扩展片段
          let extendedLen = len
          while (
            i + extendedLen < clean1.length &&
            pos2 + extendedLen < clean2.length &&
            clean1[i + extendedLen] === clean2[pos2 + extendedLen] &&
            extendedLen < 100
          ) {
            extendedLen++
          }

          const finalSegment = clean1.substring(i, i + extendedLen)
          if (finalSegment.length >= minSegmentLength) {
            // 找到在原始文本中的位置
            const origPos1 = text1.indexOf(finalSegment.replace(/\s+/g, ''))
            const origPos2 = text2.indexOf(finalSegment.replace(/\s+/g, ''))

            segments.push({
              text: finalSegment,
              positions: {
                text1: origPos1 !== -1 ? origPos1 : i,
                text2: origPos2 !== -1 ? origPos2 : pos2,
              }
            })
          }

          // 跳过已处理的部分
          i += extendedLen - 1
          break
        }
      }
    }
  }

  // 去重并按长度排序
  const uniqueSegments = segments
    .filter((s, idx, arr) => arr.findIndex(other => other.text === s.text) === idx)
    .sort((a, b) => b.text.length - a.text.length)
    .slice(0, 10)

  return uniqueSegments
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
