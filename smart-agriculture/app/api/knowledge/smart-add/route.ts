import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket } from '@/lib/db'

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434'

interface KnowledgeItem extends RowDataPacket {
  id: number
  title: string
  content: string
  category: string
  tags: string | null
}

/**
 * POST /api/knowledge/smart-add
 * 智能添加知识 - 支持多条知识自动拆分
 *
 * 输入: raw_text (粘贴的文字或MD内容)
 * 输出: 拆分后的多条结构化知识 + 每条的冲突检测结果
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { raw_text } = body

    if (!raw_text || !raw_text.trim()) {
      return NextResponse.json(
        { success: false, error: '请输入要添加的知识内容' },
        { status: 400 }
      )
    }

    // 1. 拆分多条知识
    const knowledgeItems = splitKnowledge(raw_text.trim())

    // 2. 对每条知识进行结构化处理和冲突检测
    const results = await Promise.all(
      knowledgeItems.map(async (item) => {
        const structured = structureKnowledge(item)
        const conflicts = await detectConflicts(
          structured.title,
          structured.content,
          structured.category
        )
        return {
          structured,
          conflicts,
          has_conflicts: conflicts.length > 0,
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        items: results,
        total: results.length,
        has_any_conflicts: results.some(r => r.has_conflicts),
      },
    })
  } catch (error) {
    console.error('智能添加知识失败:', error)
    return NextResponse.json(
      { success: false, error: '智能处理失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * 拆分多条知识
 * 支持按段落、句号、编号列表、分隔符拆分
 */
function splitKnowledge(text: string): string[] {
  // 如果文本很短，当作单条知识
  if (text.length < 30) {
    return [text]
  }

  const items: string[] = []

  // 方法1: 按空行分段
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 10)
  if (paragraphs.length > 1) {
    for (const para of paragraphs) {
      const trimmed = para.trim()
      if (trimmed.length > 10) {
        items.push(trimmed)
      }
    }
    if (items.length > 1) return items
  }

  // 方法2: 按换行分段
  const lines = text.split('\n').filter(l => l.trim().length > 10)
  if (lines.length > 1) {
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.length > 10) {
        items.push(trimmed)
      }
    }
    if (items.length > 1) return items
  }

  // 方法3: 按句号分段（中文句号）
  const sentences = text.split(/。/).filter(s => s.trim().length > 10)
  if (sentences.length > 2) {
    // 多个句子，尝试合并相关句子
    let current = ''
    for (const sentence of sentences) {
      const trimmed = sentence.trim()
      if (!trimmed) continue

      // 如果当前句子是新主题的开始
      if (isNewTopic(trimmed) && current.length > 20) {
        items.push(current)
        current = trimmed
      } else {
        current = current ? current + '。' + trimmed : trimmed
      }
    }
    if (current) items.push(current)
    if (items.length > 1) return items
  }

  // 方法4: 按编号列表拆分
  const numberedItems = text.split(/\n(?=\d+[.、）)]\s*)/).filter(item => item.trim().length > 10)
  if (numberedItems.length > 1) {
    return numberedItems.map(item => item.trim())
  }

  // 默认返回原文
  return [text]
}

/**
 * 判断是否是新主题的开始
 */
function isNewTopic(sentence: string): boolean {
  // 以特定关键词开头
  const topicStarters = [
    /^(穗瘟|叶瘟|苗瘟|稻瘟)/,
    /^(防治|症状|方法|技术|要点|注意|预防|治疗|管理)/,
    /^(抽穗|分蘖|苗期|生长期)/,
    /^[^：:]+[：:]/,  // 包含冒号的标题格式
  ]

  return topicStarters.some(pattern => pattern.test(sentence))
}

/**
 * 结构化单条知识
 */
function structureKnowledge(text: string) {
  // 提取标题
  const title = extractTitle(text)
  // 提取内容（去掉标题部分）
  const content = extractContent(text, title)
  // 猜测分类
  const category = guessCategory(text)
  // 提取标签
  const tags = extractSimpleTags(text)

  return { title, content, category, tags }
}

/**
 * 提取标题
 */
function extractTitle(text: string): string {
  const lines = text.split('\n').filter(l => l.trim())

  if (lines.length > 0) {
    const firstLine = lines[0].trim()

    // 如果第一行是标题格式（短且不含句号）
    if (firstLine.length <= 30 && !firstLine.includes('。') && !firstLine.includes('；')) {
      return firstLine.replace(/[：:].*$/, '').trim()
    }

    // 取前20个字符
    return firstLine
      .substring(0, 20)
      .replace(/[：:，,。.！!？?；;]/g, '')
      .trim()
  }

  return text.substring(0, 20).replace(/[：:，,。.！!？?；;\n]/g, '').trim() || '未命名知识'
}

/**
 * 提取内容（去掉标题）
 */
function extractContent(text: string, title: string): string {
  // 如果标题在第一行，去掉标题
  if (text.startsWith(title)) {
    return text.substring(title.length).trim()
  }
  return text
}

/**
 * 检测知识冲突 - 基于内容语义
 */
async function detectConflicts(title: string, content: string, category: string) {
  const conflicts: any[] = []
  const searchText = `${title} ${content}`

  // 1. 提取关键短语用于搜索
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

    const rows = await db.query<KnowledgeItem[]>(
      `SELECT id, title, content, category, tags FROM knowledge_base
       WHERE status != 'archived' AND (${likeParts.join(' OR ')})
       ORDER BY updated_at DESC LIMIT 20`,
      params
    )

    rows.forEach(row => {
      if (conflicts.find(c => c.id === row.id)) return

      // 计算多维度相似度
      const similarity = calculateMultiSimilarity(
        title, content,
        row.title, row.content
      )

      // 检查内容是否几乎完全相同
      const contentExactlySame = isContentExactlySame(content, row.content)
      if (contentExactlySame) {
        // 内容几乎完全相同，直接标记为重复
        conflicts.push({
          id: row.id,
          title: row.title,
          category: row.category,
          similarity: 99,
          existing_content: row.content.substring(0, 300) + (row.content.length > 300 ? '...' : ''),
          type: 'exact_duplicate',
          suggestion: '内容几乎完全相同，建议跳过，无需重复添加',
          match_details: ['内容完全重复'],
        })
        return
      }

      if (similarity.score > 0.3) {
        conflicts.push({
          id: row.id,
          title: row.title,
          category: row.category,
          similarity: Math.round(similarity.score * 100),
          existing_content: row.content.substring(0, 300) + (row.content.length > 300 ? '...' : ''),
          type: similarity.type,
          suggestion: getSuggestion(similarity.type, similarity.score),
          match_details: similarity.details,
        })
      }
    })
  }

  return conflicts.sort((a, b) => b.similarity - a.similarity).slice(0, 5)
}

/**
 * 提取关键短语（2-4字的词组）
 */
function extractKeyPhrases(text: string): string[] {
  const cleaned = text.replace(/[，。！？、；：""''（）\[\]【】\s]/g, '')
  const phrases: string[] = []

  // 提取2-4字的词组
  for (let i = 0; i < cleaned.length - 1; i++) {
    for (let len = 2; len <= 4; len++) {
      if (i + len <= cleaned.length) {
        const phrase = cleaned.substring(i, i + len)
        // 过滤常见停用词组合
        if (!isStopPhrase(phrase)) {
          phrases.push(phrase)
        }
      }
    }
  }

  // 去重并返回高频词
  const unique = [...new Set(phrases)]
  return unique.slice(0, 10)
}

/**
 * 判断是否是停用词组合
 */
function isStopPhrase(phrase: string): boolean {
  const stopPhrases = ['的是', '是的', '在的', '的在', '了的', '的了', '和的', '的和']
  return stopPhrases.includes(phrase) || /^[的了在是我有和就不人都一]/.test(phrase)
}

/**
 * 多维度相似度计算
 */
function calculateMultiSimilarity(
  title1: string, content1: string,
  title2: string, content2: string
): { score: number; type: string; details: string[] } {
  const details: string[] = []

  // 1. 标题相似度（权重0.4）
  const titleSim = calculateTextSimilarity(title1, title2)
  if (titleSim > 0.5) details.push(`标题相似度: ${Math.round(titleSim * 100)}%`)

  // 2. 内容关键词重叠（权重0.4）
  const contentSim = calculateKeywordOverlap(content1, content2)
  if (contentSim > 0.3) details.push(`内容重叠: ${Math.round(contentSim * 100)}%`)

  // 3. 共同实体词（权重0.2）
  const entitySim = calculateEntityOverlap(title1 + content1, title2 + content2)
  if (entitySim > 0.3) details.push(`共同关键词: ${Math.round(entitySim * 100)}%`)

  // 加权总分
  const score = titleSim * 0.4 + contentSim * 0.4 + entitySim * 0.2

  // 确定类型
  let type = 'low_overlap'
  if (score > 0.7) type = 'high_overlap'
  else if (score > 0.5) type = 'medium_overlap'
  else if (score > 0.3) type = 'related'

  // 特殊情况：标题几乎一样
  if (titleSim > 0.8) {
    type = 'similar_title'
    details.push('标题高度相似')
  }

  return { score, type, details }
}

/**
 * 计算文本相似度（基于字符级）
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
  const keywords1 = extractKeyPhrases(text1)
  const keywords2 = extractKeyPhrases(text2)

  const set1 = new Set(keywords1)
  const set2 = new Set(keywords2)

  const intersection = new Set([...set1].filter(k => set2.has(k)))
  const union = new Set([...set1, ...set2])

  return union.size > 0 ? intersection.size / union.size : 0
}

/**
 * 计算实体词重叠度（数字、专业术语等）
 */
function calculateEntityOverlap(text1: string, text2: string): number {
  // 提取数字和单位
  const entityPattern = /\d+[%倍亩斤克升℃°]|\d+[月日天时分]/g
  const entities1 = new Set(text1.match(entityPattern) || [])
  const entities2 = new Set(text2.match(entityPattern) || [])

  if (entities1.size === 0 && entities2.size === 0) return 0

  const intersection = new Set([...entities1].filter(e => entities2.has(e)))
  const union = new Set([...entities1, ...entities2])

  return union.size > 0 ? intersection.size / union.size : 0
}

/**
 * 获取处理建议 - 更明确的指导
 */
function getSuggestion(type: string, score: number): string {
  // 检查内容是否几乎完全相同
  if (score > 90) {
    return '内容几乎完全相同，建议跳过，无需重复添加'
  }

  switch (type) {
    case 'similar_title':
      if (score > 80) return '标题高度相似，内容可能重复，建议跳过'
      return '标题相似，建议检查是否重复'
    case 'high_overlap':
      if (score > 75) return '内容大量重复，建议跳过或合并到已有知识'
      return '内容重叠较多，建议整合后添加'
    case 'medium_overlap':
      return '部分内容重叠，可补充差异化信息后添加'
    case 'related':
      return '内容相关但有区别，可作为独立知识添加'
    default:
      return '可以添加'
  }
}

/**
 * 检查两段内容是否几乎完全相同
 */
function isContentExactlySame(content1: string, content2: string): boolean {
  // 清理文本（去除空格和标点）
  const clean1 = content1.replace(/[\s，。！？、；：""''（）\[\]【】]/g, '')
  const clean2 = content2.replace(/[\s，。！？、；：""''（）\[\]【】]/g, '')

  // 完全相同
  if (clean1 === clean2) return true

  // 长度差异太大，不可能相同
  if (Math.abs(clean1.length - clean2.length) > clean1.length * 0.1) return false

  // 计算相似度
  const chars1 = new Set(clean1.split(''))
  const chars2 = new Set(clean2.split(''))
  const intersection = new Set([...chars1].filter(c => chars2.has(c)))
  const union = new Set([...chars1, ...chars2])
  const similarity = union.size > 0 ? intersection.size / union.size : 0

  // 相似度超过95%视为相同
  return similarity > 0.95
}

/**
 * 从文本中提取简单标签
 */
function extractSimpleTags(text: string): string {
  const tagPatterns: [RegExp, string][] = [
    [/番茄|西红柿/, '番茄'],
    [/黄瓜/, '黄瓜'],
    [/水稻|稻/, '水稻'],
    [/玉米/, '玉米'],
    [/小麦/, '小麦'],
    [/蔬菜/, '蔬菜'],
    [/水果/, '水果'],
    [/病|虫|害|防治|农药/, '病虫害'],
    [/施肥|肥料|营养/, '施肥'],
    [/灌溉|浇水|排水/, '灌溉'],
    [/温度|湿度|光照/, '环境'],
    [/土壤|基质/, '土壤'],
    [/抽穗|穗瘟|穗颈/, '穗瘟'],
    [/叶瘟/, '叶瘟'],
    [/苗瘟/, '苗瘟'],
    [/喷雾|喷药|施药/, '施药'],
  ]

  const tags: string[] = []
  for (const [pattern, tag] of tagPatterns) {
    if (pattern.test(text) && !tags.includes(tag)) {
      tags.push(tag)
    }
  }

  return tags.slice(0, 5).join(',')
}

/**
 * 简单的分类猜测
 */
function guessCategory(text: string): string {
  const lower = text.toLowerCase()
  if (/病|虫|害|防治|农药|杀虫/.test(lower)) return '病虫害防治'
  if (/作物|种植|施肥|收获|育苗/.test(lower)) return '作物管理'
  if (/温度|湿度|光照|通风|co2/.test(lower)) return '环境参数'
  if (/灌溉|浇水|排水|水分/.test(lower)) return '灌溉管理'
  if (/土壤|基质|ph|ec/.test(lower)) return '土壤管理'
  return '其他'
}
