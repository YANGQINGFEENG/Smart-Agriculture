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
 * 智能添加知识 - AI自动整理格式
 *
 * 输入: raw_text (粘贴的文字或MD内容)
 * 输出: AI整理后的结构化知识 + 冲突检测结果
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

    // 1. 用AI分析和整理内容
    const aiResult = await analyzeWithAI(raw_text.trim())

    // 2. 检测知识冲突
    const conflicts = await detectConflicts(aiResult.title, aiResult.content, aiResult.category)

    return NextResponse.json({
      success: true,
      data: {
        structured: aiResult,
        conflicts,
        has_conflicts: conflicts.length > 0,
      },
    })
  } catch (error) {
    console.error('智能添加知识失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '智能处理失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}

/**
 * 用AI分析原始文本，提取结构化知识
 */
async function analyzeWithAI(rawText: string) {
  // 先尝试AI处理
  try {
    const prompt = `分析以下农业文本，返回JSON：{"title":"标题","category":"分类"}
文本：${rawText.substring(0, 200)}`

    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3:1.7b-q4_K_M',
        prompt,
        stream: false,
        options: { temperature: 0.1, num_predict: 256 },
      }),
    })

    if (response.ok) {
      const result = await response.json()
      const text = result.response || ''

      // 尝试从响应中提取标题
      const titleMatch = text.match(/"title"\s*:\s*"([^"]+)"/)
      const categoryMatch = text.match(/"category"\s*:\s*"([^"]+)"/)

      if (titleMatch) {
        return {
          title: titleMatch[1],
          content: rawText,
          category: categoryMatch && isValidCategory(categoryMatch[1]) ? categoryMatch[1] : guessCategory(rawText),
          tags: extractSimpleTags(rawText),
        }
      }
    }
  } catch (error) {
    console.log('AI处理失败，使用规则处理')
  }

  // AI失败，使用规则处理
  return ruleBasedProcess(rawText)
}

/**
 * 基于规则的文本处理
 */
function ruleBasedProcess(rawText: string) {
  // 提取标题：第一行或前30个字符
  const lines = rawText.split('\n').filter(l => l.trim())
  let title = ''

  // 尝试从第一行提取标题
  if (lines.length > 0) {
    const firstLine = lines[0].trim()
    // 去除标点符号和冒号后面的内容
    const cleaned = firstLine
      .replace(/[：:].*$/, '')  // 去除冒号及后面的内容
      .replace(/[，,。.！!？?；;]/g, '')  // 去除标点
      .trim()

    if (cleaned.length >= 2 && cleaned.length <= 30) {
      title = cleaned
    } else if (cleaned.length > 30) {
      title = cleaned.substring(0, 20)
    }
  }

  // 如果标题还是太长或为空，取前20个字符
  if (!title || title.length > 30) {
    title = rawText
      .substring(0, 30)
      .replace(/[：:，,。.！!？?；;\n]/g, '')
      .trim()
  }

  // 确保标题不为空
  if (!title) {
    title = '未命名知识'
  }

  return {
    title,
    content: rawText,
    category: guessCategory(rawText),
    tags: extractSimpleTags(rawText),
  }
}

/**
 * 验证分类是否有效
 */
function isValidCategory(category: string): boolean {
  const validCategories = ['病虫害防治', '作物管理', '环境参数', '灌溉管理', '土壤管理', '其他']
  return validCategories.includes(category)
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
 * 简单的分类猜测（AI不可用时的降级）
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

/**
 * 检测知识冲突
 * 搜索相似标题或内容的知识，返回可能冲突的条目
 */
async function detectConflicts(title: string, content: string, category: string) {
  const conflicts: any[] = []

  // 1. 按标题关键词搜索
  const titleKeywords = extractKeywords(title)
  if (titleKeywords.length > 0) {
    const likeConditions = titleKeywords.map(() => '(title LIKE ? OR content LIKE ?)').join(' OR ')
    const params: any[] = []
    titleKeywords.forEach(kw => {
      params.push(`%${kw}%`, `%${kw}%`)
    })

    const rows = await db.query<KnowledgeItem[]>(
      `SELECT id, title, content, category, tags FROM knowledge_base
       WHERE status != 'archived' AND (${likeConditions})
       ORDER BY updated_at DESC LIMIT 10`,
      params
    )

    rows.forEach(row => {
      const similarity = calculateSimilarity(title + ' ' + content, row.title + ' ' + row.content)
      if (similarity > 0.3) {
        conflicts.push({
          id: row.id,
          title: row.title,
          category: row.category,
          similarity: Math.round(similarity * 100),
          existing_content: row.content.substring(0, 200) + (row.content.length > 200 ? '...' : ''),
          type: similarity > 0.7 ? 'duplicate' : 'similar',
        })
      }
    })
  }

  // 2. 按分类精确匹配，检查是否有完全相同的标题
  const exactMatch = await db.query<KnowledgeItem[]>(
    `SELECT id, title, content, category FROM knowledge_base
     WHERE title = ? AND status != 'archived'`,
    [title]
  )

  if (exactMatch.length > 0) {
    exactMatch.forEach(row => {
      if (!conflicts.find(c => c.id === row.id)) {
        conflicts.push({
          id: row.id,
          title: row.title,
          category: row.category,
          similarity: 100,
          existing_content: row.content.substring(0, 200) + '...',
          type: 'exact_title',
        })
      }
    })
  }

  return conflicts.sort((a, b) => b.similarity - a.similarity)
}

/**
 * 从文本中提取关键词
 */
function extractKeywords(text: string): string[] {
  // 去除标点符号，按空格和换行分词
  const cleaned = text.replace(/[，。！？、；：""''（）\[\]【】]/g, ' ')
  const words = cleaned.split(/\s+/).filter(w => w.length >= 2)
  // 去重，取前5个
  return [...new Set(words)].slice(0, 5)
}

/**
 * 计算两个文本的相似度（简单的Jaccard相似度）
 */
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.replace(/[，。！？、；：""''（）\[\]【】\s]/g, '').split(''))
  const words2 = new Set(text2.replace(/[，。！？、；：""''（）\[\]【】\s]/g, '').split(''))

  const intersection = new Set([...words1].filter(w => words2.has(w)))
  const union = new Set([...words1, ...words2])

  return union.size > 0 ? intersection.size / union.size : 0
}
