// 检查数据库中激光控制器的area字段
const sqlite3 = require('sqlite3');
const path = require('path');

// 数据库在项目根目录
const dbPath = path.join(__dirname, '..', '..', 'smart_agriculture.db');
console.log('数据库路径:', dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('无法打开数据库:', err.message);
        process.exit(1);
    }
    
    db.all('SELECT id, name, area FROM actuators', (err, rows) => {
        if (err) {
            console.error('查询失败:', err.message);
            db.close();
            process.exit(1);
        }
        
        console.log('\n所有执行器的area字段:');
        rows.forEach(row => {
            console.log(`ID: ${row.id}, area: "${row.area}", area长度: ${row.area ? row.area.length : 0}`);
        });
        
        db.close();
    });
});