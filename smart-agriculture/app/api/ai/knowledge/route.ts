import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket } from '@/lib/db'

/**
 * AI 知识库条目接口
 */
interface KnowledgeEntry extends RowDataPacket {
  id: number
  target_type: 'device_type' | 'device_instance'
  device_type: string
  device_id: string | null
  keywords: string | string[]
  actions: string | Record<string, string>
  parameters: string | Record<string, any> | null
  description: string
  note: string | null
  priority: number
  is_system: number
  is_active: number
  created_at: string
  updated_at: string
}

/**
 * 解析 JSON 字段
 */
function parseKnowledgeEntry(row: KnowledgeEntry) {
  return {
    ...row,
    keywords: typeof row.keywords === 'string' ? JSON.parse(row.keywords) : row.keywords,
    actions: typeof row.actions === 'string' ? JSON.parse(row.actions) : row.actions,
    parameters: typeof row.parameters === 'string' ? JSON.parse(row.parameters) : row.parameters,
    is_system: row.is_system === 1,
    is_active: row.is_active === 1,
  }
}

/**
 * GET /api/ai/knowledge
 * 获取 AI 知识库列表
 *
 * 查询参数:
 *   target_type: device_type | device_instance（过滤）
 *   device_type: 按设备类型过滤
 *   device_id: 按设备实例ID过滤
 *   is_active: 仅返回启用的（默认 true）
 *   search: 搜索关键词
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const targetType = url.searchParams.get('target_type')
    const deviceType = url.searchParams.get('device_type')
    const deviceId = url.searchParams.get('device_id')
    const isActive = url.searchParams.get('is_active') !== 'false'
    const search = url.searchParams.get('search')

    const conditions: string[] = []
    const params: any[] = []

    if (targetType) {
      conditions.push('target_type = ?')
      params.push(targetType)
    }
    if (deviceType) {
      conditions.push('device_type = ?')
      params.push(deviceType)
    }
    if (deviceId) {
      conditions.push('device_id = ?')
      params.push(deviceId)
    }
    if (isActive) {
      conditions.push('is_active = 1')
    }
    if (search) {
      conditions.push('(description LIKE ? OR JSON_SEARCH(keywords, \'one\', ?) IS NOT NULL)')
      params.push(`%${search}%`, search)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const rows = await db.query<KnowledgeEntry[]>(
      `SELECT * FROM ai_device_knowledge ${whereClause} ORDER BY priority DESC, id ASC`,
      params
    )

    const data = rows.map(parseKnowledgeEntry)

    return NextResponse.json({ success: true, data, total: data.length })
  } catch (error) {
    console.error('[AI Knowledge] 查询失败:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, error: '获取知识库数据失败' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/ai/knowledge
 * 创建新的 AI 知识条目
 *
 * 请求体:
 * {
 *   target_type: 'device_type' | 'device_instance',
 *   device_type: string,
 *   device_id?: string,
 *   keywords: string[],
 *   actions: Record<string, string>,
 *   parameters?: Record<string, any>,
 *   description: string,
 *   note?: string,
 *   priority?: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      target_type,
      device_type,
      device_id,
      keywords,
      actions,
      parameters,
      description,
      note,
      priority,
    } = body

    // 参数校验
    if (!target_type || !['device_type', 'device_instance'].includes(target_type)) {
      return NextResponse.json({ success: false, error: 'target_type 必须为 device_type 或 device_instance' }, { status: 400 })
    }
    if (!device_type || !device_type.trim()) {
      return NextResponse.json({ success: false, error: 'device_type 不能为空' }, { status: 400 })
    }
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ success: false, error: 'keywords 必须为非空数组' }, { status: 400 })
    }
    if (!actions || typeof actions !== 'object') {
      return NextResponse.json({ success: false, error: 'actions 必须为对象' }, { status: 400 })
    }
    if (!description || !description.trim()) {
      return NextResponse.json({ success: false, error: 'description 不能为空' }, { status: 400 })
    }
    if (target_type === 'device_instance' && !device_id) {
      return NextResponse.json({ success: false, error: 'device_instance 类型必须提供 device_id' }, { status: 400 })
    }

    const result = await db.execute(
      `INSERT INTO ai_device_knowledge (target_type, device_type, device_id, keywords, actions, parameters, description, note, priority, is_system)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        target_type,
        device_type.trim(),
        device_id || null,
        JSON.stringify(keywords),
        JSON.stringify(actions),
        parameters ? JSON.stringify(parameters) : null,
        description.trim(),
        note || null,
        priority || 0,
      ]
    ) as any

    return NextResponse.json({
      success: true,
      data: { id: result.insertId },
      message: '知识条目创建成功',
    })
  } catch (error) {
    console.error('[AI Knowledge] 创建失败:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, error: '创建知识条目失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/ai/knowledge
 * 更新 AI 知识条目（通过 id 参数）
 *
 * 查询参数: id=数字
 * 请求体: 同 POST 但所有字段可选
 */
export async function PUT(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const id = parseInt(url.searchParams.get('id') || '0', 10)

    if (!id || id <= 0) {
      return NextResponse.json({ success: false, error: '缺少有效的 id 参数' }, { status: 400 })
    }

    // 检查条目是否存在
    const [existing] = await db.query<KnowledgeEntry[]>(
      'SELECT id, is_system FROM ai_device_knowledge WHERE id = ?',
      [id]
    )

    if (existing.length === 0) {
      return NextResponse.json({ success: false, error: '知识条目不存在' }, { status: 404 })
    }

    const body = await request.json()
    const updates: string[] = []
    const params: any[] = []

    if (body.keywords !== undefined) {
      if (!Array.isArray(body.keywords) || body.keywords.length === 0) {
        return NextResponse.json({ success: false, error: 'keywords 必须为非空数组' }, { status: 400 })
      }
      updates.push('keywords = ?')
      params.push(JSON.stringify(body.keywords))
    }
    if (body.actions !== undefined) {
      if (typeof body.actions !== 'object') {
        return NextResponse.json({ success: false, error: 'actions 必须为对象' }, { status: 400 })
      }
      updates.push('actions = ?')
      params.push(JSON.stringify(body.actions))
    }
    if (body.parameters !== undefined) {
      updates.push('parameters = ?')
      params.push(body.parameters ? JSON.stringify(body.parameters) : null)
    }
    if (body.description !== undefined) {
      updates.push('description = ?')
      params.push(body.description.trim())
    }
    if (body.note !== undefined) {
      updates.push('note = ?')
      params.push(body.note || null)
    }
    if (body.priority !== undefined) {
      updates.push('priority = ?')
      params.push(body.priority)
    }
    if (body.is_active !== undefined) {
      updates.push('is_active = ?')
      params.push(body.is_active ? 1 : 0)
    }
    if (body.device_type !== undefined) {
      updates.push('device_type = ?')
      params.push(body.device_type.trim())
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: '没有提供需要更新的字段' }, { status: 400 })
    }

    params.push(id)
    await db.execute(
      `UPDATE ai_device_knowledge SET ${updates.join(', ')} WHERE id = ?`,
      params
    )

    return NextResponse.json({ success: true, message: '知识条目更新成功' })
  } catch (error) {
    console.error('[AI Knowledge] 更新失败:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, error: '更新知识条目失败' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/ai/knowledge
 * 删除 AI 知识条目（通过 id 参数）
 *
 * 查询参数: id=数字
 * 系统预设条目（is_system=1）不允许删除，但可以禁用
 */
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const id = parseInt(url.searchParams.get('id') || '0', 10)

    if (!id || id <= 0) {
      return NextResponse.json({ success: false, error: '缺少有效的 id 参数' }, { status: 400 })
    }

    const [existing] = await db.query<KnowledgeEntry[]>(
      'SELECT id, is_system FROM ai_device_knowledge WHERE id = ?',
      [id]
    )

    if (existing.length === 0) {
      return NextResponse.json({ success: false, error: '知识条目不存在' }, { status: 404 })
    }

    if (existing[0].is_system === 1) {
      return NextResponse.json(
        { success: false, error: '系统预设条目不允许删除，可以禁用它（设置 is_active=false）' },
        { status: 403 }
      )
    }

    await db.execute('DELETE FROM ai_device_knowledge WHERE id = ?', [id])

    return NextResponse.json({ success: true, message: '知识条目已删除' })
  } catch (error) {
    console.error('[AI Knowledge] 删除失败:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, error: '删除知识条目失败' },
      { status: 500 }
    )
  }
}