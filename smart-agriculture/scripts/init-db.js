// scripts/init-db.js
// 智慧农业平台 - 数据库初始化脚本

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.SQLITE_DB_PATH || './smart_agriculture.db';

async function initDatabase() {
  console.log('======================================');
  console.log('  智慧农业物联网平台 - 数据库初始化');
  console.log('======================================');
  console.log('');
  console.log(`数据库路径: ${path.resolve(DB_PATH)}`);
  console.log('');

  // 检查数据库是否已存在
  if (fs.existsSync(DB_PATH)) {
    console.log('⚠ 数据库文件已存在');
    console.log('  如需重新初始化，请先删除: ' + DB_PATH);
    console.log('');
    return;
  }

  try {
    const db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });

    console.log('正在创建数据库表...');

    // 创建传感器类型表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS sensor_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        unit TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✓ sensor_types');

    // 创建传感器表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS sensors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type_id INTEGER,
        location TEXT,
        status TEXT DEFAULT 'offline',
        battery INTEGER DEFAULT 100,
        farm_id INTEGER,
        zone_id INTEGER,
        last_update TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (type_id) REFERENCES sensor_types(id)
      )
    `);
    console.log('  ✓ sensors');

    // 创建传感器数据表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS sensor_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sensor_id TEXT NOT NULL,
        value REAL NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sensor_id) REFERENCES sensors(id)
      )
    `);
    console.log('  ✓ sensor_data');

    // 创建执行器类型表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS actuator_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✓ actuator_types');

    // 创建执行器表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS actuators (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type_id INTEGER,
        location TEXT,
        status TEXT DEFAULT 'offline',
        state TEXT DEFAULT 'off',
        mode TEXT DEFAULT 'auto',
        locked INTEGER DEFAULT 0,
        last_update TIMESTAMP,
        farm_id INTEGER,
        zone_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (type_id) REFERENCES actuator_types(id)
      )
    `);
    console.log('  ✓ actuators');

    // 创建执行器指令表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS actuator_commands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actuator_id TEXT NOT NULL,
        command TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        executed_at TIMESTAMP,
        FOREIGN KEY (actuator_id) REFERENCES actuators(id)
      )
    `);
    console.log('  ✓ actuator_commands');

    // 创建网关表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS gateways (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        farm_id INTEGER,
        name TEXT NOT NULL,
        gateway_type TEXT,
        ip_address TEXT,
        mac_address TEXT,
        status TEXT DEFAULT 'offline',
        last_heartbeat TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✓ gateways');

    // 创建设备节点表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS device_nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gateway_id INTEGER,
        node_id TEXT NOT NULL,
        name TEXT,
        node_type TEXT,
        sensor_type TEXT,
        location TEXT,
        status TEXT DEFAULT 'offline',
        last_update TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (gateway_id) REFERENCES gateways(id)
      )
    `);
    console.log('  ✓ device_nodes');

    // 创建设备数据表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS device_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gateway_id INTEGER,
        node_id TEXT NOT NULL,
        sensor_type TEXT,
        value REAL,
        unit TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (gateway_id) REFERENCES gateways(id)
      )
    `);
    console.log('  ✓ device_data');

    // 创建策略表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS strategies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        actuator_id TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        trigger_condition TEXT,
        time_range TEXT,
        action TEXT NOT NULL,
        stop_condition TEXT,
        safety_config TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (actuator_id) REFERENCES actuators(id)
      )
    `);
    console.log('  ✓ strategies');

    // 创建知识库表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT,
        tags TEXT,
        source TEXT,
        status TEXT DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✓ knowledge_base');

    // 创建提示词模板表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS prompt_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        description TEXT,
        category TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✓ prompt_templates');

    // 插入默认传感器类型
    await db.exec(`
      INSERT OR IGNORE INTO sensor_types (type, name, unit) VALUES
        ('temperature', '温度', '°C'),
        ('humidity', '湿度', '%'),
        ('light', '光照', 'Lux'),
        ('soil', '土壤湿度', '%'),
        ('soil_temperature', '土壤温度', '°C'),
        ('ec', '电导率', 'μS/cm'),
        ('ph', 'pH值', 'pH')
    `);
    console.log('  ✓ 默认传感器类型');

    // 插入默认执行器类型
    await db.exec(`
      INSERT OR IGNORE INTO actuator_types (type, name, description) VALUES
        ('water_pump', '水泵', '灌溉用水泵'),
        ('fan', '风扇', '通风用风扇'),
        ('heater', '加热器', '温室加热器'),
        ('valve', '电磁阀', '灌溉电磁阀'),
        ('light', '补光灯', '植物补光灯')
    `);
    console.log('  ✓ 默认执行器类型');

    await db.close();

    console.log('');
    console.log('======================================');
    console.log('✓ 数据库初始化完成');
    console.log('======================================');

  } catch (error) {
    console.error('✗ 数据库初始化失败:', error.message);
    process.exit(1);
  }
}

initDatabase();
