// 修复数据库中激光控制器的area字段
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function main() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'smart_agriculture'
    });
    
    console.log('MySQL连接成功\n');
    
    // 修复损坏的area字段
    const [result] = await connection.execute(
        "UPDATE actuators SET area = '温室1号区域' WHERE id = 'LS-3-T001'"
    );
    
    console.log(`更新成功，影响行数: ${result.affectedRows}`);
    
    // 验证修复结果
    const [rows] = await connection.query('SELECT id, name, area FROM actuators WHERE id = ?', ['LS-3-T001']);
    console.log('\n修复后的数据:');
    console.log(JSON.stringify(rows, null, 2));
    
    await connection.end();
}

main().catch(console.error);