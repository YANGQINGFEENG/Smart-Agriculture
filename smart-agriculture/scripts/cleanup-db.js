const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('smart_agriculture.db');

console.log('=== 清理数据库无用数据 ===\n');

// 保留核心数据，清理测试数据
const cleanups = [
    // 清理旧的传感器数据（保留farm_id=1的数据）
    'DELETE FROM sensor_data WHERE sensor_id NOT IN (SELECT id FROM sensors WHERE farm_id = 1)',
    
    // 清理旧的执行器状态历史
    'DELETE FROM actuator_status_history WHERE actuator_id NOT IN (SELECT id FROM actuators WHERE farm_id = 1)',
    
    // 清理旧的执行器命令
    'DELETE FROM actuator_commands WHERE actuator_id NOT IN (SELECT id FROM actuators WHERE farm_id = 1)',
    
    // 清理报警记录（保留最近7天的）
    "DELETE FROM alarm_records WHERE created_at < datetime('now', '-7 days')",
    
    // 清理报警通知
    'DELETE FROM alarm_notifications WHERE alarm_id NOT IN (SELECT id FROM alarm_records)',
    
    // 清理设备数据（保留最近24小时的）
    "DELETE FROM device_data WHERE timestamp < datetime('now', '-1 day')",
    
    // 清理策略执行日志
    'DELETE FROM strategy_execution_logs',
    
    // 清理传感器数据中不存在的传感器
    'DELETE FROM sensor_data WHERE sensor_id NOT IN (SELECT id FROM sensors)',
    
    // 清理执行器状态历史中不存在的执行器
    'DELETE FROM actuator_status_history WHERE actuator_id NOT IN (SELECT id FROM actuators)',
];

let completed = 0;
cleanups.forEach((sql, index) => {
    db.run(sql, function(err) {
        if (err) {
            console.log(`清理任务${index + 1}失败:`, err.message);
        } else {
            console.log(`清理任务${index + 1}完成: 删除${this.changes}条`);
        }
        completed++;
        if (completed === cleanups.length) {
            showStats();
        }
    });
});

function showStats() {
    console.log('\n=== 清理后数据统计 ===');
    
    const stats = [
        ['farms', 'SELECT COUNT(*) as count FROM farms'],
        ['zones', 'SELECT COUNT(*) as count FROM zones'],
        ['sensors', 'SELECT COUNT(*) as count FROM sensors'],
        ['sensor_data', 'SELECT COUNT(*) as count FROM sensor_data'],
        ['actuators', 'SELECT COUNT(*) as count FROM actuators'],
        ['gateways', 'SELECT COUNT(*) as count FROM gateways'],
        ['device_nodes', 'SELECT COUNT(*) as count FROM device_nodes'],
        ['alarm_records', 'SELECT COUNT(*) as count FROM alarm_records'],
    ];
    
    let completed = 0;
    stats.forEach(([name, sql]) => {
        db.get(sql, (err, row) => {
            console.log(`${name}: ${row ? row.count : 0} 条`);
            completed++;
            if (completed === stats.length) {
                console.log('\n=== 清理完成 ===');
                db.close();
            }
        });
    });
}
