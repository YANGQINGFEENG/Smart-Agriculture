const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('smart_agriculture.db');

console.log('=== 创建默认策略 ===\n');

// 获取执行器列表
db.all('SELECT id, name, type_id FROM actuators', (err, actuators) => {
    if (err || actuators.length === 0) {
        console.log('未找到执行器，请先创建执行器');
        db.close();
        return;
    }

    console.log('可用执行器:');
    actuators.forEach(a => console.log('  ' + a.id + ': ' + a.name));

    // 为每个执行器创建策略
    let created = 0;
    actuators.forEach(actuator => {
        const strategies = [
            {
                name: actuator.name + '-开启',
                actuator_id: actuator.id,
                action: 'on',
                trigger_condition: JSON.stringify({ type: 'manual' }),
                safety_config: JSON.stringify({ max_duration: 3600 }),
            },
            {
                name: actuator.name + '-关闭',
                actuator_id: actuator.id,
                action: 'off',
                trigger_condition: JSON.stringify({ type: 'manual' }),
                safety_config: JSON.stringify({ max_duration: 0 }),
            },
        ];

        strategies.forEach(strategy => {
            db.run(
                'INSERT INTO strategies (id, name, actuator_id, enabled, trigger_condition, action, safety_config) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    'STR-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                    strategy.name,
                    strategy.actuator_id,
                    1,
                    strategy.trigger_condition,
                    strategy.action,
                    strategy.safety_config,
                ],
                function(err) {
                    if (!err) {
                        console.log('创建策略: ' + strategy.name + ' (' + strategy.actuator_id + ' ' + strategy.action + ')');
                        created++;
                    }
                    if (created === actuators.length * 2) {
                        console.log('\n共创建 ' + created + ' 个策略');
                        db.close();
                    }
                }
            );
        });
    });
});
