import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://localhost:5001'

/**
 * POST /api/rag/build-index
 * 构建向量索引（从知识库加载文档）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { force_rebuild = false } = body

    const knowledgeItems = await db.query<any[]>(
      "SELECT title, content, category, source FROM knowledge_base WHERE status = 'published'"
    )

    if (knowledgeItems.length === 0) {
      return NextResponse.json({
        success: true,
        data: { message: '没有已发布的知识可索引', added_chunks: 0 },
      })
    }

    const documents = knowledgeItems.map(item => ({
      title: item.title,
      content: `[${item.category}] ${item.content}`,
      source: item.source || 'knowledge_base',
    }))

    const response = await fetch(`${RAG_SERVICE_URL}/rag/add-documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documents }),
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
    console.error('构建索引失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '构建索引失败',
        details: error instanceof Error ? error.message : 'RAG服务不可用',
      },
      { status: 500 }
    )
  }
}
