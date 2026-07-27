/**
 * 统一设备类型字典
 * 解决数据库、API、前端之间的类型名不一致问题
 */

/**
 * 设备类别枚举
 */
export enum DeviceCategory {
  SENSOR = 'sensor',        // 传感器
  ACTUATOR = 'actuator',    // 执行器
  GATEWAY = 'gateway',      // 网关
  UNASSIGNED = 'unassigned', // 未分配（未知设备类型）
}

/**
 * 控制参数类型枚举
 * 定义执行器支持的控制方式
 */
export enum ControlType {
  BOOLEAN = 'boolean',    // 布尔值控制（on/off）- 如LED开关、继电器
  INTEGER = 'integer',    // 整数值控制（0-100）- 如电机速度、亮度
  ANGLE = 'angle',        // 角度控制（0-360）- 如舵机角度
  FLOAT = 'float',        // 浮点值控制 - 如精确参数调节
  STRING = 'string',      // 字符串指令 - 如自定义指令
}

/**
 * 设备类型配置接口
 */
export interface DeviceTypeConfig {
  type: string           // 类型标识（唯一）
  name: string           // 中文名称
  category: DeviceCategory  // 设备类别
  unit?: string          // 单位（传感器）
  description?: string   // 描述（执行器）
  icon: string           // 图标名称（lucide-react）
  color: string          // 颜色标识
  controlType?: ControlType  // 控制参数类型（执行器专用）
  controlRange?: {       // 控制参数范围（执行器专用）
    min: number
    max: number
    step: number
    default: number
  }
}

/**
 * 统一设备类型字典
 * 覆盖所有传感器和执行器类型
 */
export const DEVICE_TYPES: DeviceTypeConfig[] = [
  // ========== 传感器类型 ==========
  {
    type: 'temperature',
    name: '空气温度',
    category: DeviceCategory.SENSOR,
    unit: '°C',
    icon: 'Thermometer',
    color: 'red',
  },
  {
    type: 'humidity',
    name: '空气湿度',
    category: DeviceCategory.SENSOR,
    unit: '%',
    icon: 'Droplets',
    color: 'blue',
  },
  {
    type: 'light',
    name: '光照强度',
    category: DeviceCategory.SENSOR,
    unit: 'lux',
    icon: 'Sun',
    color: 'yellow',
  },
  {
    type: 'soil_moisture',
    name: '土壤湿度',
    category: DeviceCategory.SENSOR,
    unit: '%',
    icon: 'Leaf',
    color: 'green',
  },
  {
    type: 'soil_temperature',
    name: '土壤温度',
    category: DeviceCategory.SENSOR,
    unit: '°C',
    icon: 'Thermometer',
    color: 'orange',
  },
  {
    type: 'ph',
    name: 'pH值',
    category: DeviceCategory.SENSOR,
    unit: 'pH',
    icon: 'Droplets',
    color: 'purple',
  },
  {
    type: 'ec',
    name: '电导率',
    category: DeviceCategory.SENSOR,
    unit: 'μS/cm',
    icon: 'Zap',
    color: 'cyan',
  },
  {
    type: 'co2',
    name: 'CO₂浓度',
    category: DeviceCategory.SENSOR,
    unit: 'ppm',
    icon: 'Wind',
    color: 'gray',
  },
  {
    type: 'pm25',
    name: 'PM2.5',
    category: DeviceCategory.SENSOR,
    unit: 'μg/m³',
    icon: 'Cloud',
    color: 'slate',
  },
  {
    type: 'water_level',
    name: '水位',
    category: DeviceCategory.SENSOR,
    unit: 'cm',
    icon: 'Waves',
    color: 'indigo',
  },
  {
    type: 'battery',
    name: '电池电量',
    category: DeviceCategory.SENSOR,
    unit: '%',
    icon: 'Battery',
    color: 'lime',
  },
  {
    type: 'pressure',
    name: '气压',
    category: DeviceCategory.SENSOR,
    unit: 'hPa',
    icon: 'Cloud',
    color: 'indigo',
  },
  {
    type: 'vibration',
    name: '振动',
    category: DeviceCategory.SENSOR,
    unit: 'mm/s',
    icon: 'Activity',
    color: 'orange',
  },
  {
    type: 'altitude',
    name: '海拔',
    category: DeviceCategory.SENSOR,
    unit: 'm',
    icon: 'Mountain',
    color: 'slate',
  },
  // ========== 执行器类型 ==========
  {
    type: 'water_pump',
    name: '水泵',
    category: DeviceCategory.ACTUATOR,
    description: '用于灌溉和排水控制',
    icon: 'Droplets',
    color: 'blue',
    controlType: ControlType.BOOLEAN,
  },
  {
    type: 'fan',
    name: '风扇',
    category: DeviceCategory.ACTUATOR,
    description: '用于通风和温度调节',
    icon: 'Wind',
    color: 'cyan',
    controlType: ControlType.INTEGER,
    controlRange: { min: 0, max: 100, step: 10, default: 50 },
  },
  {
    type: 'heater',
    name: '加热器',
    category: DeviceCategory.ACTUATOR,
    description: '用于温度控制',
    icon: 'Flame',
    color: 'red',
    controlType: ControlType.INTEGER,
    controlRange: { min: 0, max: 100, step: 5, default: 50 },
  },
  {
    type: 'valve',
    name: '电磁阀',
    category: DeviceCategory.ACTUATOR,
    description: '用于水流控制',
    icon: 'CircleDot',
    color: 'gray',
    controlType: ControlType.BOOLEAN,
  },
  {
    type: 'light',
    name: '补光灯',
    category: DeviceCategory.ACTUATOR,
    description: '用于光照调节',
    icon: 'Lightbulb',
    color: 'yellow',
    controlType: ControlType.INTEGER,
    controlRange: { min: 0, max: 100, step: 10, default: 100 },
  },
  {
    type: 'ventilator',
    name: '通风机',
    category: DeviceCategory.ACTUATOR,
    description: '用于空气循环',
    icon: 'Fan',
    color: 'teal',
    controlType: ControlType.BOOLEAN,
  },
  {
    type: 'fogger',
    name: '雾化器',
    category: DeviceCategory.ACTUATOR,
    description: '用于湿度调节和降温',
    icon: 'CloudRain',
    color: 'sky',
    controlType: ControlType.BOOLEAN,
  },
  {
    type: 'motor',
    name: '电机',
    category: DeviceCategory.ACTUATOR,
    description: '用于驱动控制，支持速度调节',
    icon: 'Settings',
    color: 'indigo',
    controlType: ControlType.INTEGER,
    controlRange: { min: 0, max: 100, step: 5, default: 0 },
  },
  {
    type: 'servo',
    name: '舵机',
    category: DeviceCategory.ACTUATOR,
    description: '用于角度控制，支持0-180度旋转',
    icon: 'RotateCw',
    color: 'purple',
    controlType: ControlType.ANGLE,
    controlRange: { min: 0, max: 180, step: 1, default: 90 },
  },
  {
    type: 'led',
    name: 'LED灯',
    category: DeviceCategory.ACTUATOR,
    description: '用于照明和指示，支持开关控制',
    icon: 'Lightbulb',
    color: 'pink',
    controlType: ControlType.BOOLEAN,
  },
  {
    type: 'relay',
    name: '继电器',
    category: DeviceCategory.ACTUATOR,
    description: '用于开关控制，支持通断操作',
    icon: 'ToggleLeft',
    color: 'gray',
    controlType: ControlType.BOOLEAN,
  },
  {
    type: 'laser',
    name: '激光器',
    category: DeviceCategory.ACTUATOR,
    description: '用于激光控制，支持开关控制',
    icon: 'Crosshair',
    color: 'red',
    controlType: ControlType.BOOLEAN,
  },
  {
    type: 'rgb_led',
    name: 'RGB-LED',
    category: DeviceCategory.ACTUATOR,
    description: '用于RGB颜色控制，支持颜色值调节',
    icon: 'Palette',
    color: 'purple',
    controlType: ControlType.INTEGER,
    controlRange: { min: 0, max: 100, step: 1, default: 0 },
  },
  // ========== 未分配设备类型（默认） ==========
  {
    type: 'unknown_sensor',
    name: '未分配传感器',
    category: DeviceCategory.UNASSIGNED,
    unit: '',
    icon: 'HelpCircle',
    color: 'gray',
  },
  {
    type: 'unknown_actuator',
    name: '未分配执行器',
    category: DeviceCategory.UNASSIGNED,
    description: '未知执行器设备',
    icon: 'HelpCircle',
    color: 'gray',
  },
]

/**
 * 根据类型获取设备配置
 */
export function getDeviceTypeConfig(type: string): DeviceTypeConfig | undefined {
  return DEVICE_TYPES.find(t => t.type === type)
}

/**
 * 根据类别获取设备类型列表
 */
export function getDeviceTypesByCategory(category: DeviceCategory): DeviceTypeConfig[] {
  return DEVICE_TYPES.filter(t => t.category === category)
}

/**
 * 获取所有传感器类型
 */
export function getSensorTypes(): DeviceTypeConfig[] {
  return getDeviceTypesByCategory(DeviceCategory.SENSOR)
}

/**
 * 获取所有执行器类型
 */
export function getActuatorTypes(): DeviceTypeConfig[] {
  return getDeviceTypesByCategory(DeviceCategory.ACTUATOR)
}

/**
 * 判断是否为传感器类型
 */
export function isSensorType(type: string): boolean {
  const config = getDeviceTypeConfig(type)
  return config?.category === DeviceCategory.SENSOR
}

/**
 * 判断是否为执行器类型
 */
export function isActuatorType(type: string): boolean {
  const config = getDeviceTypeConfig(type)
  return config?.category === DeviceCategory.ACTUATOR
}

/**
 * 获取设备类型的前缀标识
 */
export function getDeviceTypePrefix(type: string): string {
  const config = getDeviceTypeConfig(type)
  if (!config) return 'DEV'

  switch (config.category) {
    case DeviceCategory.SENSOR:
      // 根据传感器类型返回前缀
      const sensorPrefixMap: Record<string, string> = {
        temperature: 'T',
        humidity: 'H',
        light: 'L',
        soil_moisture: 'SM',
        soil_temperature: 'ST',
        ph: 'P',
        ec: 'EC',
        co2: 'C',
        pm25: 'PM',
        water_level: 'WL',
        battery: 'B',
        pressure: 'PR',
        vibration: 'VB',
        altitude: 'AL',
      }
      return sensorPrefixMap[type] || 'S'
    case DeviceCategory.ACTUATOR:
      // 根据执行器类型返回前缀
      const actuatorPrefixMap: Record<string, string> = {
        water_pump: 'WP',
        fan: 'FN',
        heater: 'HT',
        valve: 'VL',
        light: 'LT',
        ventilator: 'VT',
        fogger: 'FG',
        motor: 'MT',
        servo: 'SV',
        led: 'LED',
        relay: 'RL',
        laser: 'LS',
        rgb_led: 'RGB',
      }
      return actuatorPrefixMap[type] || 'A'
    default:
      return 'DEV'
  }
}

/**
 * 生成统一的设备ID
 * 格式：{PREFIX}-{gatewayId}-{nodeId}
 * 
 * 如果 nodeId 已经包含 '-'，说明它已经是完整格式，直接返回
 * 如果 nodeId 不包含 '-'，则根据类型生成前缀并组合
 */
export function generateDeviceId(type: string, gatewayId: number, nodeId: string): string {
  // 如果 nodeId 已经包含 '-'，说明它已经是完整格式
  if (nodeId.includes('-')) {
    return nodeId.toUpperCase()
  }
  
  const prefix = getDeviceTypePrefix(type)
  const shortNodeId = nodeId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase()
  return `${prefix}-${gatewayId}-${shortNodeId}`
}

/**
 * 验证设备类型是否合法
 */
export function isValidDeviceType(type: string): boolean {
  return DEVICE_TYPES.some(t => t.type === type)
}

/**
 * 判断是否为未分配设备类型
 */
export function isUnassignedType(type: string): boolean {
  return type === 'unknown_sensor' || type === 'unknown_actuator'
}

/**
 * 根据原始类型判断应该归为哪种未分配类型
 * 如果有value字段，归为传感器；如果有state字段，归为执行器
 */
export function getUnassignedDeviceType(hasValue: boolean, hasState: boolean): string {
  if (hasValue) return 'unknown_sensor'
  if (hasState) return 'unknown_actuator'
  return 'unknown_sensor' // 默认归为传感器
}

/**
 * 获取设备类型的分类（兼容未知类型）
 * 返回：sensor / actuator / unassigned
 */
export function getDeviceCategory(type: string): DeviceCategory {
  const config = getDeviceTypeConfig(type)
  if (!config) return DeviceCategory.UNASSIGNED
  return config.category
}

/**
 * 根据原始类型获取设备类别（包括未分配）
 * 通过分析上报数据的字段来判断设备类别
 */
export function determineDeviceCategory(type: string, value?: number, state?: string): DeviceCategory {
  // 如果是已知类型，直接返回
  const config = getDeviceTypeConfig(type)
  if (config && config.category !== DeviceCategory.UNASSIGNED) {
    return config.category
  }

  // 未知类型，根据字段判断
  if (value !== undefined) return DeviceCategory.UNASSIGNED // 有数值，归为未分配传感器
  if (state !== undefined) return DeviceCategory.UNASSIGNED // 有状态，归为未分配执行器
  return DeviceCategory.UNASSIGNED
}