import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'

interface PromptTemplate extends RowDataPacket {
  id: number
  name: string
  type: string
  content: string
  description: string | null
  variables: string | null
  version: number
  status: 'active' | 'inactive'
  created_at: Date
  updated_at: Date
}

/**
 * GET /api/prompts
 * 获取模板列表
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const type = url.searchParams.get('type')
    const status = url.searchParams.get('status')

    let query = 'SELECT * FROM prompt_templates'
    const conditions: string[] = []
    const params: any[] = []

    if (type) {
      conditions.push('type = ?')
      params.push(type)
    }
    if (status) {
      conditions.push('status = ?')
      params.push(status)
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }

    query += ' ORDER BY created_at DESC'

    const rows = await db.query<PromptTemplate[]>(query, params)

    const data = rows.map(row => ({
      ...row,
      variables: row.variables ? JSON.parse(row.variables) : [],
    }))

    return NextResponse.json({
      success: true,
      data,
      total: data.length,
    })
  } catch (error) {
    console.error('获取模板列表失败:', error)
    return NextResponse.json(
      { success: false, error: '获取模板列表失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/prompts
 * 新增模板
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.name || !body.type || !body.content) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数：name, type, content' },
        { status: 400 }
      )
    }

    const variablesStr = body.variables ? JSON.stringify(body.variables) : null

    const result = await db.execute<ResultSetHeader>(
      `INSERT INTO prompt_templates (name, type, content, description, variables, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        body.name,
        body.type,
        body.content,
        body.description || null,
        variablesStr,
        body.status || 'active',
      ]
    )

    const newId = (result as any).lastID || (result as any).insertId

    return NextResponse.json({
      success: true,
      data: {
        id: newId,
        name: body.name,
        type: body.type,
      },
      message: '模板创建成功',
    })
  } catch (error) {
    console.error('创建模板失败:', error)
    return NextResponse.json(
      { success: false, error: '创建模板失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
