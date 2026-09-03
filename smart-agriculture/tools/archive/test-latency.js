// 测试控制指令延时
const http = require('http');

async function testControlLatency() {
  console.log('=== 控制指令延时测试 ===\n');
  
  // 1. 检查 WebSocket Relay 状态
  console.log('1. 检查 WebSocket Relay 服务状态...');
  try {
    const wsStatus = await sendRequest('/api/websocket/status', 'GET');
    console.log(`   WebSocket 状态:`, JSON.stringify(wsStatus));
  } catch (e) {
    console.log(`   ❌ WebSocket 检查失败: ${e.message}`);
  }
  
  // 2. 发送控制指令并测量延时
  console.log('\n2. 发送控制指令测试...');
  
  const testActuatorId = 'VL-1-001'; // 使用继电器测试
  
  // 先切换到 off
  console.log('\n--- 测试1: 发送 off 指令 ---');
  const start1 = Date.now();
  
  const command1 = await sendRequest(`/api/actuators/${testActuatorId}/commands`, 'POST', {
    control_type: 'boolean',
    command: 'off'
  });
  
  const end1 = Date.now();
  console.log(`   API 响应时间: ${end1 - start1}ms`);
  console.log(`   指令结果:`, JSON.stringify(command1));
  
  // 等待一会，让指令被执行
  console.log('   等待 3 秒...');
  await sleep(3000);
  
  // 查询指令状态
  const status1 = await sendRequest(`/api/actuators/${testActuatorId}/commands?frontend=true`, 'GET');
  console.log(`   指令状态:`, status1.data ? status1.data.status : 'null');
  console.log(`   执行耗时: ${end1 - start1}ms (API响应) + 3000ms (等待) = ${end1 - start1 + 3000}ms`);
  
  // 3. 发送 on 指令
  console.log('\n--- 测试2: 发送 on 指令 ---');
  const start2 = Date.now();
  
  const command2 = await sendRequest(`/api/actuators/${testActuatorId}/commands`, 'POST', {
    control_type: 'boolean',
    command: 'on'
  });
  
  const end2 = Date.now();
  console.log(`   API 响应时间: ${end2 - start2}ms`);
  console.log(`   指令结果:`, JSON.stringify(command2));
  
  // 立即查询状态
  const status2 = await sendRequest(`/api/actuators/${testActuatorId}/commands?frontend=true`, 'GET');
  console.log(`   立即查询状态:`, status2.data ? status2.data.status : 'null');
  
  console.log('\n--- 分析结果 ---');
  console.log(`API 平均响应时间: ${((end1 - start1) + (end2 - start2)) / 2}ms`);
  console.log(`\n如果 WebSocket 不可用，延时来自:`);
  console.log(`  1. 前端轮询间隔: 1500ms`);
  console.log(`  2. 硬件轮询间隔: 未知（可能 30 秒）`);
  console.log(`  3. 数据库操作: ~100ms`);
  console.log(`\n建议优化:`);
  console.log(`  1. 减小前端轮询间隔到 300-500ms`);
  console.log(`  2. 确保 WebSocket Relay 正常运行`);
  console.log(`  3. 减小硬件端轮询间隔`);
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

testControlLatency().catch(console.error);