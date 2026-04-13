/**
 * 测试数据库连接
 */

async function testDatabaseConnection() {
  console.log('🔍 测试数据库连接...\n')

  try {
    const response = await fetch('http://localhost:3000/api/sensors', {
      cache: 'no-store',
    })
    
    const result = await response.json()
    
    if (result.success) {
      console.log('✅ 数据库连接成功！')
      console.log(`📊 传感器数量: ${result.data.length}`)
      
      if (result.data.length > 0) {
        console.log('\n传感器列表:')
        result.data.slice(0, 5).forEach((sensor: any) => {
          console.log(`  - ${sensor.name} (${sensor.id})`)
        })
      }
    } else {
      console.log('❌ 数据库连接失败:', result.error)
    }
  } catch (error) {
    console.error('❌ 请求失败:', error)
  }
}

testDatabaseConnection()
