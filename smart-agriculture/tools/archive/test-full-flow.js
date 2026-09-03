// 测试完整控制+回执流程
const http = require('http');

async function testFullFlow() {
  console.log('=== 完整控制流程测试 ===\n');
  
  const actuatorId = 'LT-1-002';
  
  // 1. 发送控制命令
  console.log('1. 发送控制命令...');
  const sendResult = await sendRequest(`/api/actuators/${actuatorId}/commands`, 'POST', {
    control_type: 'rgb',
    command: 'value',
    value: 50  // 50%亮度
  });
  
  if (!sendResult.success) {
    console.log('   ❌ 发送失败:', sendResult.error);
    return;
  }
  
  console.log('   ✅ 命令发送成功');
  const commandId = sendResult.data.id;
  console.log(`   命令ID: ${commandId}`);
  console.log(`   状态: ${sendResult.data.status}`);
  
  // 2. 查询命令状态（模拟硬件轮询）
  console.log('\n2. 硬件轮询获取命令...');
  await sleep(500);
  
  const queryResult = await sendRequest(`/api/actuators/${actuatorId}/commands`, 'GET');
  if (queryResult.success && queryResult.data) {
    console.log('   ✅ 获取命令成功');
    console.log(`   命令状态: ${queryResult.data.status}`);
  }
  
  // 3. 模拟硬件执行并发送回执
  console.log('\n3. 硬件执行并发送回执...');
  await sleep(500);
  
  const ackResult = await sendRequest('/api/device/ack', 'POST', {
    gateway_ip: "192.168.1.100",
    actuator_id: actuatorId,
    command_id: commandId,
    status: "executed",
    control_value: 50,
    state: "on",
    color: { r: 255, g: 255, b: 255 },
    brightness: 50
  });
  
  console.log('   回执结果:', ackResult.success ? '✅ 成功' : '❌ 失败');
  if (ackResult.success) {
    console.log(`   ${ackResult.message}`);
  } else {
    console.log(`   错误: ${ackResult.error}`);
  }
  
  // 4. 检查执行器最终状态
  console.log('\n4. 检查执行器最终状态...');
  await sleep(500);
  
  const actuator = await sendRequest(`/api/actuators/${actuatorId}`, 'GET');
  if (actuator.success) {
    const a = actuator.data;
    console.log(`   ID: ${a.id}`);
    console.log(`   状态(state): ${a.state}`);
    console.log(`   控制值(control_value): ${a.control_value}`);
    console.log(`   最后更新: ${a.last_update}`);
    console.log(`   Feedback:`, JSON.stringify(a.feedback));
    
    // 验证
    const isStateUpdated = a.state === 'on';
    const hasFeedback = a.feedback && a.feedback.state === 'on';
    
    if (isStateUpdated && hasFeedback) {
      console.log('\n   ✅✅✅ 完整流程成功！执行器状态已正确更新');
    } else {
      console.log('\n   ❌ 执行器状态未正确更新');
      if (!isStateUpdated) console.log('      - state 未更新');
      if (!hasFeedback) console.log('      - feedback 未保存');
    }
  }
  
  console.log('\n=== 测试完成 ===');
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

testFullFlow().catch(console.error);