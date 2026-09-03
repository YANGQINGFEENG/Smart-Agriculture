// 测试RGB灯控制流程
const http = require('http');

async function testRGBControl() {
  console.log('=== RGB灯控制测试 ===\n');
  
  const actuatorId = 'LT-1-002'; // RGB-LED设备
  
  // 测试1: value命令 (预设颜色)
  console.log('1. 测试value命令 - 设置红色(value=1):');
  const result1 = await sendRequest(`/api/actuators/${actuatorId}/commands`, 'POST', {
    control_type: 'rgb',
    command: 'value',
    value: 1  // 红色
  });
  console.log('   结果:', result1.success ? '✅ 成功' : '❌ 失败');
  console.log('   详情:', JSON.stringify(result1.data || result1.error));
  
  // 等待1秒
  await sleep(1000);
  
  // 测试2: color命令 (自定义RGB)
  console.log('\n2. 测试color命令 - 自定义橙色(255,128,0):');
  const result2 = await sendRequest(`/api/actuators/${actuatorId}/commands`, 'POST', {
    control_type: 'rgb',
    command: 'color',
    r: 255,
    g: 128,
    b: 0
  });
  console.log('   结果:', result2.success ? '✅ 成功' : '❌ 失败');
  console.log('   详情:', JSON.stringify(result2.data || result2.error));
  
  // 等待1秒
  await sleep(1000);
  
  // 测试3: preset命令 (预设颜色名称)
  console.log('\n3. 测试preset命令 - 设置purple:');
  const result3 = await sendRequest(`/api/actuators/${actuatorId}/commands`, 'POST', {
    control_type: 'rgb',
    command: 'preset',
    preset: 'purple'
  });
  console.log('   结果:', result3.success ? '✅ 成功' : '❌ 失败');
  console.log('   详情:', JSON.stringify(result3.data || result3.error));
  
  // 等待1秒
  await sleep(1000);
  
  // 测试4: value命令 (白色亮度)
  console.log('\n4. 测试value命令 - 设置白色亮度(value=50):');
  const result4 = await sendRequest(`/api/actuators/${actuatorId}/commands`, 'POST', {
    control_type: 'rgb',
    command: 'value',
    value: 50  // 50%亮度白色
  });
  console.log('   结果:', result4.success ? '✅ 成功' : '❌ 失败');
  console.log('   详情:', JSON.stringify(result4.data || result4.error));
  
  // 等待1秒
  await sleep(1000);
  
  // 测试5: value命令 (关闭)
  console.log('\n5. 测试value命令 - 关闭(value=0):');
  const result5 = await sendRequest(`/api/actuators/${actuatorId}/commands`, 'POST', {
    control_type: 'rgb',
    command: 'value',
    value: 0  // 关闭
  });
  console.log('   结果:', result5.success ? '✅ 成功' : '❌ 失败');
  console.log('   详情:', JSON.stringify(result5.data || result5.error));
  
  // 检查执行器当前状态
  console.log('\n6. 检查执行器当前状态:');
  const actuatorStatus = await sendRequest(`/api/actuators/${actuatorId}`, 'GET');
  if (actuatorStatus.success) {
    const a = actuatorStatus.data;
    console.log(`   ID: ${a.id}`);
    console.log(`   类型: ${a.type}`);
    console.log(`   状态: ${a.state}`);
    console.log(`   控制值: ${a.control_value}`);
    console.log(`   Feedback:`, JSON.stringify(a.feedback));
  }
  
  console.log('\n=== 测试完成 ===');
  console.log('\n注：如果WebSocket不可用，指令会存储在数据库中等待硬件轮询获取。');
  console.log('硬件端需要轮询查询指令并回执执行结果。');
}

function sendRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

testRGBControl().catch(console.error);