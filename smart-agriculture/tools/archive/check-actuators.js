// 检查执行器状态
const http = require('http');

async function checkActuators() {
  console.log('=== 检查执行器状态 ===\n');
  
  try {
    const result = await sendRequest('/api/actuators', 'GET');
    
    console.log(`执行器总数: ${result.data.length}\n`);
    
    // 按区域分组
    const byArea = {};
    for (const actuator of result.data) {
      const area = actuator.area || '未分组';
      if (!byArea[area]) {
        byArea[area] = [];
      }
      byArea[area].push(actuator);
    }
    
    // 显示每个区域的执行器
    for (const [area, actuators] of Object.entries(byArea)) {
      console.log(`\n区域: ${area}`);
      console.log('---');
      
      for (const act of actuators) {
        const lastUpdate = act.last_update ? new Date(act.last_update) : null;
        const diffMinutes = lastUpdate ? Math.floor((Date.now() - lastUpdate.getTime()) / 60000) : null;
        const isOnline = act.status === 'online' && diffMinutes !== null && diffMinutes <= 5;
        
        console.log(`  ID: ${act.id}`);
        console.log(`  名称: ${act.name}`);
        console.log(`  类型: ${act.type} (${act.type_name})`);
        console.log(`  状态: ${act.status}`);
        console.log(`  在线判断: ${isOnline ? '✅ 在线' : '❌ 离线'}`);
        console.log(`  最后更新: ${act.last_update || '无'}`);
        if (diffMinutes !== null) {
          console.log(`  距现在: ${diffMinutes}分钟`);
        }
        console.log(`  控制值: ${act.control_value}`);
        console.log(`  模式: ${act.mode}`);
        console.log('');
      }
    }
    
    // 统计
    const onlineCount = result.data.filter(a => {
      const lastUpdate = a.last_update ? new Date(a.last_update) : null;
      const diffMinutes = lastUpdate ? Math.floor((Date.now() - lastUpdate.getTime()) / 60000) : null;
      return a.status === 'online' && diffMinutes !== null && diffMinutes <= 5;
    }).length;
    
    console.log(`\n在线执行器: ${onlineCount}/${result.data.length}`);
    
  } catch (e) {
    console.error('查询失败:', e.message);
  }
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

checkActuators().catch(console.error);