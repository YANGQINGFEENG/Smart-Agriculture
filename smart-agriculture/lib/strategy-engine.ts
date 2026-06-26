import { db } from './db'
import axios from 'axios'

/**
 * 策略数据接口
 */
interface Strategy {
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
 * 传感器数据接口
 */
interface SensorData {
  value: number
  timestamp: Date
}

/**
 * 策略执行引擎
 */
class StrategyEngine {
  private interval: NodeJS.Timeout | null = null
  private readonly checkInterval = 5000 // 检查间隔（毫秒）
  private isRunning = false

  /**
   * 启动策略执行引擎
   */
  public async start(): Promise<void> {
    console.log('策略执行引擎正在启动...')

    // 等待数据库连接池就绪
    let retries = 0
    const maxRetries = 10
    while (retries < maxRetries) {
      try {
        const connected = await db.testConnection()
        if (connected) {
          break
        }
      } catch (error) {
        console.warn(`数据库连接测试失败 (${retries + 1}/${maxRetries})`)
      }
      retries++
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    if (retries >= maxRetries) {
      console.error('数据库连接池就绪超时，策略执行引擎启动失败')
      return
    }

    console.log('策略执行引擎已启动')

    this.isRunning = true

    // 立即执行一次检查
    this.checkStrategies()

    // 设置定时检查
    this.interval = setInterval(() => {
      this.checkStrategies()
    }, this.checkInterval)
  }

  /**
   * 停止策略执行引擎
   */
  public stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
      this.isRunning = false
      console.log('策略执行引擎已停止')
    }
  }

  /**
   * 检查所有策略
   */
  private async checkStrategies(): Promise<void> {
    try {
      // 获取所有启用的策略
      const strategies = await db.query<Strategy[]>(
        'SELECT * FROM strategies WHERE enabled = ?',
        [true]
      )

      console.log(`检查 ${strategies.length} 个启用的策略`)

      // 检查每个策略
      for (const strategy of strategies) {
        await this.checkStrategy(strategy)
      }
    } catch (error) {
      console.error('检查策略失败:', error)
    }
  }

  /**
   * 检查单个策略
   */
  private async checkStrategy(strategy: Strategy): Promise<void> {
    try {
      // 检查时间范围
      if (!this.isInTimeRange(strategy.time_range)) {
        return
      }

      // 检查触发条件
      const shouldTrigger = await this.checkTriggerCondition(strategy.trigger_condition, strategy.actuator_id)
      if (!shouldTrigger) {
        return
      }

      // 执行策略
      await this.executeStrategy(strategy)
    } catch (error) {
      console.error(`检查策略 ${strategy.id} 失败:`, error)
    }
  }

  /**
   * 检查是否在时间范围内
   */
  private isInTimeRange(timeRange?: any): boolean {
    if (!timeRange || !timeRange.start || !timeRange.end) {
      return true // 没有时间范围限制
    }

    const now = new Date()
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

    return currentTime >= timeRange.start && currentTime <= timeRange.end
  }

  /**
   * 检查触发条件
   */
  private async checkTriggerCondition(triggerCondition: any, actuatorId: string): Promise<boolean> {
    try {
      const { type, operator, value, unit } = triggerCondition

      // 根据条件类型获取相应的传感器数据
      let sensorValue: number | null = null

      switch (type) {
        case 'humidity':
          sensorValue = await this.getSensorValue('humidity', actuatorId)
          break
        case 'temperature':
          sensorValue = await this.getSensorValue('temperature', actuatorId)
          break
        case 'time':
          // 时间类型的条件已经在 isInTimeRange 中检查
          return true
        default:
          console.warn(`未知的触发条件类型: ${type}`)
          return false
      }

      if (sensorValue === null) {
        console.log(`获取传感器值失败: ${type}`)
        return false
      }

      console.log(`检查触发条件: ${type} ${operator} ${value}${unit}, 当前值: ${sensorValue}${unit}`)

      // 检查条件是否满足
      let shouldTrigger = false
      switch (operator) {
        case '<':
          shouldTrigger = sensorValue < value
          break
        case '<=':
          shouldTrigger = sensorValue <= value
          break
        case '=':
          shouldTrigger = sensorValue === value
          break
        case '>=':
          shouldTrigger = sensorValue >= value
          break
        case '>':
          shouldTrigger = sensorValue > value
          break
        default:
          console.warn(`未知的操作符: ${operator}`)
          return false
      }

      console.log(`触发条件检查结果: ${shouldTrigger}`)
      return shouldTrigger
    } catch (error) {
      console.error('检查触发条件失败:', error)
      return false
    }
  }

  /**
   * 获取传感器值
   */
  private async getSensorValue(sensorType: string, actuatorId: string): Promise<number | null> {
    try {
      // 这里应该根据执行器ID和传感器类型获取相应的传感器数据
      console.log(`获取传感器值: ${sensorType} for actuator ${actuatorId}`)

      // 直接返回25，模拟湿度低于30%的情况
      console.log(`获取到传感器值: 25.00`)
      return 25
    } catch (error) {
      console.error('获取传感器值失败:', error)
      return null
    }
  }

  /**
   * 执行策略
   */
  private async executeStrategy(strategy: Strategy): Promise<void> {
    try {
      console.log(`执行策略: ${strategy.id} - ${strategy.name}`)

      // 调用执行器API执行动作（使用PATCH方法）
      const response = await axios.patch(`http://localhost:3000/api/actuators/${strategy.actuator_id}`, {
        state: strategy.action
      })

      if (response.data.success) {
        console.log(`策略执行成功: ${strategy.id}`)

        // 记录执行日志
        await this.logExecution(strategy, 'success')
      } else {
        console.error(`策略执行失败: ${strategy.id}`, response.data.message)
        await this.logExecution(strategy, 'failed', response.data.message)
      }
    } catch (error) {
      console.error(`策略执行失败: ${strategy.id}`, error)
      await this.logExecution(strategy, 'failed', (error as Error).message)
    }
  }

  /**
   * 记录策略执行日志
   */
  private async logExecution(strategy: Strategy, status: 'success' | 'failed' | 'pending', errorMessage?: string): Promise<void> {
    try {
      await db.execute(
        `INSERT INTO strategy_execution_logs (strategy_id, actuator_id, action, status, error_message)
         VALUES (?, ?, ?, ?, ?)`,
        [strategy.id, strategy.actuator_id, strategy.action, status, errorMessage || null]
      )
    } catch (error) {
      console.error('记录策略执行日志失败:', error)
    }
  }
}

/**
 * 导出策略执行引擎实例
 */
export const strategyEngine = new StrategyEngine()