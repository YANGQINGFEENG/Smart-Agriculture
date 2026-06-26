const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('smart_agriculture.db');

console.log('=== 清理旧数据 ===\n');

// 删除旧的测试传感器（T-001, H-001, L-001, S-001等）
db.run("DELETE FROM sensors WHERE id LIKE 'T-%' OR id LIKE 'H-%' OR id LIKE 'L-%' OR id LIKE 'S-%' OR id LIKE 'E-%' OR id LIKE 'P-%'", function(err) {
    if (err) console.error('删除旧传感器失败:', err);
    else console.log('删除旧传感器:', this.changes, '条');
});

// 删除模拟器创建的设备节点（MAC地址格式的node_id）
db.run("DELETE FROM device_nodes WHERE node_id LIKE '%:%'", function(err) {
    if (err) console.error('删除模拟器设备节点失败:', err);
    else console.log('删除模拟器设备节点:', this.changes, '条');
});

// 删除模拟器创建的网关
db.run("DELETE FROM gateways WHERE name LIKE '%自动发现%' OR name LIKE '%WiFi温湿度%'", function(err) {
    if (err) console.error('删除模拟器网关失败:', err);
    else console.log('删除模拟器网关:', this.changes, '条');
});

// 删除设备数据中的旧数据
db.run("DELETE FROM device_data WHERE gateway_id NOT IN (SELECT id FROM gateways)", function(err) {
    if (err) console.error('删除旧设备数据失败:', err);
    else console.log('删除旧设备数据:', this.changes, '条');
});

// 等待所有操作完成后显示结果
setTimeout(() => {
    console.log('\n=== 清理后数据 ===');
    
    let completed = 0;
    const total = 3;
    
    db.all('SELECT id, name, farm_id FROM sensors', (err, rows) => {
        console.log('传感器:', rows.length, '条');
        rows.forEach(r => console.log('  -', r.id, r.name));
        completed++;
        if (completed === total) db.close();
    });
    
    db.all('SELECT id, name FROM gateways', (err, rows) => {
        console.log('网关:', rows.length, '条');
        rows.forEach(r => console.log('  -', r.id, r.name));
        completed++;
        if (completed === total) db.close();
    });
    
    db.all('SELECT id, node_id, name FROM device_nodes', (err, rows) => {
        console.log('设备节点:', rows.length, '条');
        rows.forEach(r => console.log('  -', r.node_id, r.name));
        completed++;
        if (completed === total) db.close();
    });
}, 1000);
