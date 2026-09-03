// 测试直接调用回执API并查看详细响应
const http = require('http');

async function testAckDetailed() {
  console.log('=== 详细回执测试 ===\n');
  
  // 先创建命令
  console.log('1. 创建新命令...');
  const cmdResult = await sendRequest('/api/actuators/LT-1-002/commands', 'POST', {
    control_type: 'rgb',
    command: 'value',
    value: 30  // 30%亮度（非0非50，方便测试）
  });
  
  console.log('   创建结果:', JSON.stringify(cmdResult, null, 2));
  
  if (!cmdResult.success) {
    console.log('   创建失败，退出');
    return;
  }
  
  const commandId = cmdResult.data.id;
  console.log(`   命令ID: ${commandId}`);
  
  // 等待命令进入executing状态
  await sleep(500);
  
  // 发送回执
  console.log('\n2. 发送回执（带详细参数）...');
  const ackData = {
    gateway_ip: "192.168.1.100",
    actuator_id: "LT-1-002",
    command_id: commandId,
    status: "executed",
    control_value: 30,  // 数字类型
    state: "on",
    color: { r: 255, g: 127, b: 0 },
    brightness: 30
  };
  
  console.log('   回执数据:', JSON.stringify(ackData, null, 2));
  
  const ackResult = await sendRequest('/api/device/ack', 'POST', ackData);
  console.log('\n   回执结果:', JSON.stringify(ackResult, null, 2));
  
  // 直接查询数据库
  console.log('\n3. 直接查询数据库验证...');
  await sleep(300);
  
  const dbResult = await sendRequest('/api/actuators/LT-1-002', 'GET');
  console.log('   API返回结果:', JSON.stringify(dbResult, null, 2));
  
  if (dbResult.success) {
    const a = dbResult.data;
    console.log(`\n   状态检查:`);
    console.log(`   - state: ${a.state}`);
    console.log(`   - control_value: ${a.control_value}`);
    console.log(`   - feedback:`, JSON.stringify(a.feedback));
    console.log(`   - last_update: ${a.last_update}`);
    
    const feedback = a.feedback;
    if (feedback && feedback.state === 'on') {
      console.log('\n   ✅ Feedback正确保存！');
    } else {
      console.log('\n   ❌ Feedback未正确保存');
      console.log('      可能原因:');
      console.log('      1. 回执API的UPDATE语句执行失败');
      console.log('      2. feedback字段序列化为JSON时出错');
      console.log('      3. 数据库字段类型不匹配');
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

testAckDetailed().catch(console.error);