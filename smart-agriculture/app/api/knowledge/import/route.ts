import { NextRequest, NextResponse } from 'next/server'
import { db, ResultSetHeader } from '@/lib/db'

/**
 * POST /api/knowledge/import
 * 导入知识库（从JSON数据）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { data, mode = 'skip' } = body

    if (!data || !data.data) {
      return NextResponse.json(
        { success: false, error: '无效的导入数据格式' },
        { status: 400 }
      )
    }

    const importData = data.data
    let imported = 0
    let skipped = 0
    let updated = 0
    const errors: string[] = []

    // 遍历所有分类
    for (const [category, items] of Object.entries(importData)) {
      if (!Array.isArray(items)) continue

      for (const item of items as any[]) {
        try {
          // 检查是否已存在（按标题匹配）
          const existing = await db.query<any[]>(
            'SELECT id FROM knowledge_base WHERE title = ? AND category = ?',
            [item.title, category]
          )

          if (existing.length > 0) {
            if (mode === 'overwrite') {
              // 覆盖模式：更新已有记录
              await db.execute(
                `UPDATE knowledge_base SET content = ?, tags = ?, source = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [
                  item.content,
                  Array.isArray(item.tags) ? item.tags.join(',') : item.tags || null,
                  item.source || null,
                  existing[0].id,
                ]
              )
              updated++
            } else {
              // 跳过模式：跳过已有记录
              skipped++
            }
          } else {
            // 新增记录
            await db.execute(
              `INSERT INTO knowledge_base (title, content, category, tags, source, status)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                item.title,
                item.content,
                category,
                Array.isArray(item.tags) ? item.tags.join(',') : item.tags || null,
                item.source || null,
                item.status || 'published',
              ]
            )
            imported++
          }
        } catch (err) {
          errors.push(`导入失败: ${item.title} - ${err instanceof Error ? err.message : '未知错误'}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        imported,
        updated,
        skipped,
        errors,
        total: imported + updated + skipped,
      },
      message: `导入完成: 新增 ${imported} 条, 更新 ${updated} 条, 跳过 ${skipped} 条`,
    })
  } catch (error) {
    console.error('导入知识库失败:', error)
    return NextResponse.json(
      { success: false, error: '导入失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
