import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket } from '@/lib/db'
import { getRagStatus } from '@/lib/knowledge-rag'

interface KnowledgeItem extends RowDataPacket {
  id: number
  title: string
  content: string
  category: string
  tags: string | null
  source: string | null
  status: string
  created_at: Date
  updated_at: Date
}

/**
 * GET /api/knowledge/export
 * 导出知识库（支持JSON格式，包含元数据用于移植）
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const category = url.searchParams.get('category')
    const status = url.searchParams.get('status')
    const format = url.searchParams.get('format') || 'json'

    let query = 'SELECT * FROM knowledge_base'
    const conditions: string[] = []
    const params: any[] = []

    if (category) {
      conditions.push('category = ?')
      params.push(category)
    }
    if (status) {
      conditions.push('status = ?')
      params.push(status)
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }

    query += ' ORDER BY category, title'

    const rows = await db.query<KnowledgeItem[]>(query, params)

    // 按分类分组
    const grouped: Record<string, any[]> = {}
    rows.forEach(item => {
      if (!grouped[item.category]) {
        grouped[item.category] = []
      }
      grouped[item.category].push({
        title: item.title,
        content: item.content,
        tags: item.tags ? item.tags.split(',') : [],
        source: item.source,
        status: item.status,
        created_at: item.created_at,
        updated_at: item.updated_at,
      })
    })

    // 获取RAG状态
    let ragStatus = null
    try {
      ragStatus = await getRagStatus()
    } catch (e) {}

    const exportData = {
      version: '2.0',
      export_date: new Date().toISOString(),
      export_type: 'knowledge_base',
      total_items: rows.length,
      categories: Object.keys(grouped).length,
      rag_enabled: ragStatus?.status === 'ok',
      rag_index_size: ragStatus?.index_size || 0,
      data: grouped,
      metadata: {
        platform: 'smart-agriculture',
        version: '1.0',
        description: '智慧农业知识库导出文件',
      },
    }

    if (format === 'json') {
      return NextResponse.json({
        success: true,
        data: exportData,
        message: `导出 ${rows.length} 条知识`,
      })
    }

    // 返回文件下载
    const jsonString = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    
    return new Response(blob, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="knowledge_export_${new Date().toISOString().slice(0, 10)}.json"`,
      },
    })
  } catch (error) {
    console.error('导出知识库失败:', error)
    return NextResponse.json(
      { success: false, error: '导出失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
