import { NextRequest, NextResponse } from 'next/server'

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://localhost:5001'

/**
 * POST /api/rag/query
 * RAG检索查询
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, top_k = 5, template_id } = body

    if (!query) {
      return NextResponse.json(
        { success: false, error: '缺少查询内容' },
        { status: 400 }
      )
    }

    const response = await fetch(`${RAG_SERVICE_URL}/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, top_k, template_id }),
    })

    if (!response.ok) {
      throw new Error(`RAG服务响应错误: ${response.status}`)
    }

    const result = await response.json()

    return NextResponse.json({
      success: true,
      data: result.data,
    })
  } catch (error) {
    console.error('RAG查询失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'RAG查询失败',
        details: error instanceof Error ? error.message : 'RAG服务不可用',
      },
      { status: 500 }
    )
  }
}
