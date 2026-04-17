// 测试数据库连接和传感器数据
const mysql = require('mysql2');

// 数据库连接配置
const connection = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'smart_agriculture'
});

// 连接数据库
connection.connect((err) => {
  if (err) {
    console.error('数据库连接失败:', err);
    return;
  }
  console.log('数据库连接成功!');
  
  // 检查传感器数据
  checkSensorData();
});

// 检查传感器数据
function checkSensorData() {
  console.log('\n=== 检查传感器数据 ===');
  
  // 检查温度传感器数据
  connection.query(
    'SELECT * FROM sensor_data WHERE sensor_id = ? ORDER BY timestamp DESC LIMIT 10',
    ['T-001'],
    (err, results) => {
      if (err) {
        console.error('查询温度数据失败:', err);
      } else {
        console.log('\n温度传感器 (T-001) 数据:');
        console.log(`找到 ${results.length} 条记录`);
        results.forEach(row => {
          console.log(`${row.timestamp}: ${row.value} °C`);
        });
      }
      
      // 检查空气湿度传感器数据
      connection.query(
        'SELECT * FROM sensor_data WHERE sensor_id = ? ORDER BY timestamp DESC LIMIT 10',
        ['H-001'],
        (err, results) => {
          if (err) {
            console.error('查询空气湿度数据失败:', err);
          } else {
            console.log('\n空气湿度传感器 (H-001) 数据:');
            console.log(`找到 ${results.length} 条记录`);
            results.forEach(row => {
              console.log(`${row.timestamp}: ${row.value} %`);
            });
          }
          
          // 检查土壤湿度传感器数据
          connection.query(
            'SELECT * FROM sensor_data WHERE sensor_id = ? ORDER BY timestamp DESC LIMIT 10',
            ['S-001'],
            (err, results) => {
              if (err) {
                console.error('查询土壤湿度数据失败:', err);
              } else {
                console.log('\n土壤湿度传感器 (S-001) 数据:');
                console.log(`找到 ${results.length} 条记录`);
                results.forEach(row => {
                  console.log(`${row.timestamp}: ${row.value} %`);
                });
              }
              
              // 关闭连接
              connection.end();
            }
          );
        }
      );
    }
  );
}
