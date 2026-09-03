// 使用MySQL查询数据库中激光控制器的area字段
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
    
    const [rows] = await connection.query('SELECT id, name, area, HEX(area) as area_hex FROM actuators');
    
    console.log('所有执行器的area字段:');
    rows.forEach(row => {
        console.log(`ID: ${row.id}`);
        console.log(`  name: ${row.name}`);
        console.log(`  area: "${row.area}"`);
        console.log(`  area_hex: ${row.area_hex}`);
        console.log('');
    });
    
    await connection.end();
}

main().catch(console.error);