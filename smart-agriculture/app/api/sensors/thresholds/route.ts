import { NextRequest, NextResponse } from 'next/server';
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db';
import { successResponse, errorResponse, serverErrorResponse, validateParams, handleApiRequest } from '@/lib/api-utils';

/**
 * 传感器阈值接口
 */
interface SensorThreshold extends RowDataPacket {
  id: number;
  sensor_id: string;
  min_value: number | null;
  max_value: number | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * GET /api/sensors/thresholds
 * 获取所有传感器的阈值设置
 */
export async function GET(request: NextRequest) {
  return handleApiRequest(async () => {
    const url = new URL(request.url);
    const sensorId = url.searchParams.get('sensorId');

    let query = 'SELECT * FROM sensor_thresholds';
    const params: any[] = [];

    if (sensorId) {
      query += ' WHERE sensor_id = ?';
      params.push(sensorId);
    }

    const thresholds = await db.query<SensorThreshold[]>(query, params);

    return successResponse(thresholds, undefined, thresholds.length);
  });
}

/**
 * POST /api/sensors/thresholds
 * 新增或更新传感器阈值设置
 */
export async function POST(request: NextRequest) {
  return handleApiRequest(async () => {
    const body = await request.json();

    // 验证参数
    const validation = validateParams(body, ['sensor_id']);
    if (!validation.valid) {
      return errorResponse(validation.error!);
    }

    const { sensor_id, min_value, max_value } = body;

    // 检查传感器是否存在
    const sensors = await db.query<any[]>(
      'SELECT id FROM sensors WHERE id = ?',
      [sensor_id]
    );

    if (sensors.length === 0) {
      return errorResponse('传感器不存在');
    }

    // 检查是否已存在阈值设置
    const existingThresholds = await db.query<SensorThreshold[]>(
      'SELECT id FROM sensor_thresholds WHERE sensor_id = ?',
      [sensor_id]
    );

    let result;
    if (existingThresholds.length > 0) {
      // 更新现有阈值
      result = await db.execute<ResultSetHeader>(
        'UPDATE sensor_thresholds SET min_value = ?, max_value = ? WHERE sensor_id = ?',
        [min_value, max_value, sensor_id]
      );
    } else {
      // 新增阈值
      result = await db.execute<ResultSetHeader>(
        'INSERT INTO sensor_thresholds (sensor_id, min_value, max_value) VALUES (?, ?, ?)',
        [sensor_id, min_value, max_value]
      );
    }

    // 获取更新后的阈值
    const updatedThresholds = await db.query<SensorThreshold[]>(
      'SELECT * FROM sensor_thresholds WHERE sensor_id = ?',
      [sensor_id]
    );

    return successResponse(updatedThresholds[0], existingThresholds.length > 0 ? '阈值更新成功' : '阈值设置成功');
  });
}

/**
 * DELETE /api/sensors/thresholds
 * 删除传感器阈值设置
 */
export async function DELETE(request: NextRequest) {
  return handleApiRequest(async () => {
    const url = new URL(request.url);
    const sensorId = url.searchParams.get('sensorId');

    if (!sensorId) {
      return errorResponse('缺少sensorId参数');
    }

    const result = await db.execute<ResultSetHeader>(
      'DELETE FROM sensor_thresholds WHERE sensor_id = ?',
      [sensorId]
    );

    if (result.affectedRows === 0) {
      return errorResponse('阈值设置不存在');
    }

    return successResponse(undefined, '阈值设置删除成功');
  });
}
