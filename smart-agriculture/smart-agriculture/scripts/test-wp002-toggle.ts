/**
 * 手动测试WP-002状态变化
 */

async function testWP002Toggle() {
  console.log('🧪 测试WP-002状态变化...\n')

  try {
    console.log('1️⃣ 将WP-002设置为开启状态...')
    const response1 = await fetch('http://localhost:3000/api/actuators/WP-002', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        state: 1,  // 开启
        mode: 0,   // 自动模式
      }),
    })
    
    const result1 = await response1.json()
    console.log('✅ 结果:', result1.data.state, result1.data.mode)

    console.log('\n2️⃣ 等待2秒后检查状态...')
    await new Promise(resolve => setTimeout(resolve, 2000))

    console.log('\n3️⃣ 获取所有执行器状态...')
    const response2 = await fetch('http://localhost:3000/api/actuators', {
      cache: 'no-store',
    })
    
    const result2 = await response2.json()
    
    if (result2.success && result2.data) {
      const wp002 = result2.data.find((a: any) => a.id === 'WP-002')
      
      if (wp002) {
        const stateIcon = wp002.state === 'on' ? '🟢' : '⚫'
        console.log(`\nWP-002 当前状态: ${stateIcon} ${wp002.state} - ${wp002.mode}`)
        console.log(`最后更新: ${new Date(wp002.last_update).toLocaleString('zh-CN')}`)
        
        if (wp002.state === 'on') {
          console.log('\n✅ WP-002已成功设置为开启状态！')
          console.log('💡 现在刷新浏览器页面，应该能看到WP-002显示为绿色')
        } else {
          console.log('\n⚠️ WP-002仍然是关闭状态')
          console.log('💡 可能是硬件端又上传了关闭状态')
        }
      }
    }

  } catch (error) {
    console.error('❌ 错误:', error)
  }
}

testWP002Toggle()
