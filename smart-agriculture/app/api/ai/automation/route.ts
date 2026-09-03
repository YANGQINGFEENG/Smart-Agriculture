import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket } from '@/lib/db'
import { createLogger } from '@/lib/logger';

const log = createLogger('AIAutomation');

/**
 * 自动化方案记录接口
 */
interface AutomationScheme extends RowDataPacket {
  id: number
  name: string
  description: string
  trigger_condition: string | null
  action_desc: string
  device_type: string
  related_sensors: string | string[]
  related_actuators: string | string[]
  action_type: 'on' | 'off' | 'value' | 'composite'
  action_value: number | null
  action_unit: string | null
  composite_actions: string | Record<string, any> | null
  priority: number
  is_system: number
  is_active: number
  created_at: string
  updated_at: string
}

/**
 * 解析 JSON 字段
 */
function parseScheme(row: AutomationScheme) {
  return {
    ...row,
    related_sensors: typeof row.related_sensors === 'string' ? JSON.parse(row.related_sensors) : row.related_sensors,
    related_actuators: typeof row.related_actuators === 'string' ? JSON.parse(row.related_actuators) : row.related_actuators,
    composite_actions: typeof row.composite_actions === 'string' ? JSON.parse(row.composite_actions) : row.composite_actions,
    is_system: row.is_system === 1,
    is_active: row.is_active === 1,
  }
}

/**
 * GET /api/ai/automation
 * 获取自动化方案列表
 *
 * 查询参数:
 *   device_type: 按设备类型过滤
 *   action_type: on/off/value/composite
 *   is_active: 仅返回启用的（默认 true）
 *   search: 搜索关键词（匹配名称和描述）
 *   limit: 返回数量限制（默认 50）
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const deviceType = url.searchParams.get('device_type')
    const actionType = url.searchParams.get('action_type')
    const isActive = url.searchParams.get('is_active') !== 'false'
    const search = url.searchParams.get('search')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200)

    const conditions: string[] = []
    const params: any[] = []

    if (deviceType) {
      conditions.push('device_type = ?')
      params.push(deviceType)
    }
    if (actionType && ['on', 'off', 'value', 'composite'].includes(actionType)) {
      conditions.push('action_type = ?')
      params.push(actionType)
    }
    if (isActive) {
      conditions.push('is_active = 1')
    }
    if (search) {
      conditions.push('(name LIKE ? OR description LIKE ? OR trigger_condition LIKE ?)')
      params.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const rows = await db.query<AutomationScheme[]>(
      `SELECT * FROM ai_automation_schemes ${whereClause} ORDER BY priority DESC, id ASC LIMIT ?`,
      [...params, limit]
    )

    const data = rows.map(parseScheme)

    return NextResponse.json({ success: true, data, total: data.length })
  } catch (error) {
    log.error('查询失败:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, error: '获取自动化方案数据失败' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/ai/automation
 * 创建新的自动化方案
 *
 * 请求体:
 * {
 *   name: string,
 *   description: string,
 *   trigger_condition?: string,
 *   action_desc: string,
 *   device_type: string,
 *   related_sensors?: string[],
 *   related_actuators?: string[],
 *   action_type: 'on'|'off'|'value'|'composite',
 *   action_value?: number,
 *   action_unit?: string,
 *   composite_actions?: object,
 *   priority?: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      description,
      trigger_condition,
      action_desc,
      device_type,
      related_sensors,
      related_actuators,
      action_type,
      action_value,
      action_unit,
      composite_actions,
      priority,
    } = body

    // 参数校验
    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: '方案名称不能为空' }, { status: 400 })
    }
    if (!description || !description.trim()) {
      return NextResponse.json({ success: false, error: '方案描述不能为空' }, { status: 400 })
    }
    if (!device_type || !device_type.trim()) {
      return NextResponse.json({ success: false, error: '目标设备类型不能为空' }, { status: 400 })
    }
    if (!action_type || !['on', 'off', 'value', 'composite'].includes(action_type)) {
      return NextResponse.json({ success: false, error: 'action_type 必须为 on/off/value/composite' }, { status: 400 })
    }
    if (action_type === 'value' && action_value === undefined) {
      return NextResponse.json({ success: false, error: 'value 类型必须提供 action_value' }, { status: 400 })
    }
    if (action_type === 'composite' && !composite_actions) {
      return NextResponse.json({ success: false, error: 'composite 类型必须提供 composite_actions' }, { status: 400 })
    }

    const result = await db.execute(
      `INSERT INTO ai_automation_schemes 
       (name, description, trigger_condition, action_desc, device_type, 
        related_sensors, related_actuators, action_type, action_value, action_unit, 
        composite_actions, priority, is_system)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        name.trim(),
        description.trim(),
        trigger_condition || null,
        action_desc || name.trim(),
        device_type.trim(),
        JSON.stringify(related_sensors || []),
        JSON.stringify(related_actuators || []),
        action_type,
        action_value ?? null,
        action_unit || null,
        composite_actions ? JSON.stringify(composite_actions) : null,
        priority || 0,
      ]
    ) as any

    return NextResponse.json({
      success: true,
      data: { id: result.insertId },
      message: '自动化方案创建成功',
    })
  } catch (error) {
    log.error('创建失败:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, error: '创建自动化方案失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/ai/automation
 * 更新自动化方案（通过 id 参数）
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
    const [existing] = await db.query<AutomationScheme[]>(
      'SELECT id FROM ai_automation_schemes WHERE id = ?',
      [id]
    )

    if (existing.length === 0) {
      return NextResponse.json({ success: false, error: '自动化方案不存在' }, { status: 404 })
    }

    const body = await request.json()
    const updates: string[] = []
    const params: any[] = []

    if (body.name !== undefined) {
      if (!body.name.trim()) {
        return NextResponse.json({ success: false, error: '方案名称不能为空' }, { status: 400 })
      }
      updates.push('name = ?')
      params.push(body.name.trim())
    }
    if (body.description !== undefined) {
      updates.push('description = ?')
      params.push(body.description.trim())
    }
    if (body.trigger_condition !== undefined) {
      updates.push('trigger_condition = ?')
      params.push(body.trigger_condition || null)
    }
    if (body.action_desc !== undefined) {
      updates.push('action_desc = ?')
      params.push(body.action_desc.trim())
    }
    if (body.device_type !== undefined) {
      updates.push('device_type = ?')
      params.push(body.device_type.trim())
    }
    if (body.related_sensors !== undefined) {
      updates.push('related_sensors = ?')
      params.push(JSON.stringify(body.related_sensors))
    }
    if (body.related_actuators !== undefined) {
      updates.push('related_actuators = ?')
      params.push(JSON.stringify(body.related_actuators))
    }
    if (body.action_type !== undefined) {
      if (!['on', 'off', 'value', 'composite'].includes(body.action_type)) {
        return NextResponse.json({ success: false, error: 'action_type 必须为 on/off/value/composite' }, { status: 400 })
      }
      updates.push('action_type = ?')
      params.push(body.action_type)
    }
    if (body.action_value !== undefined) {
      updates.push('action_value = ?')
      params.push(body.action_value)
    }
    if (body.action_unit !== undefined) {
      updates.push('action_unit = ?')
      params.push(body.action_unit || null)
    }
    if (body.composite_actions !== undefined) {
      updates.push('composite_actions = ?')
      params.push(body.composite_actions ? JSON.stringify(body.composite_actions) : null)
    }
    if (body.priority !== undefined) {
      updates.push('priority = ?')
      params.push(body.priority)
    }
    if (body.is_active !== undefined) {
      updates.push('is_active = ?')
      params.push(body.is_active ? 1 : 0)
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: '没有提供需要更新的字段' }, { status: 400 })
    }

    params.push(id)
    await db.execute(
      `UPDATE ai_automation_schemes SET ${updates.join(', ')} WHERE id = ?`,
      params
    )

    return NextResponse.json({ success: true, message: '自动化方案更新成功' })
  } catch (error) {
    log.error('更新失败:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, error: '更新自动化方案失败' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/ai/automation
 * 删除自动化方案（通过 id 参数）
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

    const [existing] = await db.query<AutomationScheme[]>(
      'SELECT id, is_system FROM ai_automation_schemes WHERE id = ?',
      [id]
    )

    if (existing.length === 0) {
      return NextResponse.json({ success: false, error: '自动化方案不存在' }, { status: 404 })
    }

    if (existing[0].is_system === 1) {
      return NextResponse.json(
        { success: false, error: '系统预设方案不允许删除，可以禁用它（设置 is_active=false）' },
        { status: 403 }
      )
    }

    await db.execute('DELETE FROM ai_automation_schemes WHERE id = ?', [id])

    return NextResponse.json({ success: true, message: '自动化方案已删除' })
  } catch (error) {
    log.error('删除失败:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, error: '删除自动化方案失败' },
      { status: 500 }
    )
  }
}