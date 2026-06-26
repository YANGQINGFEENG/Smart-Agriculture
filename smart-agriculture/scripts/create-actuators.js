const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('smart_agriculture.db');

console.log('=== 创建执行器数据 ===\n');

// 获取基地列表
db.all('SELECT id, name, code FROM farms', (err, farms) => {
    if (err) { console.error(err); return; }
    
    console.log('可用基地:');
    farms.forEach(f => console.log('  ' + f.id + '. ' + f.name));
    
    // 获取执行器类型
    db.all('SELECT id, type FROM actuator_types', (err, types) => {
        if (err) { console.error(err); return; }
        
        const typeMap = {};
        types.forEach(t => typeMap[t.type] = t.id);
        
        // 为每个基地创建执行器
        let totalCreated = 0;
        
        farms.forEach(farm => {
            const actuators = [
                { name: farm.name + '-水泵1', type: 'water_pump', state: 'off', mode: 'auto' },
                { name: farm.name + '-风扇1', type: 'fan', state: 'off', mode: 'auto' },
                { name: farm.name + '-补光灯1', type: 'light', state: 'off', mode: 'auto' },
            ];
            
            actuators.forEach(act => {
                const typeId = typeMap[act.type];
                if (!typeId) return;
                
                db.run(
                    'INSERT INTO actuators (id, name, type_id, location, status, state, mode, farm_id, last_update) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
                    [
                        'ACT-' + farm.id + '-' + (totalCreated + 1).toString().padStart(3, '0'),
                        act.name,
                        typeId,
                        farm.name,
                        'online',
                        act.state,
                        act.mode,
                        farm.id
                    ],
                    function(err) {
                        if (!err) {
                            console.log('创建执行器: ' + act.name + ' (基地: ' + farm.name + ')');
                            totalCreated++;
                        }
                    }
                );
            });
        });
        
        setTimeout(() => {
            console.log('\n共创建 ' + totalCreated + ' 个执行器');
            db.close();
        }, 1000);
    });
});
