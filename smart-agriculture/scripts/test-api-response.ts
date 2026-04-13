/**
 * 测试API返回的数据
 */

async function testAPI() {
  console.log('🔍 测试API返回的数据...\n')

  try {
    const response = await fetch('http://localhost:3000/api/actuators', {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
      },
    })
    
    const result = await response.json()
    
    if (result.success && result.data) {
      const now = Date.now()
      
      console.log(`当前时间: ${new Date().toLocaleString('zh-CN')}`)
      console.log(`当前时间戳: ${now}\n`)
      
      result.data.forEach((actuator: any) => {
        const updateTime = new Date(actuator.last_update).getTime()
        const hoursDiff = (now - updateTime) / (1000 * 60 * 60)
        
        console.log(`执行器: ${actuator.name}`)
        console.log(`  最后更新: ${actuator.last_update}`)
        console.log(`  解析时间: ${new Date(actuator.last_update).toLocaleString('zh-CN')}`)
        console.log(`  时间戳: ${updateTime}`)
        console.log(`  时间差: ${hoursDiff.toFixed(2)} 小时`)
        console.log(`  是否显示: ${hoursDiff < 1 ? '✅ 是' : '❌ 否'}\n`)
      })
      
      const validActuators = result.data.filter((a: any) => {
        if (!a.last_update) return false
        const updateTime = new Date(a.last_update).getTime()
        const hoursDiff = (now - updateTime) / (1000 * 60 * 60)
        return hoursDiff < 1
      })
      
      console.log(`\n📊 统计:`)
      console.log(`总执行器数: ${result.data.length}`)
      console.log(`1小时内有数据的执行器: ${validActuators.length}`)
      
      if (validActuators.length > 0) {
        console.log('\n✅ 应该显示的执行器:')
        validActuators.forEach((a: any) => {
          const stateIcon = a.state === 'on' ? '🟢' : '⚫'
          console.log(`${stateIcon} ${a.name} - ${a.state}`)
        })
      } else {
        console.log('\n❌ 没有执行器在1小时内有数据更新')
        console.log('💡 需要硬件端上传最新数据')
      }
    }
  } catch (error) {
    console.error('❌ 错误:', error)
  }
}

testAPI()
