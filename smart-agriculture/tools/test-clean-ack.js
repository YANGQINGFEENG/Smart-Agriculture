// 测试重置状态后再发送回执
const http = require('http');

async function testCleanAck() {
  console.log('=== 清理状态后测试回执 ===\n');
  
  // 1. 先重置执行器状态
  console.log('1. 重置执行器状态...');
  const resetResult = await sendRequest('/api/actuators/LT-1-002', 'PATCH', {
    state: 'off'
  });
  console.log('   重置结果:', JSON.stringify(resetResult));
  
  // 清空feedback
  console.log('\n2. 清空feedback...');
  // 直接通过SQL清空
  const clearResult = await sendRequest('/api/device/clear-feedback', 'POST', {
    actuator_id: 'LT-1-002'
  });
  console.log('   清空结果:', JSON.stringify(clearResult));
  
  // 3. 创建新命令
  console.log('\n3. 创建新命令...');
  const cmdResult = await sendRequest('/api/actuators/LT-1-002/commands', 'POST', {
    control_type: 'rgb',
    command: 'value',
    value: 40
  });
  console.log('   创建结果:', JSON.stringify(cmdResult));
  
  if (!cmdResult.success) {
    console.log('   创建失败，退出');
    return;
  }
  
  const commandId = cmdResult.data.id;
  console.log(`   命令ID: ${commandId}`);
  
  // 4. 等待并发送回执
  await sleep(800);
  
  console.log('\n4. 发送回执...');
  const ackResult = await sendRequest('/api/device/ack', 'POST', {
    gateway_ip: "192.168.1.100",
    actuator_id: "LT-1-002",
    command_id: commandId,
    status: "executed",
    control_value: 40,
    state: "on",
    color: { r: 255, g: 127, b: 0 },
    brightness: 40
  });
  console.log('   回执结果:', JSON.stringify(ackResult));
  
  // 5. 检查结果
  await sleep(500);
  
  console.log('\n5. 检查最终状态...');
  const finalResult = await sendRequest('/api/actuators/LT-1-002', 'GET');
  if (finalResult.success) {
    const a = finalResult.data;
    console.log(`   state: ${a.state}`);
    console.log(`   control_value: ${a.control_value}`);
    console.log(`   feedback:`, JSON.stringify(a.feedback));
    console.log(`   last_update: ${a.last_update}`);
    
    if (a.feedback && a.feedback.state === 'on' && a.feedback.color) {
      console.log('\n   ✅✅✅ Feedback正确保存！');
    } else {
      console.log('\n   ❌ Feedback未正确保存');
    }
  }
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

testCleanAck().catch(console.error);