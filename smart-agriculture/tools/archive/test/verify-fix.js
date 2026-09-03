// 验证修复结果
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
    
    console.log('验证所有执行器数据:\n');
    
    const [rows] = await connection.query('SELECT id, name, area, status FROM actuators ORDER BY id');
    
    rows.forEach(row => {
        console.log(`ID: ${row.id}, Name: ${row.name}, Area: "${row.area}", Status: ${row.status}`);
    });
    
    await connection.end();
}

main().catch(console.error);