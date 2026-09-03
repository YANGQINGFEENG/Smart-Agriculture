const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('smart_agriculture.db');

console.log('=== 深度清理 ===\n');

// 删除所有DN-开头的传感器（模拟器创建的）
db.run("DELETE FROM sensors WHERE id LIKE 'DN-%'", function(err) {
    if (err) console.error(err);
    else console.log('删除DN传感器:', this.changes, '条');
});

// 删除无效的设备节点
db.run("DELETE FROM device_nodes WHERE node_id = '5' OR length(node_id) < 3", function(err) {
    if (err) console.error(err);
    else console.log('删除无效节点:', this.changes, '条');
});

// 清空设备数据
db.run("DELETE FROM device_data", function(err) {
    if (err) console.error(err);
    else console.log('清空设备数据:', this.changes, '条');
});

setTimeout(() => {
    console.log('\n--- 清理后统计 ---');
    let done = 0;
    const check = () => { done++; if (done === 4) db.close(); };
    
    db.get('SELECT COUNT(*) as c FROM sensors', (e, r) => { console.log('传感器:', r.c); check(); });
    db.get('SELECT COUNT(*) as c FROM device_nodes', (e, r) => { console.log('设备节点:', r.c); check(); });
    db.get('SELECT COUNT(*) as c FROM gateways', (e, r) => { console.log('网关:', r.c); check(); });
    db.get('SELECT COUNT(*) as c FROM device_data', (e, r) => { console.log('设备数据:', r.c); check(); });
}, 500);
