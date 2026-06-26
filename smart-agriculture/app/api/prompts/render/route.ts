import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket } from '@/lib/db'

interface PromptTemplate extends RowDataPacket {
  id: number
  name: string
  type: string
  content: string
  variables: string | null
}

/**
 * POST /api/prompts/render
 * 渲染模板（替换变量）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { template_id, variables = {} } = body

    if (!template_id) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数：template_id' },
        { status: 400 }
      )
    }

    const rows = await db.query<PromptTemplate[]>(
      'SELECT * FROM prompt_templates WHERE id = ? AND status = ?',
      [template_id, 'active']
    )

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '模板不存在或已停用' },
        { status: 404 }
      )
    }

    const template = rows[0]
    let renderedContent = template.content

    const templateVariables = template.variables ? JSON.parse(template.variables) : []

    for (const variable of templateVariables) {
      const placeholder = `{${variable.name}}`
      const value = variables[variable.name] || variable.default_value || `[${variable.label}]`
      renderedContent = renderedContent.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value)
    }

    return NextResponse.json({
      success: true,
      data: {
        rendered_prompt: renderedContent,
        template_name: template.name,
        template_type: template.type,
      },
    })
  } catch (error) {
    console.error('渲染模板失败:', error)
    return NextResponse.json(
      { success: false, error: '渲染模板失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
