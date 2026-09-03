// 生成历史数据脚本 - 为所有传感器生成30天的历史数据
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

/**
 * 生成模拟传感器读数
 * @param {Date} timestamp 时间戳
 * @param {string} sensorType 传感器类型
 * @param {number} baseValue 基础值
 * @param {number} variance 波动范围
 */
function generateReading(timestamp, sensorType, baseValue, variance) {
  const hour = timestamp.getHours();
  const dayOfYear = Math.floor((timestamp - new Date(timestamp.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  
  // 昼夜变化因子: 正弦波模拟
  // 凌晨最低，下午最高
  const dayFactor = Math.sin(((hour - 6) / 24) * Math.PI * 2) * 0.3 + 1;
  
  let value = baseValue + (Math.random() - 0.5) * variance * 2;
  
  // 根据传感器类型添加特殊波动
  switch (sensorType) {
    case 'temperature':
      // 温度: 昼夜变化明显，夏季高冬季低
      const seasonalFactor = Math.sin((dayOfYear / 365) * Math.PI * 2) * 0.2 + 1;
      value = baseValue * dayFactor * seasonalFactor + (Math.random() - 0.5) * variance;
      break;
    case 'humidity':
      // 湿度: 夜间高，白天低；雨季高旱季低
      value = baseValue * (2 - dayFactor) + (Math.random() - 0.5) * variance;
      break;
    case 'light':
      // 光照: 只有白天有值，中午最高
      value = hour >= 6 && hour <= 18 
        ? baseValue * Math.sin(((hour - 6) / 12) * Math.PI) + (Math.random() - 0.5) * variance
        : Math.random() * 10;
      break;
    case 'soil':
      // 土壤湿度: 缓慢变化，雨天高
      const rainFactor = Math.sin((dayOfYear / 30) * Math.PI) * 0.2 + 1;
      value = baseValue * rainFactor + (Math.random() - 0.5) * variance * 0.5;
      break;
    case 'pressure':
      // 气压: 缓慢变化
      value = baseValue + Math.sin((dayOfYear / 365) * Math.PI * 2) * 5 + (Math.random() - 0.5) * variance;
      break;
    case 'vibration':
      // 振动: 随机为主
      value = baseValue + (Math.random() - 0.5) * variance * 2;
      break;
    case 'altitude':
      // 海拔: 基本稳定
      value = baseValue + (Math.random() - 0.5) * variance * 0.1;
      break;
    default:
      value = baseValue + (Math.random() - 0.5) * variance;
  }
  
  // 确保值不为负数（除了温度可以为负）
  if (sensorType !== 'temperature' && value < 0) {
    value = 0;
  }
  
  return Math.round(value * 100) / 100;
}

/**
 * 格式化时间为数据库格式
 */
function formatTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 主函数
 */
async function main() {
  const dbPath = path.join(__dirname, '..', 'smart_agriculture.db');
  
  try {
    console.log('正在连接数据库...');
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    
    // 获取所有传感器（关联类型信息）
    const sensors = await db.all(`
      SELECT s.id, s.name, s.type_id, st.type as sensor_type, st.unit
      FROM sensors s
      LEFT JOIN sensor_types st ON s.type_id = st.id
    `);
    console.log(`找到 ${sensors.length} 个传感器`);
    
    // 定义每种传感器类型的基础值和波动范围
    const sensorConfigs = {
      'temperature': { base: 25, variance: 5 },      // 温度
      'humidity': { base: 60, variance: 15 },         // 湿度
      'soil': { base: 45, variance: 10 },             // 土壤湿度
      'soil_temperature': { base: 22, variance: 3 },  // 土壤温度
      'light': { base: 5000, variance: 2000 },        // 光照
      'ph': { base: 6.5, variance: 0.5 },             // pH值
      'co2': { base: 400, variance: 100 },           // CO2
      'soil_moisture': { base: 45, variance: 10 },    // 土壤湿度
      'pressure': { base: 1013, variance: 5 },       // 气压
      'vibration': { base: 2.5, variance: 1.0 },     // 振动
      'altitude': { base: 50, variance: 2 },          // 海拔
    };
    
    // 清空旧数据
    console.log('\n清空旧数据...');
    await db.run('DELETE FROM sensor_data');
    console.log('已清空 sensor_data 表');
    
    // 30天的数据，每30分钟一个点
    const daysToGenerate = 30;
    const pointsPerDay = 48; // 24小时 * 2 (每30分钟)
    const totalPoints = daysToGenerate * pointsPerDay;
    
    console.log(`\n将为每个传感器生成 ${totalPoints} 个数据点（${daysToGenerate}天，每30分钟）`);
    
    const now = new Date();
    const startTime = new Date(now.getTime() - daysToGenerate * 24 * 60 * 60 * 1000);
    
    let totalInserted = 0;
    
    for (const sensor of sensors) {
      const sensorId = sensor.id;
      const sensorType = sensor.sensor_type || 'unknown';
      const config = sensorConfigs[sensorType] || { base: 50, variance: 10 };
      
      console.log(`\n正在为 ${sensorId} (${sensorType}) 生成数据...`);
      
      let count = 0;
      const batchSize = 500;
      const insertSql = 'INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES (?, ?, ?)';
      
      for (let i = 0; i < totalPoints; i += batchSize) {
        await db.run('BEGIN TRANSACTION');
        try {
          for (let j = i; j < Math.min(i + batchSize, totalPoints); j++) {
            const timestamp = new Date(startTime.getTime() + j * 30 * 60 * 1000); // 每30分钟
            const value = generateReading(timestamp, sensorType, config.base, config.variance);
            await db.run(insertSql, [sensorId, value, formatTime(timestamp)]);
            count++;
          }
          await db.run('COMMIT');
        } catch (e) {
          await db.run('ROLLBACK');
          throw e;
        }
        
        if (count % (pointsPerDay * 5) === 0 || i + batchSize >= totalPoints) {
          console.log(`  已生成 ${count}/${totalPoints} 个点`);
        }
      }
      
      totalInserted += count;
      console.log(`  ✓ ${sensorId}: ${count} 个数据点`);
      
      // 更新传感器的last_update
      const lastTimestamp = formatTime(new Date(now.getTime() - 30 * 60 * 1000));
      await db.run(
        'UPDATE sensors SET last_update = ? WHERE id = ?',
        [lastTimestamp, sensorId]
      );
    }
    
    console.log(`\n✅ 完成！共插入 ${totalInserted} 条数据`);
    
    // 验证数据
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total,
        MIN(timestamp) as min_time,
        MAX(timestamp) as max_time
      FROM sensor_data
    `);
    console.log(`\n数据库统计:`);
    console.log(`  总记录数: ${stats.total}`);
    console.log(`  时间范围: ${stats.min_time} ~ ${stats.max_time}`);
    
    await db.close();
  } catch (error) {
    console.error('生成数据失败:', error.message);
    console.error(error.stack);
  }
}

main();
