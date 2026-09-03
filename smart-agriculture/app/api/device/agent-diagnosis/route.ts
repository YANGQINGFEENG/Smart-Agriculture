import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket } from '@/lib/db'
import { getBeijingTimeForDB } from '@/lib/beijing-time'

interface Gateway extends RowDataPacket {
  id: number
  farm_id: number
}

/**
 * Agent 诊疗记录上报节点
 * 树莓派智能养护 Agent（YOLO 检测 + 专家知识库 + DeepSeek 诊疗）产生的单条记录
 */
interface AgentDiagnosisRecord {
  pest_name: string                       // 病虫害名称（必填）
  confidence?: number                     // YOLO 置信度（0-1）
  expert_id?: string | null               // 专家库条目ID（未命中为 null）
  risk_level?: string                     // 风险等级
  diagnosis?: string                      // AI 诊断描述
  advice?: string                         // 处置建议
  knowledge_source?: string               // 知识来源（expert_database | deepseek_general）
  detected_at?: string                    // 检测时间 YYYY-MM-DD HH:MM:SS
}

/**
 * 边缘 Agent 诊疗结果上报接口
 *
 * 树莓派端 AgentService 将病虫害诊疗结果批量上报到云端：
 *
 * POST /api/device/agent-diagnosis
 * {
 *   "gateway_ip": "10.248.88.186",
 *   "farm_id": 1,
 *   "node_id": "CAM-1-001",
 *   "records": [
 *     {
 *       "pest_name": "红蜘蛛",
 *       "confidence": 0.87,
 *       "expert_id": "P001",
 *       "risk_level": "待评估",
 *       "diagnosis": "疑似红蜘蛛危害...",
 *       "advice": "立即措施：...",
 *       "knowledge_source": "expert_database",
 *       "detected_at": "2026-09-02 10:00:00"
 *     }
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { gateway_ip, farm_id, node_id, records } = body

    if (!gateway_ip) {
      return NextResponse.json(
        { success: false, error: '缺少网关IP地址' },
        { status: 400 }
      )
    }

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { success: false, error: '缺少诊疗记录（records数组不能为空）' },
        { status: 400 }
      )
    }

    // 过滤无效记录
    const validRecords: AgentDiagnosisRecord[] = records.filter(
      (r: AgentDiagnosisRecord) => r && r.pest_name
    )
    if (validRecords.length === 0) {
      return NextResponse.json(
        { success: false, error: '所有记录均缺少 pest_name 字段' },
        { status: 400 }
      )
    }

    // 查找网关（找不到不拦截，gateway_id 存 null）
    let gatewayId: number | null = null
    if (gateway_ip) {
      const gateway = await db.query<Gateway[]>(
        'SELECT id, farm_id FROM gateways WHERE ip_address = ? LIMIT 1',
        [gateway_ip]
      )
      if (gateway.length > 0) {
        gatewayId = gateway[0].id
        // 更新网关心跳
        await db.execute(
          'UPDATE gateways SET last_heartbeat = ? WHERE id = ?',
          [getBeijingTimeForDB(), gatewayId]
        )
      }
    }

    // 逐条入库
    let saved = 0
    const failed: string[] = []
    for (const record of validRecords) {
      try {
        const detectedAt = record.detected_at || getBeijingTimeForDB()
        await db.execute(
          `INSERT INTO agent_diagnosis_records
            (gateway_id, farm_id, node_id, pest_name, confidence, expert_id,
             risk_level, diagnosis, advice, knowledge_source, detected_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            gatewayId,
            farm_id || null,
            node_id || '',
            record.pest_name,
            record.confidence ?? 0,
            record.expert_id || null,
            record.risk_level || '待评估',
            record.diagnosis || '',
            record.advice || '',
            record.knowledge_source || '',
            detectedAt,
          ]
        )
        saved++
      } catch (err) {
        console.error(`[AgentDiagnosis] 单条记录入库失败 (${record.pest_name}):`, err)
        failed.push(record.pest_name)
      }
    }

    console.log(
      `[AgentDiagnosis] 诊疗结果上报: 网关=${gateway_ip}, 节点=${node_id || '-'}, ` +
      `接收=${validRecords.length}, 入库=${saved}, 失败=${failed.length}` +
      (failed.length > 0 ? ` (${failed.join(',')})` : '')
    )

    return NextResponse.json({
      success: saved > 0,
      message: `诊疗结果上报完成，接收${validRecords.length}条，入库${saved}条`,
      gateway_id: gatewayId,
      received: validRecords.length,
      saved,
      failed,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[AgentDiagnosis] 诊疗结果上报失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '诊疗结果上报失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/device/agent-diagnosis?limit=20
 * 获取 Agent 诊疗历史记录
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)

    const rows = await db.query<RowDataPacket[]>(
      `SELECT id, gateway_id, farm_id, node_id, pest_name, confidence, expert_id,
              risk_level, diagnosis, advice, knowledge_source, detected_at, created_at
       FROM agent_diagnosis_records
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit]
    )

    return NextResponse.json({ success: true, data: { records: rows, total: rows.length } })
  } catch (error) {
    console.error('[AgentDiagnosis] 获取诊疗历史失败:', error)
    return NextResponse.json(
      { success: false, error: '获取诊疗历史失败' },
      { status: 500 }
    )
  }
}
