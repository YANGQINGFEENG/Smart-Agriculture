// 清理测试数据
const http = require('http');

async function cleanup() {
  console.log('=== 清理测试数据 ===\n');
  
  // 查询所有执行器
  const actuators = await sendRequest('/api/actuators', 'GET');
  const testIds = ['FN-FEEDBACK-001', 'BZ-FEEDBACK-001'];
  
  for (const id of testIds) {
    const actuator = actuators.data.find(a => a.id === id);
    if (actuator) {
      console.log(`删除测试执行器: ${id} (${actuator.name})`);
      try {
        await sendRequest(`/api/actuators/${id}`, 'DELETE');
        console.log(`  ✅ 已删除`);
      } catch (e) {
        console.log(`  ❌ 删除失败: ${e.message}`);
      }
    }
  }
  
  console.log('\n=== 清理完成 ===');
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

cleanup().catch(console.error);