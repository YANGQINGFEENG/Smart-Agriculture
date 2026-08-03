/**
 * 摄像头命令下发测试脚本
 * 1. 确认/创建 camera 执行器 CAM-1-001
 * 2. 测试 6 种 camera 命令下发（on/off/value/track/color/reset）
 * 3. 验证命令入库和 actuator_commands 表结构
 *
 * 运行: node tools/test-camera-commands.js
 */
const mysql = require('mysql2/promise');
const http = require('http');

// 加载环境变量
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length > 0 && !key.startsWith('#')) {
      process.env[key.trim()] = rest.join('=').trim();
    }
  });
}

const ACTUATOR_ID = 'CAM-1-001';
const API_HOST = 'localhost';
const API_PORT = 3000;

/** 发送 POST 请求到 Next.js API */
function postApi(apiPath, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        hostname: API_HOST,
        port: API_PORT,
        path: apiPath,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        timeout: 10000,
      },
      (res) => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, body: data }); }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('=== 摄像头命令下发测试 ===\n');

  // 1. 连接数据库，确认 camera 类型并创建执行器
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  // 检查并迁移 actuator_commands 表 command 字段（ENUM -> VARCHAR）
  const [cols] = await conn.execute("SHOW COLUMNS FROM actuator_commands LIKE 'command'");
  if (cols.length > 0) {
    console.log(`[表结构] command 字段类型: ${cols[0].Type}`);
    if (cols[0].Type.includes('enum')) {
      console.log('[迁移] command 字段是 ENUM，迁移为 VARCHAR(20) ...');
      await conn.execute("ALTER TABLE actuator_commands MODIFY COLUMN command VARCHAR(20) NOT NULL;");
      console.log('[迁移] command 字段迁移完成');
    }
  }
  // 检查 status 字段是否包含 executing/timeout
  const [statusCols] = await conn.execute("SHOW COLUMNS FROM actuator_commands LIKE 'status'");
  if (statusCols.length > 0 && statusCols[0].Type.includes('enum')) {
    if (!statusCols[0].Type.includes('executing') || !statusCols[0].Type.includes('timeout')) {
      console.log('[迁移] status 字段扩展为含 executing/timeout ...');
      await conn.execute(
        "ALTER TABLE actuator_commands MODIFY COLUMN status ENUM('pending','executing','executed','failed','timeout') DEFAULT 'pending';"
      );
      console.log('[迁移] status 字段迁移完成');
    }
  }

  // 查询 camera 类型
  const [types] = await conn.execute("SELECT id, type, name FROM actuator_types WHERE type = 'camera'");
  let typeId;
  if (types.length === 0) {
    console.log('[类型] camera 类型不存在，创建中...');
    const [ins] = await conn.execute(
      "INSERT INTO actuator_types (type, name, description) VALUES ('camera', '摄像头', '云台摄像头，支持视频流、云台控制和颜色追踪')"
    );
    typeId = ins.insertId;
    console.log(`[类型] 已创建 camera 类型, id=${typeId}`);
  } else {
    typeId = types[0].id;
    console.log(`[类型] camera 类型已存在, id=${typeId}`);
  }

  // 检查/创建 CAM-1-001 执行器
  const [existing] = await conn.execute('SELECT id, state, locked FROM actuators WHERE id = ?', [ACTUATOR_ID]);
  if (existing.length === 0) {
    await conn.execute(
      `INSERT INTO actuators (id, name, type_id, location, area, status, state, mode, farm_id, locked)
       VALUES (?, '颜色追踪摄像头', ?, '温室入口', '温室1号区域', 'online', 'off', 'manual', 1, 0)`,
      [ACTUATOR_ID, typeId]
    );
    console.log(`[执行器] 已创建 ${ACTUATOR_ID}`);
  } else {
    console.log(`[执行器] ${ACTUATOR_ID} 已存在, state=${existing[0].state}, locked=${existing[0].locked}`);
    // 确保未锁定
    await conn.execute('UPDATE actuators SET locked = 0 WHERE id = ?', [ACTUATOR_ID]);
  }
  await conn.end();

  // 2. 测试 6 种 camera 命令
  const testCases = [
    { name: '开启摄像头', body: { control_type: 'camera', command: 'on' } },
    { name: '关闭摄像头', body: { control_type: 'camera', command: 'off' } },
    { name: '设置云台绝对角度', body: { control_type: 'camera', command: 'value', pan: 90, tilt: 90 } },
    { name: '云台增量移动', body: { control_type: 'camera', command: 'value', pan_delta: 10, tilt_delta: -5 } },
    { name: '开启追踪', body: { control_type: 'camera', command: 'track', value: 'on' } },
    { name: '关闭追踪', body: { control_type: 'camera', command: 'track', value: 'off' } },
    { name: '切换红色追踪', body: { control_type: 'camera', command: 'color', color: 'red' } },
    { name: '切换蓝色追踪', body: { control_type: 'camera', command: 'color', color: 'blue' } },
    { name: '云台复位', body: { control_type: 'camera', command: 'reset' } },
  ];

  console.log('\n--- 命令下发测试 ---');
  const results = [];
  for (const tc of testCases) {
    try {
      // 每次测试前确保未锁定
      const conn2 = await mysql.createConnection({
        host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
      });
      await conn2.execute('UPDATE actuators SET locked = 0 WHERE id = ?', [ACTUATOR_ID]);
      await conn2.end();

      const res = await postApi(`/api/actuators/${ACTUATOR_ID}/commands`, tc.body);
      const ok = res.body && res.body.success;
      const cmdId = ok ? res.body.data.id : '-';
      const wsPushed = ok ? res.body.data.ws_pushed : '-';
      console.log(`[${ok ? 'OK' : 'FAIL'}] ${tc.name} -> status=${res.status}, cmdId=${cmdId}, ws_pushed=${wsPushed}`);
      if (!ok) console.log(`       错误: ${JSON.stringify(res.body)}`);
      results.push({ name: tc.name, ok, cmdId, wsPushed });
    } catch (e) {
      console.log(`[ERR] ${tc.name} -> ${e.message}`);
      results.push({ name: tc.name, ok: false, error: e.message });
    }
  }

  // 3. 验证命令入库
  console.log('\n--- 入库验证 ---');
  const conn3 = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  const [cmds] = await conn3.execute(
    `SELECT id, command, control_value, command_data, status FROM actuator_commands
     WHERE actuator_id = ? ORDER BY created_at DESC LIMIT 12`,
    [ACTUATOR_ID]
  );
  console.log(`数据库中 ${ACTUATOR_ID} 的最近命令记录 (${cmds.length} 条):`);
  cmds.forEach(c => {
    console.log(`  id=${c.id}, command=${c.command}, control_value=${c.control_value}, status=${c.status}, command_data=${c.command_data}`);
  });
  await conn3.end();

  // 4. 汇总
  const okCount = results.filter(r => r.ok).length;
  console.log(`\n=== 测试完成: ${okCount}/${results.length} 通过 ===`);
}

main().catch(e => { console.error('测试失败:', e); process.exit(1); });
