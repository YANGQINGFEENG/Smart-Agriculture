// 修复执行器问题
// 1. 修复蜂鸣器类型（从unknown_actuator改为buzzer）
// 2. 检查区域分组问题

const http = require('http');

async function fixIssues() {
  console.log('=== 修复执行器问题 ===\n');
  
  // 1. 查询所有执行器
  const result = await sendRequest('/api/actuators', 'GET');
  console.log(`执行器总数: ${result.data.length}`);
  
  // 2. 找到蜂鸣器并修复类型
  const buzzer = result.data.find(a => a.id === 'BZ-1-001');
  if (buzzer && buzzer.type === 'unknown_actuator') {
    console.log(`\n修复蜂鸣器类型:`);
    console.log(`  当前: ${buzzer.type}`);
    console.log(`  目标: buzzer`);
    
    // 更新蜂鸣器类型
    const updateResult = await sendRequest(`/api/actuators/${buzzer.id}`, 'PUT', {
      type_id: null,  // 让系统根据type重新分配
      type: 'buzzer'
    });
    console.log(`  更新结果:`, JSON.stringify(updateResult));
  }
  
  // 3. 显示所有执行器的区域和状态
  console.log('\n=== 执行器区域分组 ===');
  const byArea = {};
  for (const act of result.data) {
    const area = act.area || '未分组';
    if (!byArea[area]) byArea[area] = [];
    byArea[area].push(act);
  }
  
  for (const [area, actuators] of Object.entries(byArea)) {
    console.log(`\n区域: ${area}`);
    for (const act of actuators) {
      const lastUpdate = act.last_update ? new Date(act.last_update) : null;
      const diffMin = lastUpdate ? Math.floor((Date.now() - lastUpdate.getTime()) / 60000) : null;
      console.log(`  ${act.id}: ${act.name} [${act.type}] - ${act.status} - ${diffMin ? diffMin + '分钟前' : '无更新'}`);
    }
  }
  
  console.log('\n=== 修复完成 ===');
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

fixIssues().catch(console.error);