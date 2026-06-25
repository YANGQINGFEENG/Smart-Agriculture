/**
 * 知识库RAG集成服务
 * 将知识库与RAG检索服务集成，支持语义搜索
 */

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://localhost:5001'

interface RagSearchResult {
  id: number
  title: string
  content: string
  score: number
}

/**
 * 同步知识库到RAG索引
 */
export async function syncKnowledgeToRag(knowledgeItems: Array<{
  id: number
  title: string
  content: string
  category: string
  tags?: string | null
}>) {
  try {
    // 将知识转换为RAG文档格式
    const documents = knowledgeItems.map(item => ({
      title: item.title,
      content: `[${item.category}] ${item.content}`,
      source: `knowledge_base_${item.id}`,
      metadata: {
        id: item.id,
        category: item.category,
        tags: item.tags,
      }
    }))

    // 调用RAG服务添加文档
    const response = await fetch(`${RAG_SERVICE_URL}/rag/add-documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documents }),
    })

    if (!response.ok) {
      throw new Error(`RAG服务响应错误: ${response.status}`)
    }

    const result = await response.json()
    return result.data
  } catch (error) {
    console.error('同步到RAG索引失败:', error)
    throw error
  }
}

/**
 * 语义搜索知识库
 */
export async function semanticSearch(query: string, topK: number = 5): Promise<RagSearchResult[]> {
  try {
    const response = await fetch(`${RAG_SERVICE_URL}/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, top_k: topK }),
    })

    if (!response.ok) {
      throw new Error(`RAG服务响应错误: ${response.status}`)
    }

    const result = await response.json()
    
    // 解析RAG返回的结果
    const knowledge = result.data?.retrieved_knowledge || []
    
    return knowledge.map((item: any) => ({
      id: item.metadata?.id || 0,
      title: item.metadata?.title || item.title || '',
      content: item.content || '',
      score: item.score || 0,
    }))
  } catch (error) {
    console.error('语义搜索失败:', error)
    return []
  }
}

/**
 * 获取RAG服务状态
 */
export async function getRagStatus() {
  try {
    const response = await fetch(`${RAG_SERVICE_URL}/health`)
    if (!response.ok) {
      return { status: 'offline', index_size: 0 }
    }
    return await response.json()
  } catch (error) {
    return { status: 'offline', index_size: 0 }
  }
}

/**
 * 清空RAG索引
 */
export async function clearRagIndex() {
  try {
    const response = await fetch(`${RAG_SERVICE_URL}/rag/clear-index`, {
      method: 'POST',
    })
    return await response.json()
  } catch (error) {
    console.error('清空RAG索引失败:', error)
    throw error
  }
}
