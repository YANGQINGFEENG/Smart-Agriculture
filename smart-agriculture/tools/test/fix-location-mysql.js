// 修复数据库中激光控制器的location字段
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
    
    // 检查当前location字段的值
    const [rows] = await connection.query('SELECT id, name, location, HEX(location) as location_hex FROM actuators WHERE id = ?', ['LS-3-T001']);
    console.log('修复前的数据:');
    console.log(JSON.stringify(rows, null, 2));
    
    // 修复location字段
    const [result] = await connection.execute(
        "UPDATE actuators SET location = ? WHERE id = ?",
        ['激光器-测试', 'LS-3-T001']
    );
    console.log(`\n更新成功，影响行数: ${result.affectedRows}`);
    
    // 验证修复结果
    const [fixedRows] = await connection.query('SELECT id, name, location FROM actuators WHERE id = ?', ['LS-3-T001']);
    console.log('\n修复后的数据:');
    console.log(JSON.stringify(fixedRows, null, 2));
    
    await connection.end();
}

main().catch(console.error);