/**
 * 使用API接口模拟硬件上传执行器数据
 * 测试执行器状态更新和前端显示
 */

async function testActuatorAPI() {
  const testCases = [
    { id: 'WP-001', state: 1, mode: 0, description: 'A区温室1号水泵 - 开启 - 自动模式' },
    { id: 'WP-002', state: 0, mode: 1, description: 'B区温室2号水泵 - 关闭 - 手动模式' },
    { id: 'FN-001', state: 1, mode: 0, description: 'A区温室1号风扇 - 开启 - 自动模式' },
    { id: 'LT-001', state: 1, mode: 1, description: 'A区温室1号补光灯 - 开启 - 手动模式' },
  ]

  console.log('🚀 开始测试执行器API...\n')

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
        console.log(`✅ ${testCase.description}`)
        console.log(`   状态: ${result.data.state}, 模式: ${result.data.mode}`)
      } else {
        console.log(`❌ ${testCase.description} - 失败: ${result.error}`)
      }
    } catch (error) {
      console.log(`❌ ${testCase.description} - 错误:`, error)
    }
  }

  console.log('\n📊 获取所有执行器状态...')
  
  try {
    const response = await fetch('http://localhost:3000/api/actuators', {
      cache: 'no-store',
    })
    const result = await response.json()
    
    if (result.success) {
      console.log('\n执行器列表:')
      result.data.forEach((actuator: any) => {
        const stateIcon = actuator.state === 'on' ? '🟢' : '⚫'
        const modeIcon = actuator.mode === 'auto' ? '🤖' : '👤'
        console.log(`${stateIcon} ${actuator.name} - ${actuator.state} ${modeIcon} ${actuator.mode}`)
      })
    }
  } catch (error) {
    console.log('❌ 获取执行器列表失败:', error)
  }

  console.log('\n✅ 测试完成！')
  console.log('💡 现在刷新浏览器页面 http://localhost:3000')
  console.log('💡 应该能看到执行器状态卡片，状态会根据硬件上传的数据显示')
}

testActuatorAPI()
