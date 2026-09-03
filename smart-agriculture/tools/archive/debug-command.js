// 检查命令发送和响应格式
const http = require('http');

async function debugCommand() {
  console.log('=== 调试命令流程 ===\n');
  
  const actuatorId = 'LT-1-002';
  
  // 发送控制命令
  console.log('1. 发送控制命令...');
  const sendResult = await sendRequest(`/api/actuators/${actuatorId}/commands`, 'POST', {
    control_type: 'rgb',
    command: 'value',
    value: 50
  });
  
  console.log('   原始响应:', JSON.stringify(sendResult, null, 2));
  
  if (sendResult.success) {
    // 尝试不同的方式获取命令ID
    const commandId = sendResult.data?.id || sendResult.id;
    console.log(`\n   命令ID: ${commandId}`);
    console.log(`   data字段:`, JSON.stringify(sendResult.data));
  }
  
  // 等待一会，然后查询最新命令
  console.log('\n2. 查询最新命令...');
  await sleep(500);
  
  const commands = await sendRequest(`/api/actuators/${actuatorId}/commands`, 'GET');
  console.log('   查询结果:', JSON.stringify(commands, null, 2));
  
  if (commands.success && commands.data) {
    console.log(`\n   命令ID: ${commands.data.id}`);
    console.log(`   命令状态: ${commands.data.status}`);
    
    // 模拟回执
    const ackData = {
      gateway_ip: "192.168.1.100",
      actuator_id: actuatorId,
      command_id: commands.data.id,  // 使用查询到的ID
      status: "executed",
      control_value: 50,
      state: "on",
      color: { r: 255, g: 255, b: 255 },
      brightness: 50
    };
    
    console.log('\n3. 发送回执...');
    console.log('   回执数据:', JSON.stringify(ackData));
    
    const ackResult = await sendRequest('/api/device/ack', 'POST', ackData);
    console.log('   回执结果:', JSON.stringify(ackResult, null, 2));
    
    // 检查最终状态
    console.log('\n4. 检查最终状态...');
    await sleep(300);
    
    const finalStatus = await sendRequest(`/api/actuators/${actuatorId}`, 'GET');
    if (finalStatus.success) {
      const a = finalStatus.data;
      console.log(`   状态: ${a.state}`);
      console.log(`   控制值: ${a.control_value}`);
      console.log(`   Feedback:`, JSON.stringify(a.feedback));
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

debugCommand().catch(console.error);