/**
 * 传感器数据上传测试脚本
 * 模拟硬件设备实时上传传感器数据
 * 
 * 使用方法：
 * npx tsx scripts/upload-test-data.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// 加载环境变量
config({ path: resolve(process.cwd(), '.env.local') })

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

// 传感器配置
const sensors = [
  { id: 'T-001', name: '温度传感器1', min: 18, max: 30, unit: '°C' },
  { id: 'T-002', name: '温度传感器2', min: 18, max: 30, unit: '°C' },
  { id: 'T-003', name: '温度传感器3', min: 18, max: 30, unit: '°C' },
  { id: 'H-001', name: '湿度传感器1', min: 50, max: 80, unit: '%' },
  { id: 'H-002', name: '湿度传感器2', min: 50, max: 80, unit: '%' },
  { id: 'L-001', name: '光照传感器1', min: 5000, max: 15000, unit: 'Lux' },
  { id: 'L-002', name: '光照传感器2', min: 5000, max: 15000, unit: 'Lux' },
  { id: 'S-001', name: '土壤湿度传感器1', min: 30, max: 60, unit: '%' },
  { id: 'S-002', name: '土壤湿度传感器2', min: 30, max: 60, unit: '%' },
  { id: 'S-003', name: '土壤湿度传感器3', min: 30, max: 60, unit: '%' },
]

/**
 * 生成随机传感器数据
 */
function generateSensorValue(min: number, max: number): number {
  return parseFloat((min + Math.random() * (max - min)).toFixed(2))
}

/**
 * 上传传感器数据
 */
async function uploadSensorData(sensorId: string, value: number): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/sensors/${sensorId}/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value }),
    })

    const result = await response.json()
    
    if (result.success) {
      console.log(`✅ [${sensorId}] 数据上传成功: ${value}`)
      return true
    } else {
      console.error(`❌ [${sensorId}] 数据上传失败:`, result.error)
      return false
    }
  } catch (error) {
    console.error(`❌ [${sensorId}] 数据上传异常:`, error)
    return false
  }
}

/**
 * 批量上传所有传感器数据
 */
async function uploadAllSensors(): Promise<void> {
  console.log('\n📤 开始上传传感器数据...')
  console.log('⏰ 时间:', new Date().toLocaleString('zh-CN'))
  console.log('─'.repeat(60))

  const promises = sensors.map(async (sensor) => {
    const value = generateSensorValue(sensor.min, sensor.max)
    await uploadSensorData(sensor.id, value)
  })

  await Promise.all(promises)
  console.log('─'.repeat(60))
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 传感器数据上传测试脚本')
  console.log('📍 服务器地址:', BASE_URL)
  console.log('📊 传感器数量:', sensors.length)
  console.log('⏱️  上传间隔: 5秒')
  console.log('─'.repeat(60))

  // 首次上传
  await uploadAllSensors()

  // 定时上传（每5秒一次）
  let count = 1
  const interval = setInterval(async () => {
    count++
    console.log(`\n🔄 第 ${count} 次上传`)
    await uploadAllSensors()

    // 上传10次后停止
    if (count >= 10) {
      clearInterval(interval)
      console.log('\n✨ 测试完成！共上传 10 次数据')
      console.log('💡 请查看网页 http://localhost:3000 确认数据更新')
      process.exit(0)
    }
  }, 5000)

  // 处理中断信号
  process.on('SIGINT', () => {
    clearInterval(interval)
    console.log('\n\n⏹️  测试已停止')
    process.exit(0)
  })
}

// 运行主函数
main().catch((error) => {
  console.error('❌ 脚本执行失败:', error)
  process.exit(1)
})
