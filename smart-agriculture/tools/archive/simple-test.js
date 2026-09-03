// 简单测试：直接测试回执流程
const http = require('http');

async function main() {
  console.log('=== 直接回执测试 ===\n');
  
  // 创建命令
  console.log('1. 创建命令...');
  const cmd = await post('/api/actuators/LT-1-002/commands', {
    control_type: 'rgb',
    command: 'value',
    value: 20
  });
  console.log('   结果:', cmd.success, '- id:', cmd.data?.id);
  
  if (!cmd.success) return;
  const cmdId = cmd.data.id;
  
  // 等待命令进入executing
  await sleep(600);
  
  // 发送回执
  console.log('\n2. 发送回执...');
  const ack = await post('/api/device/ack', {
    gateway_ip: '192.168.1.100',
    actuator_id: 'LT-1-002',
    command_id: cmdId,
    status: 'executed',
    control_value: 20,
    state: 'on',
    color: { r: 100, g: 200, b: 50 },
    brightness: 20
  });
  console.log('   结果:', ack.success, ack.message);
  
  // 检查状态
  await sleep(300);
  console.log('\n3. 检查状态...');
  const status = await get('/api/actuators/LT-1-002');
  
  if (status.success) {
    const d = status.data;
    console.log(`   state: ${d.state}`);
    console.log(`   control_value: ${d.control_value}`);
    console.log(`   feedback:`, JSON.stringify(d.feedback));
    
    // 验证
    if (d.feedback && typeof d.feedback === 'object' && Object.keys(d.feedback).length > 0) {
      console.log('\n   ✅ Feedback有内容！');
      console.log('   内容:', JSON.stringify(d.feedback, null, 2));
    } else {
      console.log('\n   ❌ Feedback为空或不存在');
    }
  }
}

function post(path, body) {
  return new Promise(resolve => {
    const req = http.request({ hostname: 'localhost', port: 3000, path, method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => {
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

main().catch(console.error);