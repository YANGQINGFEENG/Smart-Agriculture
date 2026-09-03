import { db } from './db'
import { getBeijingTimeForDB } from './beijing-time'
import { DeviceCategory, generateDeviceId, getDeviceTypeConfig, isSensorType, isActuatorType } from './device-types'
import { createLogger } from './logger'

const log = createLogger('DeviceSync')

/**
 * 设备同步服务
 * 统一管理设备节点到sensors/actuators表的同步
 */

/**
 * 同步设备数据接口
 * 支持硬件上报的控制类型和控制范围信息
 */
interface SyncDeviceParams {
  gatewayId: number
  farmId: number
  nodeId: string
  type: string              // 实际类型（可能是unknown_sensor/unknown_actuator）
  originalType?: string     // 原始类型（硬件上报的类型，用于显示）
  name: string
  location: string
  area?: string             // 区域名称（同一IP地址下的设备默认属于同一区域）
  value?: number
  unit: string
  state?: 'on' | 'off' | 'error'
  mode?: 'auto' | 'manual'
  controlValue?: number     // 执行器控制值（如电机速度、舵机角度）
  controlType?: string      // 执行器控制类型（boolean/integer/angle/float/string）
  controlRange?: {          // 执行器控制参数范围
    min: number
    max: number
    step: number
    default: number
  }
  deviceClass: DeviceCategory
  firmware_version?: string
  signal_strength?: number | null
  battery_level?: number | null
  feedback?: Record<string, any>  // 设备回馈数据（方向、速度、蜂鸣模式等）
}

/**
 * 同步结果接口
 */
interface SyncResult {
  deviceId: string
  isNew: boolean
  category: DeviceCategory
}

/**
 * 统一设备同步函数
 * 根据设备类别自动路由到传感器或执行器同步逻辑
 * 支持未分配设备的同步
 * 支持硬件上报的控制类型和控制范围信息
 */
export async function syncDevice(params: SyncDeviceParams): Promise<SyncResult> {
  const { gatewayId, farmId, nodeId, type, name, location, area, value, unit, state, mode, controlValue, controlType, controlRange, deviceClass, originalType, feedback } = params

  // 生成统一的设备ID
  const deviceId = generateDeviceId(type, gatewayId, nodeId)

  if (deviceClass === DeviceCategory.SENSOR) {
    return syncToSensor({
      deviceId,
      gatewayId,
      farmId,
      nodeId,
      type,
      name,
      location,
      area,
      value: value || 0,
      unit,
      originalType,
    })
  } else if (deviceClass === DeviceCategory.ACTUATOR) {
    return syncToActuator({
      deviceId,
      gatewayId,
      farmId,
      nodeId,
      type,
      name,
      location,
      area,
      state: state || 'off',
      mode: mode || 'auto',
      controlValue: controlValue,
      controlType: controlType,
      controlRange: controlRange,
      originalType,
      feedback,  // 传递回馈数据
    })
  } else if (deviceClass === DeviceCategory.UNASSIGNED) {
    // 未分配设备，根据实际类型同步到传感器或执行器表
    if (type === 'unknown_sensor') {
      return syncToSensor({
        deviceId,
        gatewayId,
        farmId,
        nodeId,
        type,
        name,
        location,
        area,
        value: value || 0,
        unit,
        originalType,
      })
    } else if (type === 'unknown_actuator') {
      return syncToActuator({
        deviceId,
        gatewayId,
        farmId,
        nodeId,
        type,
        name,
        location,
        area,
        state: state || 'off',
        mode: mode || 'auto',
        controlValue: controlValue,
        controlType: controlType,
        controlRange: controlRange,
        originalType,
        feedback,  // 传递回馈数据
      })
    }
  }

  return { deviceId, isNew: false, category: deviceClass }
}

/**
 * 同步设备节点到传感器表
 */
async function syncToSensor(params: {
  deviceId: string
  gatewayId: number
  farmId: number
  nodeId: string
  type: string
  name: string
  location: string
  area?: string
  value: number
  unit: string
  originalType?: string
}): Promise<SyncResult> {
  const { deviceId, gatewayId, farmId, nodeId, type, name, location, area, value, unit, originalType } = params

  let isNew = false

  // 检查传感器是否已存在
  const existingSensor = await db.query<any[]>(
    'SELECT id FROM sensors WHERE id = ?',
    [deviceId]
  )

  if (existingSensor.length === 0) {
    // 获取传感器类型ID
    const sensorTypes = await db.query<any[]>(
      'SELECT id FROM sensor_types WHERE type = ?',
      [type]
    )

    if (sensorTypes.length === 0) {
      // 如果类型不存在，尝试从device-types字典获取配置并创建
      const config = getDeviceTypeConfig(type)
      if (config && isSensorType(type)) {
        await db.execute(
          `INSERT INTO sensor_types (type, name, unit) VALUES (?, ?, ?)`,
          [type, config.name, config.unit || '']
        )
        const newTypes = await db.query<any[]>(
          'SELECT id FROM sensor_types WHERE type = ?',
          [type]
        )
        if (newTypes.length > 0) {
          // 创建传感器
          await db.execute(
            `INSERT INTO sensors (id, name, type_id, location, status, battery, area)
             VALUES (?, ?, ?, ?, 'online', 100, ?)`,
            [deviceId, name, newTypes[0].id, location || nodeId, area || '']
          )
          isNew = true
        }
      }
    } else {
      // 创建传感器
      await db.execute(
        `INSERT INTO sensors (id, name, type_id, location, status, battery, area)
         VALUES (?, ?, ?, ?, 'online', 100, ?)`,
        [deviceId, name, sensorTypes[0].id, location || nodeId, area || '']
      )
      isNew = true
    }
  }

  // 更新传感器状态（包含区域信息）
  await db.execute(
    'UPDATE sensors SET status = ?, last_update = ?, area = ? WHERE id = ?',
    ['online', getBeijingTimeForDB(), area || '', deviceId]
  )

  // 插入传感器数据
  await db.execute(
    'INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES (?, ?, ?)',
    [deviceId, value, getBeijingTimeForDB()]
  )

  // 更新或创建设备节点记录
  await upsertDeviceNode(gatewayId, nodeId, type, name, location, 'sensor', area)

  return { deviceId, isNew, category: DeviceCategory.SENSOR }
}

/**
 * 同步设备节点到执行器表
 * 支持硬件上报的控制类型和控制范围信息
 * 
 * 关键逻辑：
 * 1. 如果执行器不存在，自动创建（包括类型和执行器记录）
 * 2. 如果执行器已存在，只更新状态
 * 3. 如果类型不存在，先创建类型再创建执行器
 */
async function syncToActuator(params: {
  deviceId: string
  gatewayId: number
  farmId: number
  nodeId: string
  type: string
  name: string
  location: string
  area?: string
  state: 'on' | 'off' | 'error'
  mode: 'auto' | 'manual'
  controlValue?: number
  controlType?: string
  controlRange?: {
    min: number
    max: number
    step: number
    default: number
  }
  originalType?: string
  feedback?: Record<string, any>  // 设备回馈数据
}): Promise<SyncResult> {
  const { deviceId, gatewayId, farmId, nodeId, type, name, location, area, state, mode, controlValue, controlType, controlRange, originalType, feedback } = params

  log.debug(`开始同步: deviceId=${deviceId}, type=${type}, name=${name}`)

  let isNew = false

  // 检查执行器是否已存在
  const existingActuator = await db.query<any[]>(
    'SELECT id FROM actuators WHERE id = ?',
    [deviceId]
  )

  // 获取设备类型配置（用于默认控制类型）
  const deviceConfig = getDeviceTypeConfig(type)

  // 如果配置不存在，记录警告
  if (!deviceConfig) {
    log.warn(`警告: 找不到类型配置 type=${type}, 将使用默认配置`)
  }

  const defaultControlType = controlType || deviceConfig?.controlType || 'boolean'
  const rawControlRange = controlRange || deviceConfig?.controlRange || { min: 0, max: 100, step: 1, default: 0 }
  // 确保所有字段都有值，避免undefined
  const defaultControlRange = {
    min: rawControlRange.min != null ? rawControlRange.min : 0,
    max: rawControlRange.max != null ? rawControlRange.max : 100,
    step: rawControlRange.step != null ? rawControlRange.step : 1,
    default: rawControlRange.default != null ? rawControlRange.default : 0
  }

  if (existingActuator.length === 0) {
    log.debug(`执行器不存在，准备创建新执行器: ${deviceId}`)

    // 获取执行器类型ID
    const actuatorTypes = await db.query<any[]>(
      'SELECT id FROM actuator_types WHERE type = ?',
      [type]
    )

    if (actuatorTypes.length === 0) {
      log.debug(`执行器类型不存在: type=${type}, 准备创建类型`)

      // 如果类型不存在，尝试从device-types字典获取配置并创建
      if (deviceConfig && isActuatorType(type)) {
        await db.execute(
          `INSERT INTO actuator_types (type, name, description) VALUES (?, ?, ?)`,
          [type, deviceConfig.name, deviceConfig.description || '']
        )
        log.debug(`已创建执行器类型: ${type} (${deviceConfig.name})`)

        const newTypes = await db.query<any[]>(
          'SELECT id FROM actuator_types WHERE type = ?',
          [type]
        )
        if (newTypes.length > 0) {
          // 创建执行器（包含控制类型、控制范围和回馈数据）
          await db.execute(
            `INSERT INTO actuators (id, name, type_id, location, status, state, mode, farm_id, area, control_value, control_type, control_min, control_max, control_step, control_default, feedback)
             VALUES (?, ?, ?, ?, 'online', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              deviceId,
              name,
              newTypes[0].id,
              location || nodeId,
              state,
              mode,
              farmId,
              area || '',
              controlValue || null,
              defaultControlType,
              defaultControlRange.min,
              defaultControlRange.max,
              defaultControlRange.step,
              defaultControlRange.default,
              feedback ? JSON.stringify(feedback) : null
            ]
          )
          isNew = true
          log.debug(`已创建执行器: ${deviceId}, type_id=${newTypes[0].id}`)
        } else {
          log.error(`错误: 创建类型后无法获取类型ID: type=${type}`)
        }
      } else {
        log.error(`错误: 无法创建执行器类型: type=${type}, deviceConfig=${!!deviceConfig}, isActuatorType=${isActuatorType(type)}`)
      }
    } else {
      // 创建执行器（包含控制类型、控制范围和回馈数据）
      await db.execute(
        `INSERT INTO actuators (id, name, type_id, location, status, state, mode, farm_id, area, control_value, control_type, control_min, control_max, control_step, control_default, feedback)
         VALUES (?, ?, ?, ?, 'online', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          deviceId,
          name,
          actuatorTypes[0].id,
          location || nodeId,
          state,
          mode,
          farmId,
          area || '',
          controlValue || null,
          defaultControlType,
          defaultControlRange.min,
          defaultControlRange.max,
          defaultControlRange.step,
          defaultControlRange.default,
          feedback ? JSON.stringify(feedback) : null
        ]
      )
      isNew = true
      log.debug(`已创建执行器: ${deviceId}, type_id=${actuatorTypes[0].id}`)
    }
  } else {
    log.debug(`执行器已存在: ${deviceId}, 只更新状态`)
  }

  // 更新执行器状态（包含区域信息、控制值、控制类型、控制范围和回馈数据）
  // 注意：feedback使用COALESCE，设备未上报feedback时保留原值，避免被重置为null
  await db.execute(
    'UPDATE actuators SET status = ?, state = ?, mode = ?, area = ?, control_value = ?, control_type = ?, control_min = ?, control_max = ?, control_step = ?, control_default = ?, feedback = COALESCE(?, feedback), last_update = ? WHERE id = ?',
    [
      'online',
      state,
      mode,
      area || '',
      controlValue || null,
      defaultControlType,
      defaultControlRange.min,
      defaultControlRange.max,
      defaultControlRange.step,
      defaultControlRange.default,
      feedback ? JSON.stringify(feedback) : null,
      getBeijingTimeForDB(),
      deviceId
    ]
  )

  // 更新或创建设备节点记录
  await upsertDeviceNode(gatewayId, nodeId, type, name, location, 'actuator', area)

  log.debug(`同步完成: deviceId=${deviceId}, isNew=${isNew}`)

  return { deviceId, isNew, category: DeviceCategory.ACTUATOR }
}

/**
 * 更新或创建设备节点记录
 */
async function upsertDeviceNode(
  gatewayId: number,
  nodeId: string,
  sensorType: string,
  name: string,
  location: string,
  nodeType: 'sensor' | 'actuator',
  area?: string
) {
  // 检查设备节点是否已存在
  const existingNode = await db.query<any[]>(
    'SELECT id FROM device_nodes WHERE gateway_id = ? AND node_id = ?',
    [gatewayId, nodeId]
  )

  if (existingNode.length === 0) {
    // 创建设备节点
    await db.execute(
      `INSERT INTO device_nodes (gateway_id, node_id, name, node_type, sensor_type, location, status, area)
       VALUES (?, ?, ?, ?, ?, ?, 'online', ?)`,
      [gatewayId, nodeId, name, nodeType, sensorType, location || null, area || null]
    )
  } else {
    // 更新设备节点
    await db.execute(
      'UPDATE device_nodes SET name = ?, node_type = ?, sensor_type = ?, location = ?, status = ?, area = ?, last_update = ? WHERE id = ?',
      [name, nodeType, sensorType, location || null, 'online', area || null, getBeijingTimeForDB(), existingNode[0].id]
    )
  }
}

// ================ 兼容旧API的函数 ================

/**
 * 同步设备节点到传感器表（兼容旧版本）
 * 当device_nodes有新数据时，自动同步到sensors表
 */
export async function syncNodeToSensor(
  gatewayId: number,
  nodeId: string,
  sensorType: string,
  value: number,
  unit: string
) {
  const deviceConfig = getDeviceTypeConfig(sensorType)

  return syncDevice({
    gatewayId,
    farmId: 0, // 旧API不传递farmId，需要从gateway获取
    nodeId,
    type: sensorType,
    name: deviceConfig ? `${deviceConfig.name}-${nodeId.slice(-4)}` : `设备-${nodeId}`,
    location: '',
    value,
    unit: unit || deviceConfig?.unit || '',
    state: 'off',
    mode: 'auto',
    deviceClass: DeviceCategory.SENSOR,
  })
}

/**
 * 同步设备节点到执行器表（兼容旧版本）
 */
export async function syncNodeToActuator(
  gatewayId: number,
  nodeId: string,
  actuatorType: string,
  state: string
) {
  const deviceConfig = getDeviceTypeConfig(actuatorType)

  return syncDevice({
    gatewayId,
    farmId: 0, // 旧API不传递farmId，需要从gateway获取
    nodeId,
    type: actuatorType,
    name: deviceConfig ? `${deviceConfig.name}-${nodeId.slice(-4)}` : `设备-${nodeId}`,
    location: '',
    value: 0,
    unit: '',
    state: state === 'on' ? 'on' : 'off',
    mode: 'auto',
    deviceClass: DeviceCategory.ACTUATOR,
  })
}

/**
 * 获取设备节点的关联传感器数据（兼容旧版本）
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