// 检查传感器数据
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Yjh@437507',
    database: 'smart_agriculture'
  });

  // 查询传感器最新数据
  const [rows] = await conn.query(`
    SELECT s.id, s.name, st.type as sensor_type, st.unit,
           (SELECT sd.value FROM sensor_data sd WHERE sd.sensor_id = s.id ORDER BY sd.timestamp DESC LIMIT 1) as last_value,
           (SELECT sd.timestamp FROM sensor_data sd WHERE sd.sensor_id = s.id ORDER BY sd.timestamp DESC LIMIT 1) as last_time
    FROM sensors s
    INNER JOIN sensor_types st ON s.type_id = st.id
    WHERE s.id IN ('H-1-001', 'T-1-002', 'PR-1-001', 'AL-1-001', 'T-1-001')
    ORDER BY s.id
  `);
  console.table(rows);

  // 也检查 device_data 表中的最新数据
  const [rows2] = await conn.query(`
    SELECT node_id, sensor_type, value, unit, timestamp
    FROM device_data
    WHERE node_id IN ('H-1-001', 'T-1-002', 'PR-1-001', 'AL-1-001', 'T-1-001')
    ORDER BY timestamp DESC
    LIMIT 20
  `);
  console.log('\ndevice_data 表最新记录:');
  console.table(rows2);

  await conn.end();
})().catch(e => console.error(e));
