import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'

/**
 * 策略数据接口
 */
interface Strategy extends RowDataPacket {
  id: string
  name: string
  actuator_id: string
  enabled: boolean
  trigger_condition: any
  time_range?: any
  action: 'on' | 'off'
  stop_condition?: any
  safety_config: any
  created_at: Date
  updated_at: Date
}

/**
 * 获取单个策略
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const strategies = await db.query<Strategy[]>('SELECT * FROM strategies WHERE id = ?', [id])
    
    if (strategies.length === 0) {
      return NextResponse.json({
        success: false,
        data: null,
        message: '策略不存在'
      }, { status: 404 })
    }
    
    return NextResponse.json({
      success: true,
      data: strategies[0],
      message: '获取策略成功'
    }, { status: 200 })
  } catch (error) {
    console.error('获取策略失败:', error)
    return NextResponse.json({
      success: false,
      data: null,
      message: '获取策略失败'
    }, { status: 500 })
  }
}

/**
 * 更新策略
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, enabled, trigger_condition, time_range, action, stop_condition, safety_config } = body
    
    // 验证策略是否存在
    const existingStrategies = await db.query<Strategy[]>('SELECT * FROM strategies WHERE id = ?', [id])
    if (existingStrategies.length === 0) {
      return NextResponse.json({
        success: false,
        data: null,
        message: '策略不存在'
      }, { status: 404 })
    }
    
    // 构建更新语句
    const updates: string[] = []
    const updateParams: any[] = []
    
    if (name !== undefined) {
      updates.push('name = ?')
      updateParams.push(name)
    }
    if (enabled !== undefined) {
      updates.push('enabled = ?')
      updateParams.push(enabled)
    }
    if (trigger_condition !== undefined) {
      updates.push('trigger_condition = ?')
      updateParams.push(JSON.stringify(trigger_condition))
    }
    if (time_range !== undefined) {
      updates.push('time_range = ?')
      updateParams.push(time_range ? JSON.stringify(time_range) : null)
    }
    if (action !== undefined) {
      updates.push('action = ?')
      updateParams.push(action)
    }
    if (stop_condition !== undefined) {
      updates.push('stop_condition = ?')
      updateParams.push(stop_condition ? JSON.stringify(stop_condition) : null)
    }
    if (safety_config !== undefined) {
      updates.push('safety_config = ?')
      updateParams.push(JSON.stringify(safety_config))
    }
    
    if (updates.length === 0) {
      return NextResponse.json({
        success: false,
        data: null,
        message: '没有需要更新的字段'
      }, { status: 400 })
    }
    
    // 执行更新
    updateParams.push(id)
    const result = await db.execute<ResultSetHeader>(
      `UPDATE strategies SET ${updates.join(', ')} WHERE id = ?`,
      updateParams
    )
    
    if (result.affectedRows === 0) {
      return NextResponse.json({
        success: false,
        data: null,
        message: '更新策略失败'
      }, { status: 500 })
    }
    
    // 获取更新后的策略
    const updatedStrategy = await db.query<Strategy[]>('SELECT * FROM strategies WHERE id = ?', [id])
    
    return NextResponse.json({
      success: true,
      data: updatedStrategy[0],
      message: '更新策略成功'
    }, { status: 200 })
  } catch (error) {
    console.error('更新策略失败:', error)
    return NextResponse.json({
      success: false,
      data: null,
      message: '更新策略失败'
    }, { status: 500 })
  }
}

/**
 * 删除策略
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // 验证策略是否存在
    const existingStrategies = await db.query<Strategy[]>('SELECT * FROM strategies WHERE id = ?', [id])
    if (existingStrategies.length === 0) {
      return NextResponse.json({
        success: false,
        data: null,
        message: '策略不存在'
      }, { status: 404 })
    }
    
    // 执行删除
    const result = await db.execute<ResultSetHeader>('DELETE FROM strategies WHERE id = ?', [id])
    
    if (result.affectedRows === 0) {
      return NextResponse.json({
        success: false,
        data: null,
        message: '删除策略失败'
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      data: null,
      message: '删除策略成功'
    }, { status: 200 })
  } catch (error) {
    console.error('删除策略失败:', error)
    return NextResponse.json({
      success: false,
      data: null,
      message: '删除策略失败'
    }, { status: 500 })
  }
}
