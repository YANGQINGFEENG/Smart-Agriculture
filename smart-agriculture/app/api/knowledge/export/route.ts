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
 * 导出知识库（支持多种范围选择）
 * 
 * 查询参数：
 * - format: json (默认) 或 file (下载)
 * - range: all (全部) / category (按分类) / status (按状态) / ids (指定ID) / date (按日期)
 * - category: 分类名称（range=category时必填）
 * - status: 状态（range=status时必填）
 * - ids: ID列表，逗号分隔（range=ids时必填）
 * - start_date: 开始日期（range=date时必填）
 * - end_date: 结束日期（range=date时必填）
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const range = url.searchParams.get('range') || 'all'
    const category = url.searchParams.get('category')
    const status = url.searchParams.get('status')
    const ids = url.searchParams.get('ids')
    const startDate = url.searchParams.get('start_date')
    const endDate = url.searchParams.get('end_date')
    const format = url.searchParams.get('format') || 'json'

    let query = 'SELECT * FROM knowledge_base'
    const conditions: string[] = []
    const params: any[] = []

    // 根据范围参数构建查询条件
    switch (range) {
      case 'category':
        if (category) {
          conditions.push('category = ?')
          params.push(category)
        }
        break
      case 'status':
        if (status) {
          conditions.push('status = ?')
          params.push(status)
        }
        break
      case 'ids':
        if (ids) {
          const idList = ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
          if (idList.length > 0) {
            conditions.push(`id IN (${idList.map(() => '?').join(',')})`)
            params.push(...idList)
          }
        }
        break
      case 'date':
        if (startDate) {
          conditions.push('created_at >= ?')
          params.push(startDate)
        }
        if (endDate) {
          conditions.push('created_at <= ?')
          params.push(endDate + ' 23:59:59')
        }
        break
      case 'all':
      default:
        // 不添加条件，导出全部
        break
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
