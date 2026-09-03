// 检查执行器数据库
const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'Yjh@437507',
    database: 'smart_agriculture'
  });

  try {
    console.log('=== 执行器列表 ===\n');

    const [actuators] = await connection.query(`
      SELECT a.id, a.name, a.type_id, at.type as type_name, a.status, a.state, a.area
      FROM actuators a
      LEFT JOIN actuator_types at ON a.type_id = at.id
    `);

    console.log(`执行器总数: ${actuators.length}`);
    console.log('');
    
    actuators.forEach(act => {
      console.log(`${act.name} (${act.id})`);
      console.log(`  类型: ${act.type_name} (type_id: ${act.type_id})`);
      console.log(`  状态: ${act.status}, 开关: ${act.state}, 区域: ${act.area || '未分配'}`);
      console.log('');
    });

    // 检查actuator_types表
    console.log('\n=== 执行器类型表 ===\n');
    const [types] = await connection.query('SELECT * FROM actuator_types');
    types.forEach(t => {
      console.log(`${t.id}: ${t.type} (${t.name}) - 控制方式: ${t.control_type}, 范围: ${t.min_value}-${t.max_value}`);
    });

    // 检查是否有laser类型
    console.log('\n=== 检查laser相关数据 ===\n');
    const [laserTypes] = await connection.query("SELECT * FROM actuator_types WHERE type LIKE '%laser%' OR name LIKE '%激光%'");
    console.log(`laser类型数量: ${laserTypes.length}`);
    
    const [laserActuators] = await connection.query(`
      SELECT a.*, at.type as type_name 
      FROM actuators a 
      JOIN actuator_types at ON a.type_id = at.id 
      WHERE at.type LIKE '%laser%' OR at.name LIKE '%激光%'
    `);
    console.log(`laser执行器数量: ${laserActuators.length}`);
    
    if (laserActuators.length > 0) {
      laserActuators.forEach(a => {
        console.log(`  ${a.name} (${a.id}) - ${a.type_name}`);
      });
    }

    // 检查最近的控制命令
    console.log('\n=== 最近的控制命令 ===\n');
    const [commands] = await connection.query(`
      SELECT c.id, c.actuator_id, c.command, c.value, c.status, c.created_at
      FROM commands c
      ORDER BY c.created_at DESC
      LIMIT 10
    `);
    commands.forEach(cmd => {
      console.log(`${cmd.actuator_id}: ${cmd.command} ${cmd.value !== null ? '值=' + cmd.value : ''} - ${cmd.status} @ ${cmd.created_at}`);
    });

  } finally {
    await connection.end();
  }
}

main().catch(console.error);