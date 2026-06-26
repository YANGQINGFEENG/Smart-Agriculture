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
 * POST /api/knowledge/compare
 * 多条知识对比分析 - 找出矛盾点
 *
 * 输入: ids (知识ID数组)
 * 输出: 矛盾点分析结果
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

    // 使用AI分析矛盾点
    const contradictions = await findContradictionsWithAI(items)

    // 同时进行规则检测
    const ruleBasedContradictions = findContradictionsByRules(items)

    // 合并结果，去重
    const allContradictions = mergeContradictions(contradictions, ruleBasedContradictions)

    // 统计
    const stats = {
      total_pairs: (items.length * (items.length - 1)) / 2,
      has_contradictions: allContradictions.length > 0,
      contradiction_count: allContradictions.length,
      severity_levels: {
        high: allContradictions.filter(c => c.severity === 'high').length,
        medium: allContradictions.filter(c => c.severity === 'medium').length,
        low: allContradictions.filter(c => c.severity === 'low').length,
      },
    }

    return NextResponse.json({
      success: true,
      data: {
        items,
        contradictions: allContradictions,
        stats,
      },
    })
  } catch (error) {
    console.error('矛盾检测失败:', error)
    return NextResponse.json(
      { success: false, error: '对比分析失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * 使用AI检测矛盾点
 */
async function findContradictionsWithAI(items: KnowledgeItem[]): Promise<any[]> {
  if (items.length < 2) return []

  try {
    // 构建知识列表
    const knowledgeList = items.map((item, i) =>
      `知识${i + 1}（${item.title}）：${item.content}`
    ).join('\n\n')

    const prompt = `你是一个农业知识审查专家。请分析以下多条农业知识，找出它们之间的矛盾点。

矛盾包括：
1. 直接矛盾：两个知识给出相反的建议（如"加糖"vs"加盐"）
2. 条件矛盾：在相同条件下给出不同建议
3. 数据矛盾：给出不同的数值或时间
4. 方法矛盾：推荐不同的防治方法

知识列表：
${knowledgeList}

请按以下JSON格式返回（只返回JSON，不要其他内容）：
{
  "contradictions": [
    {
      "knowledge1_id": 知识1的序号,
      "knowledge2_id": 知识2的序号,
      "type": "direct/condition/data/method",
      "description": "矛盾描述",
      "detail1": "知识1的观点",
      "detail2": "知识2的观点",
      "severity": "high/medium/low",
      "suggestion": "建议如何处理"
    }
  ]
}

如果没有矛盾，返回 {"contradictions": []}`

    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3:1.7b-q4_K_M',
        prompt,
        stream: false,
        options: { temperature: 0.1, num_predict: 1024 },
      }),
    })

    if (response.ok) {
      const result = await response.json()
      const text = result.response || ''

      // 解析AI返回的JSON
      const jsonMatch = text.match(/\{[\s\S]*"contradictions"[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
          if (parsed.contradictions && Array.isArray(parsed.contradictions)) {
            // 转换为统一格式
            return parsed.contradictions.map((c: any) => ({
              item1: items[c.knowledge1_id - 1] ? {
                id: items[c.knowledge1_id - 1].id,
                title: items[c.knowledge1_id - 1].title,
              } : null,
              item2: items[c.knowledge2_id - 1] ? {
                id: items[c.knowledge2_id - 1].id,
                title: items[c.knowledge2_id - 1].title,
              } : null,
              type: c.type || 'unknown',
              description: c.description || '',
              detail1: c.detail1 || '',
              detail2: c.detail2 || '',
              severity: c.severity || 'medium',
              suggestion: c.suggestion || '',
              source: 'ai',
            }))
          }
        } catch {}
      }
    }
  } catch (error) {
    console.log('AI矛盾检测失败，使用规则检测')
  }

  return []
}

/**
 * 基于规则的矛盾检测
 */
function findContradictionsByRules(items: KnowledgeItem[]): any[] {
  const contradictions: any[] = []

  // 定义矛盾关键词对
  const contradictionPairs = [
    // 方向矛盾
    ['东', '西'], ['南', '北'], ['上', '下'], ['左', '右'],
    // 动作矛盾
    ['增加', '减少'], ['提高', '降低'], ['加强', '减弱'],
    ['开启', '关闭'], ['添加', '去除'], ['使用', '避免'],
    // 数值矛盾
    ['多', '少'], ['大', '小'], ['高', '低'], ['快', '慢'],
    // 农业相关矛盾
    ['加糖', '加盐'], ['施肥', '控肥'], ['浇水', '控水'],
    ['密植', '稀植'], ['早播', '晚播'], ['深翻', '免耕'],
  ]

  // 两两对比
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const item1 = items[i]
      const item2 = items[j]

      // 检查数值矛盾
      const numberContradictions = findNumberContradictions(item1, item2)
      contradictions.push(...numberContradictions)

      // 检查关键词矛盾
      for (const [word1, word2] of contradictionPairs) {
        const has1in1 = item1.content.includes(word1)
        const has2in1 = item1.content.includes(word2)
        const has1in2 = item2.content.includes(word1)
        const has2in2 = item2.content.includes(word2)

        // 如果一个知识说word1，另一个说word2，可能存在矛盾
        if ((has1in1 && has2in2) || (has2in1 && has1in2)) {
          // 提取包含矛盾词的句子
          const sentence1 = extractSentenceWithWord(item1.content, has1in1 ? word1 : word2)
          const sentence2 = extractSentenceWithWord(item2.content, has1in2 ? word1 : word2)

          if (sentence1 && sentence2 && sentence1 !== sentence2) {
            contradictions.push({
              item1: { id: item1.id, title: item1.title },
              item2: { id: item2.id, title: item2.title },
              type: 'direct',
              description: `在"${has1in1 ? word1 : word2}"vs"${has2in2 ? word2 : word1}"上存在矛盾`,
              detail1: sentence1,
              detail2: sentence2,
              severity: 'high',
              suggestion: '存在直接矛盾，请核实哪个是正确的',
              source: 'rule',
            })
          }
        }
      }
    }
  }

  return contradictions
}

/**
 * 检测数值矛盾
 */
function findNumberContradictions(item1: KnowledgeItem, item2: KnowledgeItem): any[] {
  const contradictions: any[] = []

  // 提取数字+单位
  const numberPattern = /(\d+\.?\d*)\s*(%|倍|亩|斤|克|升|℃|°|天|小时|分钟)/g

  const numbers1: Array<{ value: number; unit: string; context: string }> = []
  const numbers2: Array<{ value: number; unit: string; context: string }> = []

  let match
  while ((match = numberPattern.exec(item1.content)) !== null) {
    numbers1.push({
      value: parseFloat(match[1]),
      unit: match[2],
      context: item1.content.substring(Math.max(0, match.index - 20), match.index + match[0].length + 20),
    })
  }

  while ((match = numberPattern.exec(item2.content)) !== null) {
    numbers2.push({
      value: parseFloat(match[1]),
      unit: match[2],
      context: item2.content.substring(Math.max(0, match.index - 20), match.index + match[0].length + 20),
    })
  }

  // 找出相同单位但不同数值的矛盾
  for (const n1 of numbers1) {
    for (const n2 of numbers2) {
      if (n1.unit === n2.unit && n1.value !== n2.value) {
        // 数值差异超过20%视为矛盾
        const diff = Math.abs(n1.value - n2.value) / Math.max(n1.value, n2.value)
        if (diff > 0.2) {
          contradictions.push({
            item1: { id: item1.id, title: item1.title },
            item2: { id: item2.id, title: item2.title },
            type: 'data',
            description: `数值矛盾：${n1.value}${n1.unit} vs ${n2.value}${n2.unit}`,
            detail1: n1.context.trim(),
            detail2: n2.context.trim(),
            severity: diff > 0.5 ? 'high' : 'medium',
            suggestion: '数值存在较大差异，请核实',
            source: 'rule',
          })
        }
      }
    }
  }

  return contradictions
}

/**
 * 提取包含特定词的句子
 */
function extractSentenceWithWord(text: string, word: string): string {
  const sentences = text.split(/[。！？；]/)
  for (const sentence of sentences) {
    if (sentence.includes(word)) {
      return sentence.trim()
    }
  }
  return ''
}

/**
 * 合并去重矛盾结果
 */
function mergeContradictions(aiResults: any[], ruleResults: any[]): any[] {
  const all = [...aiResults, ...ruleResults]

  // 去重：相同的一对知识+相同类型视为重复
  const unique: any[] = []
  const seen = new Set<string>()

  for (const item of all) {
    if (!item.item1 || !item.item2) continue
    const key = `${Math.min(item.item1.id, item.item2.id)}-${Math.max(item.item1.id, item.item2.id)}-${item.type}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(item)
    }
  }

  // 按严重程度排序
  return unique.sort((a, b) => {
    const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
    return (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2)
  })
}
