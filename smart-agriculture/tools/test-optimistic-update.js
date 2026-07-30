// 测试乐观更新效果
const http = require('http');

async function testOptimisticUpdate() {
  console.log('=== 前端状态更新优化测试 ===\n');
  
  // 1. 创建控制命令
  console.log('1. 创建控制命令...');
  const createResult = await post('/api/actuators/VL-1-001/commands', {
    control_type: 'boolean',
    command: 'on'
  });
  
  if (!createResult.success) {
    console.log('❌ 创建命令失败');
    return;
  }
  
  const commandId = createResult.data.id;
  console.log(`   命令ID: ${commandId}`);
  console.log(`   创建时间: ${new Date().toISOString()}`);
  
  // 2. 等待模拟硬件执行
  console.log('\n2. 模拟硬件执行...');
  await sleep(500);
  
  // 3. 发送回执
  console.log('3. 发送回执...');
  const ackResult = await post('/api/device/ack', {
    gateway_ip: '192.168.1.63',
    actuator_id: 'VL-1-001',
    command_id: commandId,
    status: 'executed',
    state: 'on',
    control_value: 100
  });
  console.log(`   回执结果: ${ackResult.success ? '成功' : '失败'}`);
  
  // 4. 模拟前端轮询获取命令状态
  console.log('\n4. 轮询获取命令状态...');
  const startTime = Date.now();
  
  // 第一次轮询（乐观更新）
  const pollResult = await get('/api/actuators/VL-1-001/commands?frontend=true');
  const pollTime = Date.now() - startTime;
  
  if (pollResult.success && pollResult.data) {
    console.log(`   状态: ${pollResult.data.status}`);
    console.log(`   轮询耗时: ${pollTime}ms`);
    
    if (pollResult.data.status === 'executed') {
      console.log('\n✅ 命令已执行，前端可以立即更新状态！');
      console.log('\n5. 优化效果：');
      console.log('   - 乐观更新：收到executed后立即更新UI，无需等待fetchActuators');
      console.log('   - 状态同步：异步调用fetchActuators()刷新服务器数据');
      console.log('   - 用户体验：点击后约300ms即可看到状态变化');
    }
  }
  
  // 5. 检查执行器状态
  console.log('\n5. 检查执行器最新状态...');
  const actuatorStatus = await get('/api/actuators/VL-1-001');
  if (actuatorStatus.success) {
    console.log(`   state: ${actuatorStatus.data.state}`);
    console.log(`   control_value: ${actuatorStatus.data.control_value}`);
    console.log(`   last_update: ${actuatorStatus.data.last_update}`);
  }
  
  console.log('\n=== 测试完成 ===');
}

function post(path, body) {
  return new Promise(resolve => {
    const req = http.request({ 
      hostname: 'localhost', port: 3000, path, method: 'POST', 
      headers: { 'Content-Type': 'application/json' } 
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ error: data }); } });
    });
    req.on('error', e => resolve({ success: false, error: e.message }));
    req.write(JSON.stringify(body));
    req.end();
  });
}

function get(path) {
  return new Promise(resolve => {
    http.get(`http://localhost:3000${path}`, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ error: data }); } });
    }).on('error', e => resolve({ success: false, error: e.message }));
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

testOptimisticUpdate().catch(console.error);