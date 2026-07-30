// 直接调用API检查返回的执行器数据
const http = require('http');

http.get('http://localhost:3000/api/actuators', (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('API返回的执行器列表:');
            json.data.forEach(actuator => {
                console.log(`ID: ${actuator.id}, Name: ${actuator.name}, Area: "${actuator.area}", Type: ${actuator.type}`);
            });
            
            // 检查是否包含LS-3-T001
            const laserActuator = json.data.find(a => a.id === 'LS-3-T001');
            if (laserActuator) {
                console.log('\n找到激光控制器:');
                console.log(JSON.stringify(laserActuator, null, 2));
            } else {
                console.log('\n未找到LS-3-T001!');
            }
        } catch (e) {
            console.error('解析JSON失败:', e.message);
            console.log('原始数据:', data.substring(0, 500));
        }
    });
}).on('error', (e) => {
    console.error('请求失败:', e.message);
});