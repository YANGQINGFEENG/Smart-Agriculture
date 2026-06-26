const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('smart_agriculture.db');

console.log('=== 修复传感器/执行器的farm_id ===\n');

// 1. 获取默认基地ID
db.get('SELECT id FROM farms ORDER BY id LIMIT 1', (err, farm) => {
    if (err || !farm) {
        console.error('未找到基地数据，请先创建基地');
        db.close();
        return;
    }

    const defaultFarmId = farm.id;
    console.log('默认基地ID:', defaultFarmId);

    // 2. 更新传感器表的farm_id
    db.run('UPDATE sensors SET farm_id = ? WHERE farm_id IS NULL', [defaultFarmId], function(err) {
        if (err) {
            console.error('更新传感器farm_id失败:', err);
        } else {
            console.log('更新传感器farm_id:', this.changes, '条');
        }

        // 3. 更新执行器表的farm_id
        db.run('UPDATE actuators SET farm_id = ? WHERE farm_id IS NULL', [defaultFarmId], function(err) {
            if (err) {
                console.error('更新执行器farm_id失败:', err);
            } else {
                console.log('更新执行器farm_id:', this.changes, '条');
            }

            // 4. 验证结果
            console.log('\n=== 验证结果 ===');
            
            let completed = 0;
            const checks = [
                ['sensors with farm_id', 'SELECT COUNT(*) as count FROM sensors WHERE farm_id IS NOT NULL'],
                ['sensors without farm_id', 'SELECT COUNT(*) as count FROM sensors WHERE farm_id IS NULL'],
                ['actuators with farm_id', 'SELECT COUNT(*) as count FROM actuators WHERE farm_id IS NOT NULL'],
                ['actuators without farm_id', 'SELECT COUNT(*) as count FROM actuators WHERE farm_id IS NULL'],
            ];

            checks.forEach(([name, sql]) => {
                db.get(sql, (err, row) => {
                    console.log(name + ':', row ? row.count : 0);
                    completed++;
                    if (completed === checks.length) {
                        console.log('\n=== 修复完成 ===');
                        db.close();
                    }
                });
            });
        });
    });
});
