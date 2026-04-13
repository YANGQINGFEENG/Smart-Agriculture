/**
 * 持续监控WP-002状态变化
 * 检测是否有硬件端在持续上传数据
 */

let lastState: string | null = null
let lastMode: string | null = null
let counter = 0

async function monitorWP002() {
  counter++
  
  try {
    const response = await fetch('http://localhost:3000/api/actuators/WP-002', {
      cache: 'no-store',
    })
    
    const result = await response.json()
    
    if (result.success && result.data) {
      const currentState = result.data.state
      const currentMode = result.data.mode
      const lastUpdate = new Date(result.data.last_update).toLocaleString('zh-CN')
      
      const stateChanged = lastState !== null && lastState !== currentState
      const modeChanged = lastMode !== null && lastMode !== currentMode
      
      if (stateChanged || modeChanged) {
        const stateIcon = currentState === 'on' ? '🟢' : '⚫'
        const modeText = currentMode === 'auto' ? '🤖 自动' : '👤 手动'
        
        console.log(`\n🔔 [${new Date().toLocaleTimeString('zh-CN')}] 状态变化！`)
        console.log(`   ${stateIcon} ${currentState} - ${modeText}`)
        console.log(`   最后更新: ${lastUpdate}`)
      } else {
        process.stdout.write('.')
      }
      
      lastState = currentState
      lastMode = currentMode
    }
  } catch (error) {
    console.error('❌ 错误:', error)
  }
}

console.log('🔍 开始监控WP-002状态变化...')
console.log('💡 每2秒检查一次，状态变化时会显示')
console.log('💡 按 Ctrl+C 停止\n')

monitorWP002()

setInterval(monitorWP002, 2000)
