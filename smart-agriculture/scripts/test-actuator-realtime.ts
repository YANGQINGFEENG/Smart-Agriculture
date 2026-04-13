/**
 * 持续模拟硬件上传执行器数据
 * 测试前端实时更新功能
 */

let counter = 0

async function uploadActuatorData() {
  counter++
  
  const testCases = [
    { id: 'WP-001', state: counter % 2 === 0 ? 1 : 0, mode: 0 },
    { id: 'FN-001', state: counter % 3 === 0 ? 1 : 0, mode: 0 },
    { id: 'LT-001', state: counter % 2 === 0 ? 1 : 0, mode: 1 },
  ]

  console.log(`\n🔄 第 ${counter} 次上传数据 [${new Date().toLocaleTimeString('zh-CN')}]`)
  
  for (const testCase of testCases) {
    try {
      const response = await fetch(`http://localhost:3000/api/actuators/${testCase.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state: testCase.state,
          mode: testCase.mode,
        }),
      })

      const result = await response.json()
      
      if (result.success) {
        const stateText = testCase.state === 1 ? '开启' : '关闭'
        const modeText = testCase.mode === 0 ? '自动' : '手动'
        console.log(`✅ ${testCase.id}: ${stateText} - ${modeText}`)
      }
    } catch (error) {
      console.log(`❌ ${testCase.id} 上传失败`)
    }
  }
}

console.log('🚀 开始持续上传执行器数据...')
console.log('💡 每5秒上传一次，观察前端页面变化')
console.log('💡 按 Ctrl+C 停止\n')

uploadActuatorData()

setInterval(uploadActuatorData, 5000)
