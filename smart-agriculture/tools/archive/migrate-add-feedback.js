// 更新数据库表结构，添加 feedback JSON 字段
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
    
    try {
        // 检查 feedback 列是否已存在
        const [columns] = await connection.query(
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'actuators' AND COLUMN_NAME = 'feedback'",
            [process.env.DB_NAME || 'smart_agriculture']
        );
        
        if (columns.length > 0) {
            console.log('feedback 列已存在，无需添加');
        } else {
            // 添加 feedback JSON 字段
            await connection.execute(`
                ALTER TABLE actuators 
                ADD COLUMN feedback JSON NULL COMMENT '设备回馈数据（方向、速度、蜂鸣模式等）' 
                AFTER control_default
            `);
            console.log('已添加 feedback JSON 字段到 actuators 表');
        }
        
        // 显示当前表结构
        const [tableInfo] = await connection.query('DESCRIBE actuators');
        console.log('\n当前 actuators 表结构:');
        tableInfo.forEach(col => {
            console.log(`  ${col.Field} - ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
        });
        
    } catch (error) {
        console.error('错误:', error.message);
    }
    
    await connection.end();
}

main().catch(console.error);