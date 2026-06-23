import { db } from './db'

/**
 * 设备同步服务
 * 负责将device_nodes的数据同步到sensors/actuators表
 */

/**
 * 同步设备节点到传感器表
 * 当device_nodes有新数据时，自动同步到sensors表
 */
export async function syncNodeToSensor(
  gatewayId: number,
  nodeId: string,
  sensorType: string,
  value: number,
  unit: string
) {
  // 1. 获取网关信息（包含farm_id）
  const gateways = await db.query<any[]>(
    'SELECT farm_id, zone_id FROM gateways WHERE id = ?',
    [gatewayId]
  )

  if (gateways.length === 0) return

  const { farm_id, zone_id } = gateways[0]

  // 2. 查找或创建传感器
  const sensorId = `DN-${gatewayId}-${nodeId}`

  const existingSensor = await db.query<any[]>(
    'SELECT id FROM sensors WHERE id = ?',
    [sensorId]
  )

  if (existingSensor.length === 0) {
    // 获取传感器类型ID
    const sensorTypes = await db.query<any[]>(
      'SELECT id FROM sensor_types WHERE type = ?',
      [sensorType]
    )

    if (sensorTypes.length === 0) return

    // 创建传感器
    await db.execute(
      `INSERT INTO sensors (id, name, type_id, location, status, battery, farm_id, zone_id)
       VALUES (?, ?, ?, ?, 'online', 100, ?, ?)`,
      [sensorId, `设备节点-${nodeId}`, sensorTypes[0].id, nodeId, farm_id, zone_id || null]
    )
  }

  // 3. 更新传感器状态
  await db.execute(
    'UPDATE sensors SET status = ?, last_update = CURRENT_TIMESTAMP WHERE id = ?',
    ['online', sensorId]
  )

  // 4. 插入传感器数据
  await db.execute(
    'INSERT INTO sensor_data (sensor_id, value) VALUES (?, ?)',
    [sensorId, value]
  )
}

/**
 * 同步设备节点到执行器表
 */
export async function syncNodeToActuator(
  gatewayId: number,
  nodeId: string,
  actuatorType: string,
  state: string
) {
  // 1. 获取网关信息
  const gateways = await db.query<any[]>(
    'SELECT farm_id, zone_id FROM gateways WHERE id = ?',
    [gatewayId]
  )

  if (gateways.length === 0) return

  const { farm_id, zone_id } = gateways[0]

  // 2. 查找或创建执行器
  const actuatorId = `DN-${gatewayId}-${nodeId}`

  const existingActuator = await db.query<any[]>(
    'SELECT id FROM actuators WHERE id = ?',
    [actuatorId]
  )

  if (existingActuator.length === 0) {
    // 获取执行器类型ID
    const actuatorTypes = await db.query<any[]>(
      'SELECT id FROM actuator_types WHERE type = ?',
      [actuatorType]
    )

    if (actuatorTypes.length === 0) return

    // 创建执行器
    await db.execute(
      `INSERT INTO actuators (id, name, type_id, location, status, state, mode, farm_id, zone_id)
       VALUES (?, ?, ?, ?, 'online', ?, 'auto', ?, ?)`,
      [actuatorId, `设备节点-${nodeId}`, actuatorTypes[0].id, nodeId, state, farm_id, zone_id || null]
    )
  }

  // 3. 更新执行器状态
  await db.execute(
    'UPDATE actuators SET status = ?, state = ?, last_update = CURRENT_TIMESTAMP WHERE id = ?',
    ['online', state, actuatorId]
  )
}

/**
 * 获取设备节点的关联传感器数据
 */
export async function getNodeSensorData(nodeId: string) {
  const sensorId = `DN-%-${nodeId}`
  
  return await db.query<any[]>(
    `SELECT sd.* FROM sensor_data sd
     INNER JOIN sensors s ON sd.sensor_id = s.id
     WHERE s.id LIKE ?
     ORDER BY sd.timestamp DESC
     LIMIT 100`,
    [sensorId]
  )
}
