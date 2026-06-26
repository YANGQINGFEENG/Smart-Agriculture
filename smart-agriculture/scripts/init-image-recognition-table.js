const mysql = require('mysql2/promise');

// 数据库连接配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'Yjh@437507', // 使用项目中常见的密码
  database: 'smart_agriculture'
};

async function initDatabase() {
  try {
    console.log('正在连接数据库...');
    
    // 先连接到MySQL服务器（不指定数据库）
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password
    });
    
    console.log('连接成功，正在创建数据库...');
    
    // 创建数据库
    await connection.query('CREATE DATABASE IF NOT EXISTS smart_agriculture');
    
    // 关闭连接
    await connection.end();
    
    console.log('数据库创建成功，正在连接到数据库...');
    
    // 重新连接到指定的数据库
    const dbConnection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      database: 'smart_agriculture'
    });
    
    console.log('连接成功，正在创建表结构...');
    
    // 创建图片识别历史记录表
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS image_recognition_history (
        id INT PRIMARY KEY AUTO_INCREMENT,
        image_url VARCHAR(255) NOT NULL,
        result VARCHAR(100) NOT NULL,
        confidence DECIMAL(5, 2) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_timestamp (timestamp)
      );
    `;
    
    await dbConnection.query(createTableSQL);
    
    console.log('表结构创建成功！');
    
    // 关闭连接
    await dbConnection.end();
    
    console.log('数据库初始化完成！');
    
  } catch (error) {
    console.error('数据库初始化失败:', error);
  }
}

// 执行初始化
initDatabase();
