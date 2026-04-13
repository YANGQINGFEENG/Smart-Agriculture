/**
 * 测试传感器API
 */

async function testSensorAPI() {
  const sensorIds = ['T-001', 'H-001', 'L-001', 'S-001', 'T-002', 'E-001', 'P-001']
  
  console.log('🧪 测试传感器API...\n')
  
  for (const sensorId of sensorIds) {
    const value = 20 + Math.random() * 10
    console.log(`📤 上传传感器 ${sensorId}: ${value.toFixed(2)}`)
    
    try {
      const response = await fetch(`http://localhost:3000/api/sensors/${sensorId}/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      })
      
      const result = await response.json()
      console.log(`   ✅ 成功: ${result.success}`)
    } catch (error) {
      console.log(`   ❌ 失败: ${error}`)
    }
    
    await new Promise(r => setTimeout(r, 100))
  }
  
  console.log('\n✨ 测试完成!')
}

testSensorAPI()
