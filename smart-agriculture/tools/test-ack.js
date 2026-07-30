// 模拟硬件回执测试
const http = require('http');

async function testAck() {
  console.log('=== 硬件回执测试 ===\n');
  
  // 1. 先查询最新的待执行命令
  console.log('1. 查询最新的命令...');
  const commands = await sendRequest('/api/actuators/LT-1-002/commands', 'GET');
  console.log('   命令查询结果:', commands.success ? '成功' : '失败');
  
  if (commands.success && commands.data) {
    console.log(`   命令ID: ${commands.data.id}`);
    console.log(`   命令状态: ${commands.data.status}`);
    console.log(`   命令内容: ${JSON.stringify(commands.data)}`);
    
    // 2. 模拟硬件发送回执
    console.log('\n2. 模拟硬件发送回执...');
    const commandId = commands.data.id;
    
    // 模拟RGB设备回执
    const ackData = {
      gateway_ip: "192.168.1.100",
      actuator_id: "LT-1-002",
      command_id: commandId,
      status: "executed",
      control_value: 50,
      state: "on",
      color: { r: 255, g: 128, b: 0 },
      brightness: 50
    };
    
    console.log('   发送回执数据:', JSON.stringify(ackData, null, 2));
    
    const ackResult = await sendRequest('/api/device/ack', 'POST', ackData);
    console.log('\n   回执结果:', JSON.stringify(ackResult, null, 2));
    
    // 3. 检查执行器状态是否更新
    console.log('\n3. 检查执行器状态...');
    await sleep(500);
    const actuator = await sendRequest('/api/actuators/LT-1-002', 'GET');
    
    if (actuator.success) {
      const a = actuator.data;
      console.log(`   ID: ${a.id}`);
      console.log(`   状态: ${a.state}`);
      console.log(`   控制值: ${a.control_value}`);
      console.log(`   Feedback:`, JSON.stringify(a.feedback, null, 2));
      console.log(`   最后更新: ${a.last_update}`);
      
      if (a.state === 'on' && a.feedback) {
        console.log('\n   ✅ 执行器状态已正确更新！');
      } else {
        console.log('\n   ❌ 执行器状态未更新');
      }
    }
  } else {
    console.log('   没有待执行的命令');
  }
  
  // 4. 检查服务器日志
  console.log('\n4. 提示：');
  console.log('   如果回执失败，请检查：');
  console.log('   - 服务器是否在运行');
  console.log('   - 回执URL是否正确: POST /api/device/ack');
  console.log('   - 参数格式是否匹配: { actuator_id, command_id, status, control_value?, state?, color?, brightness? }');
  
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

testAck().catch(console.error);