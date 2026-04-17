import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket } from '@/lib/db'

/**
 * 检查执行器表结构
 */
export async function GET(request: NextRequest) {
  try {
    // 检查执行器表结构
    const [actuatorsColumns] = await db.query<RowDataPacket[]>(
      'SHOW COLUMNS FROM actuators'
    )

    return NextResponse.json({
      success: true,
      data: {
        actuatorsColumns
      },
      message: '执行器表结构检查成功'
    }, { status: 200 })
  } catch (error) {
    console.error('检查表结构失败:', error)
    return NextResponse.json({
      success: false,
      message: '检查表结构失败',
      error: (error as Error).message
    }, { status: 500 })
  }
}
