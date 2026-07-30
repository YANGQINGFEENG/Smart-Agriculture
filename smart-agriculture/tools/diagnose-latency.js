// 诊断服务器端延迟问题
const http = require('http');

async function diagnose() {
  console.log('=== 服务器延迟诊断 ===\n');
  console.log('诊断时间:', new Date().toISOString());
  console.log('='.repeat(50));
  
  // 1. 测试创建命令
  console.log('\n1. 测试创建命令...');
  const t1 = Date.now();
  const cmd = await post('/api/actuators/FN-1-001/commands', {
    control_type: 'integer',
    command: 'value',
    value: 50
  });
  const t2 = Date.now();
  
  console.log(`   创建耗时: ${t2 - t1}ms`);
  console.log(`   结果: ${cmd.success ? '成功' : '失败'}`);
  if (cmd.success) {
    const cmdId = cmd.data.id;
    console.log(`   命令ID: ${cmdId}`);
    
    // 2. 模拟硬件等待并发送回执
    console.log('\n2. 模拟硬件回执...');
    
    // 等待命令进入executing状态（模拟硬件轮询）
    await sleep(300);
    
    const t3 = Date.now();
    const ack = await post('/api/device/ack', {
      gateway_ip: '192.168.1.63',
      actuator_id: 'FN-1-001',
      command_id: cmdId,
      status: 'executed',
      control_value: 50,
      state: 'on',
      brightness: 50
    });
    const t4 = Date.now();
    
    console.log(`   回执耗时: ${t4 - t3}ms`);
    console.log(`   结果: ${ack.success ? '成功' : '失败: ' + ack.error}`);
    
    // 3. 检查状态更新
    console.log('\n3. 检查状态更新...');
    await sleep(100);
    
    const t5 = Date.now();
    const status = await get('/api/actuators/FN-1-001');
    const t6 = Date.now();
    
    console.log(`   查询耗时: ${t6 - t5}ms`);
    
    if (status.success) {
      const d = status.data;
      console.log(`   state: ${d.state}`);
      console.log(`   control_value: ${d.control_value}`);
      console.log(`   feedback:`, JSON.stringify(d.feedback));
      console.log(`   last_update: ${d.last_update}`);
      
      // 4. 检查命令状态
      console.log('\n4. 检查命令状态...');
      const cmdStatus = await get(`/api/actuators/FN-1-001/commands?frontend=true`);
      if (cmdStatus.success && cmdStatus.data) {
        console.log(`   命令状态: ${cmdStatus.data.status}`);
        console.log(`   命令ID: ${cmdStatus.data.id}`);
        console.log(`   executed_at: ${cmdStatus.data.executed_at}`);
      }
      
      // 总结
      console.log('\n' + '='.repeat(50));
      const totalTime = t6 - t1;
      console.log(`总耗时(创建→状态更新): ${totalTime}ms`);
      
      if (d.state === 'on' && d.feedback) {
        console.log('✅ 状态正确更新');
      } else {
        console.log('❌ 状态未正确更新');
      }
      
      console.log('\n延迟分析:');
      console.log(`  - 命令创建: ${t2 - t1}ms`);
      console.log(`  - 等待+回执: ${t4 - t3 + 300}ms`);
      console.log(`  - 状态查询: ${t6 - t5}ms`);
    }
  }
  
  console.log('\n=== 诊断完成 ===');
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

diagnose().catch(console.error);