// 测试设备回馈功能
// 测试风扇和蜂鸣器的回馈数据是否正确保存和返回

const http = require('http');

async function test() {
  console.log('=== 开始测试设备回馈功能 ===\n');
  
  // 测试1：上报带回馈数据的风扇
  console.log('测试1：上报带回馈数据的风扇');
  const fanReport = {
    gateway_ip: "192.168.1.201",
    gateway_type: "test_gateway",
    mac: "11:22:33:44:55:66",
    farm_id: 1,
    area: "测试区域",
    nodes: [
      {
        node_id: "FN-FEEDBACK-001",
        type: "fan",
        state: "on",
        mode: "manual",
        control_value: 75,
        control_type: "integer",
        control_range: { min: 0, max: 100, step: 1, default: 0 },
        location: "测试风扇",
        area: "测试区域",
        feedback: {
          direction: "forward",
          speed: 0.75,
          pins: { in1: 5, in2: 6, pwm: 9 },
          initialized: true
        }
      }
    ]
  };
  
  try {
    const result = await sendRequest('/api/device/report', 'POST', fanReport);
    console.log('风扇上报结果:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('风扇上报失败:', e.message);
  }
  
  // 测试2：上报带回馈数据的蜂鸣器
  console.log('\n测试2：上报带回馈数据的蜂鸣器');
  const buzzerReport = {
    gateway_ip: "192.168.1.201",
    gateway_type: "test_gateway",
    mac: "11:22:33:44:55:66",
    farm_id: 1,
    area: "测试区域",
    nodes: [
      {
        node_id: "BZ-FEEDBACK-001",
        type: "buzzer",
        state: "off",
        mode: "manual",
        control_value: 0,
        control_type: "boolean",
        location: "测试蜂鸣器",
        area: "测试区域",
        feedback: {
          pattern: "alarm",
          duration: 0.5,
          command_count: 42,
          pin: 10
        }
      }
    ]
  };
  
  try {
    const result = await sendRequest('/api/device/report', 'POST', buzzerReport);
    console.log('蜂鸣器上报结果:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('蜂鸣器上报失败:', e.message);
  }
  
  // 等待数据保存
  await sleep(500);
  
  // 测试3：查询执行器列表，检查feedback字段
  console.log('\n测试3：查询执行器列表，检查feedback字段');
  try {
    const result = await sendRequest('/api/actuators', 'GET');
    const fan = result.data.find(a => a.id === 'FN-FEEDBACK-001');
    const buzzer = result.data.find(a => a.id === 'BZ-FEEDBACK-001');
    
    if (fan) {
      console.log('\n风扇执行器数据:');
      console.log('  ID:', fan.id);
      console.log('  Name:', fan.name);
      console.log('  Feedback:', JSON.stringify(fan.feedback));
      if (fan.feedback && fan.feedback.direction === 'forward') {
        console.log('  ✅ 风扇回馈数据正确保存');
      } else {
        console.log('  ❌ 风扇回馈数据不正确');
      }
    } else {
      console.log('  ❌ 未找到风扇执行器');
    }
    
    if (buzzer) {
      console.log('\n蜂鸣器执行器数据:');
      console.log('  ID:', buzzer.id);
      console.log('  Name:', buzzer.name);
      console.log('  Feedback:', JSON.stringify(buzzer.feedback));
      if (buzzer.feedback && buzzer.feedback.pattern === 'alarm') {
        console.log('  ✅ 蜂鸣器回馈数据正确保存');
      } else {
        console.log('  ❌ 蜂鸣器回馈数据不正确');
      }
    } else {
      console.log('  ❌ 未找到蜂鸣器执行器');
    }
  } catch (e) {
    console.error('查询执行器失败:', e.message);
  }
  
  console.log('\n=== 测试完成 ===');
}

/**
 * 发送HTTP请求
 */
function sendRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 运行测试
test().catch(console.error);