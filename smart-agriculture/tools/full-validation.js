// 完整流程验证测试
const http = require('http');

async function main() {
  console.log('=== 完整流程验证测试 ===\n');
  console.log('测试时间:', new Date().toISOString());
  console.log('=' .repeat(50));
  
  const tests = [
    { name: 'RGB红色', value: 1, expectColor: {r: 255, g: 0, b: 0} },
    { name: 'RGB绿色', value: 2, expectColor: {r: 0, g: 255, b: 0} },
    { name: 'RGB蓝色', value: 3, expectColor: {r: 0, g: 0, b: 255} },
    { name: '白色50%亮度', value: 50, expectColor: null },  // 亮度模式
    { name: '关闭', value: 0, expectColor: null },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    console.log(`\n测试: ${test.name} (value=${test.value})`);
    console.log('-'.repeat(30));
    
    // 1. 创建命令
    const cmd = await post('/api/actuators/LT-1-002/commands', {
      control_type: 'rgb',
      command: 'value',
      value: test.value
    });
    
    if (!cmd.success) {
      console.log(`  ❌ 创建命令失败`);
      failed++;
      continue;
    }
    
    const cmdId = cmd.data.id;
    console.log(`  ✓ 命令创建成功 (ID: ${cmdId})`);
    
    // 2. 等待命令进入executing
    await sleep(500);
    
    // 3. 模拟硬件回执
    const ackData = {
      gateway_ip: '192.168.1.100',
      actuator_id: 'LT-1-002',
      command_id: cmdId,
      status: 'executed',
      control_value: test.value,
      state: test.value > 0 ? 'on' : 'off',
    };
    
    // 添加RGB颜色信息
    if (test.expectColor) {
      ackData.color = test.expectColor;
      ackData.brightness = test.value >= 1 && test.value <= 9 ? 100 : test.value;
    } else {
      ackData.brightness = test.value;
      if (test.value > 0) {
        ackData.color = { r: 255, g: 255, b: 255 };  // 白色
      } else {
        ackData.color = { r: 0, g: 0, b: 0 };  // 关闭
      }
    }
    
    const ack = await post('/api/device/ack', ackData);
    
    if (!ack.success) {
      console.log(`  ❌ 回执失败: ${ack.error}`);
      failed++;
      continue;
    }
    console.log(`  ✓ 回执成功`);
    
    // 4. 检查最终状态
    await sleep(300);
    const status = await get('/api/actuators/LT-1-002');
    
    if (status.success) {
      const d = status.data;
      const feedback = d.feedback;
      
      // 验证
      let checkPass = true;
      const checks = [];
      
      // 检查state
      const expectedState = test.value > 0 ? 'on' : 'off';
      if (d.state !== expectedState) {
        checkPass = false;
        checks.push(`state错误: 期望${expectedState}, 实际${d.state}`);
      } else {
        checks.push(`state: ${d.state}`);
      }
      
      // 检查feedback
      if (!feedback || typeof feedback !== 'object' || Object.keys(feedback).length === 0) {
        checkPass = false;
        checks.push('feedback为空');
      } else {
        checks.push(`feedback有内容`);
        
        // 检查feedback内容
        if (feedback.state !== expectedState) {
          checkPass = false;
          checks.push(`feedback.state错误: 期望${expectedState}, 实际${feedback.state}`);
        }
        if (feedback.color && test.expectColor) {
          if (feedback.color.r !== test.expectColor.r ||
              feedback.color.g !== test.expectColor.g ||
              feedback.color.b !== test.expectColor.b) {
            checkPass = false;
            checks.push(`feedback.color不匹配`);
          }
        }
      }
      
      if (checkPass) {
        console.log(`  ✓ 验证通过 (${checks.join(', ')})`);
        passed++;
      } else {
        console.log(`  ❌ 验证失败: ${checks.join('; ')}`);
        console.log(`      实际数据: state=${d.state}, feedback=${JSON.stringify(feedback)}`);
        failed++;
      }
    } else {
      console.log(`  ❌ 查询状态失败`);
      failed++;
    }
  }
  
  // 总结
  console.log('\n' + '='.repeat(50));
  console.log(`测试结果: ${passed}通过, ${failed}失败, 共${tests.length}个测试`);
  
  if (failed === 0) {
    console.log('🎉 所有测试通过！');
  } else {
    console.log('⚠️ 部分测试失败，请检查日志');
  }
}

function post(path, body) {
  return new Promise(resolve => {
    const req = http.request({ 
      hostname: 'localhost', 
      port: 3000, 
      path, 
      method: 'POST', 
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

main().catch(console.error);