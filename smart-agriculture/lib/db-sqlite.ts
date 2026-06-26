// 数据库连接模块 - 使用SQLite
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

let databaseInstance: Database | null = null;
let initPromise: Promise<Database> | null = null;

async function initDatabase() {
  if (databaseInstance) return databaseInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const db = await open({
        filename: process.env.SQLITE_DB_PATH || './smart_agriculture.db',
        driver: sqlite3.Database
      });
      databaseInstance = db;
      await createTables();
      console.log('SQLite数据库连接成功');
      return databaseInstance;
    } catch (error) {
      console.error('SQLite数据库连接失败:', error);
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

// 创建表结构
async function createTables() {
  if (!databaseInstance) throw new Error('数据库未初始化');
  
  // 传感器类型表
  await databaseInstance.exec(`
    CREATE TABLE IF NOT EXISTS sensor_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // 传感器设备表
  await databaseInstance.exec(`
    CREATE TABLE IF NOT EXISTS sensors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type_id INTEGER NOT NULL,
      location TEXT NOT NULL,
      status TEXT DEFAULT 'offline',
      battery INTEGER DEFAULT 100,
      last_update TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // 传感器数据表
  await databaseInstance.exec(`
    CREATE TABLE IF NOT EXISTS sensor_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_id TEXT NOT NULL,
      value REAL NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 执行器类型表
  await databaseInstance.exec(`
    CREATE TABLE IF NOT EXISTS actuator_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 执行器设备表
  await databaseInstance.exec(`
    CREATE TABLE IF NOT EXISTS actuators (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type_id INTEGER NOT NULL,
      location TEXT NOT NULL,
      status TEXT DEFAULT 'offline',
      state TEXT DEFAULT 'off',
      mode TEXT DEFAULT 'auto',
      last_update TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      locked INTEGER DEFAULT 0
    );
  `);

  // 执行器状态历史表
  await databaseInstance.exec(`
    CREATE TABLE IF NOT EXISTS actuator_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actuator_id TEXT NOT NULL,
      state TEXT NOT NULL,
      mode TEXT NOT NULL,
      trigger_source TEXT DEFAULT 'user',
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 执行器控制指令表
  await databaseInstance.exec(`
    CREATE TABLE IF NOT EXISTS actuator_commands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actuator_id TEXT NOT NULL,
      command TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      executed_at TIMESTAMP NULL
    );
  `);

  // 为指令表添加 executing 状态的检查约束（SQLite 使用 CHECK）
  // 注意：SQLite 的 CHECK 约束在建表时定义，此处通过 status 字段的 TEXT 类型支持任意状态值

  // 自动化策略表
  await databaseInstance.exec(`
    CREATE TABLE IF NOT EXISTS strategies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      actuator_id TEXT NOT NULL,
      enabled INTEGER DEFAULT 0,
      trigger_condition TEXT NOT NULL,
      time_range TEXT,
      action TEXT NOT NULL,
      stop_condition TEXT,
      safety_config TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 策略执行日志表
  await databaseInstance.exec(`
    CREATE TABLE IF NOT EXISTS strategy_execution_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      strategy_id TEXT NOT NULL,
      actuator_id TEXT NOT NULL,
      execution_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      action TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      error_message TEXT
    );
  `);

  // 知识库表
  await databaseInstance.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_base (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      tags TEXT,
      source TEXT,
      status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      vector_index INTEGER
    );
  `);

  // 提示词模板表
  await databaseInstance.exec(`
    CREATE TABLE IF NOT EXISTS prompt_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      description TEXT,
      variables TEXT,
      version INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 模板变量表
  await databaseInstance.exec(`
    CREATE TABLE IF NOT EXISTS template_variables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      label TEXT NOT NULL,
      type TEXT NOT NULL,
      default_value TEXT,
      required INTEGER DEFAULT 1,
      FOREIGN KEY (template_id) REFERENCES prompt_templates(id) ON DELETE CASCADE
    );
  `);

  // 报警规则表
  await databaseInstance.exec(`
    CREATE TABLE IF NOT EXISTS alarm_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sensor_type TEXT NOT NULL,
      condition_type TEXT NOT NULL CHECK (condition_type IN ('above', 'below', 'equals', 'range')),
      min_value REAL,
      max_value REAL,
      severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
      enabled INTEGER DEFAULT 1,
      notify_email INTEGER DEFAULT 0,
      notify_sms INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 报警记录表
  await databaseInstance.exec(`
    CREATE TABLE IF NOT EXISTS alarm_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id INTEGER,
      sensor_id TEXT,
      sensor_type TEXT,
      alarm_type TEXT NOT NULL CHECK (alarm_type IN ('threshold', 'offline', 'low_battery', 'data_anomaly')),
      severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
      message TEXT NOT NULL,
      value REAL,
      threshold_info TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
      acknowledged_by TEXT,
      acknowledged_at TIMESTAMP,
      resolved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rule_id) REFERENCES alarm_rules(id) ON DELETE SET NULL
    );
  `);

  // 报警通知表
  await databaseInstance.exec(`
    CREATE TABLE IF NOT EXISTS alarm_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alarm_id INTEGER NOT NULL,
      channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'wechat', 'system')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
      sent_at TIMESTAMP,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (alarm_id) REFERENCES alarm_records(id) ON DELETE CASCADE
    );
  `);

  // 农场/基地表
  await databaseInstance.exec(`
    CREATE TABLE IF NOT EXISTS farms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      address TEXT,
      latitude REAL,
      longitude REAL,
      area REAL,
      farm_type TEXT DEFAULT 'mixed',
      owner_id INTEGER,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 区域表
  await databaseInstance.exec(`
    CREATE TABLE IF NOT EXISTS zones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      farm_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      zone_type TEXT DEFAULT 'greenhouse',
      area REAL,
      description TEXT,
      status TEXT DEFAULT 'active',
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );
  `);

  // 监控点表
  await databaseInstance.exec(`
    CREATE TABLE IF NOT EXISTS monitor_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      zone_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      point_type TEXT DEFAULT 'air_point',
      position_x REAL,
      position_y REAL,
      description TEXT,
      FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE
    );
  `);

  // 作物批次表
  await databaseInstance.exec(`
    CREATE TABLE IF NOT EXISTS crop_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      farm_id INTEGER NOT NULL,
      zone_id INTEGER NOT NULL,
      crop_type TEXT NOT NULL,
      variety TEXT,
      batch_code TEXT UNIQUE NOT NULL,
      planting_date DATE,
      expected_harvest_date DATE,
      actual_harvest_date DATE,
      area REAL,
      status TEXT DEFAULT 'growing',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
      FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE
    );
  `);

  // 设备模板表
  await databaseInstance.exec(`
    CREATE TABLE IF NOT EXISTS device_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      device_type TEXT NOT NULL,
      device_model TEXT,
      default_config TEXT,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 设备网关表
  await databaseInstance.exec(`
    CREATE TABLE IF NOT EXISTS gateways (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      farm_id INTEGER NOT NULL,
      zone_id INTEGER,
      name TEXT NOT NULL,
      gateway_type TEXT NOT NULL,
      ip_address TEXT,
      mac_address TEXT,
      protocol TEXT,
      status TEXT DEFAULT 'online',
      last_heartbeat TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );
  `);

  // 设备节点表
  await databaseInstance.exec(`
    CREATE TABLE IF NOT EXISTS device_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gateway_id INTEGER NOT NULL,
      node_id TEXT NOT NULL,
      name TEXT NOT NULL,
      node_type TEXT NOT NULL DEFAULT 'sensor',
      sensor_type TEXT,
      location TEXT,
      config TEXT,
      status TEXT DEFAULT 'online',
      last_update TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (gateway_id) REFERENCES gateways(id) ON DELETE CASCADE
    );
  `);

  // 设备数据表（统一存储所有设备上报的数据）
  await databaseInstance.exec(`
    CREATE TABLE IF NOT EXISTS device_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gateway_id INTEGER NOT NULL,
      node_id TEXT NOT NULL,
      sensor_type TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT,
      quality INTEGER DEFAULT 100,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (gateway_id) REFERENCES gateways(id) ON DELETE CASCADE
    );
  `);
  
  // 插入初始数据
  await insertInitialData();
}

// 插入初始数据
async function insertInitialData() {
  if (!databaseInstance) throw new Error('数据库未初始化');
  
  const sensorTypesCount = await databaseInstance.get<{ count: number }>('SELECT COUNT(*) as count FROM sensor_types');
  if (sensorTypesCount && sensorTypesCount.count === 0) {
    await databaseInstance.exec(`
      INSERT OR IGNORE INTO sensor_types (type, name, unit) VALUES ('temperature', '温度传感器', '°C');
      INSERT OR IGNORE INTO sensor_types (type, name, unit) VALUES ('humidity', '空气湿度传感器', '%');
      INSERT OR IGNORE INTO sensor_types (type, name, unit) VALUES ('soil', '土壤湿度传感器', '%');
      INSERT OR IGNORE INTO sensor_types (type, name, unit) VALUES ('soil_temperature', '土壤温度传感器', '°C');
      INSERT OR IGNORE INTO sensor_types (type, name, unit) VALUES ('light', '光照传感器', 'lux');
      INSERT OR IGNORE INTO sensor_types (type, name, unit) VALUES ('ph', 'pH传感器', 'pH');
      INSERT OR IGNORE INTO sensor_types (type, name, unit) VALUES ('co2', 'CO2传感器', 'ppm');
    `);
  }
  
  // 检查是否已有传感器数据
  const sensorsCount = await databaseInstance.get<{ count: number }>('SELECT COUNT(*) as count FROM sensors');
  if (sensorsCount && sensorsCount.count === 0) {
    // 插入传感器
    await databaseInstance.run(
      'INSERT INTO sensors (id, name, type_id, location, status, battery, last_update) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      ['T-001', 'A区温室1号温度传感器', 1, 'A区温室', 'online', 95]
    );
    await databaseInstance.run(
      'INSERT INTO sensors (id, name, type_id, location, status, battery, last_update) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      ['H-001', 'A区温室1号湿度传感器', 2, 'A区温室', 'online', 90]
    );
    await databaseInstance.run(
      'INSERT INTO sensors (id, name, type_id, location, status, battery, last_update) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      ['S-001', 'A区温室1号土壤湿度传感器', 3, 'A区温室', 'online', 91]
    );
  }
  
  // 检查是否已有传感器数据
  const sensorDataCount = await databaseInstance.get<{ count: number }>('SELECT COUNT(*) as count FROM sensor_data');
  if (sensorDataCount && sensorDataCount.count === 0) {
    // 生成24小时的模拟数据
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
      
      // 温度数据 (18-30°C)
      await databaseInstance.run(
        'INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES (?, ?, ?)',
        ['T-001', 18 + Math.random() * 12, timestamp]
      );
      
      // 空气湿度数据 (50-80%)
      await databaseInstance.run(
        'INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES (?, ?, ?)',
        ['H-001', 50 + Math.random() * 30, timestamp]
      );
      
      // 土壤湿度数据 (30-60%)
      await databaseInstance.run(
        'INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES (?, ?, ?)',
        ['S-001', 30 + Math.random() * 30, timestamp]
      );
    }
  }

  const actuatorTypesCount = await databaseInstance.get<{ count: number }>('SELECT COUNT(*) as count FROM actuator_types');
  if (actuatorTypesCount && actuatorTypesCount.count === 0) {
    await databaseInstance.exec(`
      INSERT OR IGNORE INTO actuator_types (type, name, description) VALUES ('water_pump', '水泵', '灌溉用水泵设备');
      INSERT OR IGNORE INTO actuator_types (type, name, description) VALUES ('fan', '风扇', '通风降温设备');
      INSERT OR IGNORE INTO actuator_types (type, name, description) VALUES ('light', '补光灯', '植物补光设备');
      INSERT OR IGNORE INTO actuator_types (type, name, description) VALUES ('valve', '电磁阀', '管路控制阀门');
    `);
  }

  // 检查是否已有执行器数据
  const actuatorsCount = await databaseInstance.get<{ count: number }>('SELECT COUNT(*) as count FROM actuators');
  if (actuatorsCount && actuatorsCount.count === 0) {
    // 插入执行器
    await databaseInstance.run(
      "INSERT INTO actuators (id, name, type_id, location, status, state, mode, last_update) VALUES (?, ?, ?, ?, 'online', 'off', 'auto', CURRENT_TIMESTAMP)",
      ['WP-001', 'A区温室1号水泵', 1, 'A区温室']
    );
    await databaseInstance.run(
      "INSERT INTO actuators (id, name, type_id, location, status, state, mode, last_update) VALUES (?, ?, ?, ?, 'online', 'off', 'auto', CURRENT_TIMESTAMP)",
      ['FN-001', 'A区温室1号风扇', 2, 'A区温室']
    );
    await databaseInstance.run(
      "INSERT INTO actuators (id, name, type_id, location, status, state, mode, last_update) VALUES (?, ?, ?, ?, 'offline', 'off', 'auto', CURRENT_TIMESTAMP)",
      ['LT-001', 'A区温室1号补光灯', 3, 'A区温室']
    );
    await databaseInstance.run(
      "INSERT INTO actuators (id, name, type_id, location, status, state, mode, last_update) VALUES (?, ?, ?, ?, 'online', 'off', 'auto', CURRENT_TIMESTAMP)",
      ['VL-001', 'A区温室1号电磁阀', 4, 'A区温室']
    );
  }

  // 插入初始提示词模板
  const promptCount = await databaseInstance.get<{ count: number }>('SELECT COUNT(*) as count FROM prompt_templates');
  if (promptCount && promptCount.count === 0) {
    await databaseInstance.run(
      `INSERT OR IGNORE INTO prompt_templates (name, type, content, description, variables, status) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        '农业AI助手-通用',
        'chat',
        '你是一个专业的智慧农业AI助手。你的职责是帮助用户解答农业相关问题，包括但不限于：作物种植、病虫害防治、土壤管理、环境监控、灌溉管理等。\n\n请基于以下知识库信息回答用户问题：\n{knowledge_context}\n\n用户问题：{user_query}',
        '通用农业AI助手提示词模板',
        JSON.stringify([
          {name: "knowledge_context", label: "知识库上下文", type: "string", required: true},
          {name: "user_query", label: "用户问题", type: "string", required: true}
        ]),
        'active'
      ]
    );
    await databaseInstance.run(
      `INSERT OR IGNORE INTO prompt_templates (name, type, content, description, variables, status) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        '农业AI助手-诊断',
        'diagnosis',
        '你是一个专业的农业病虫害诊断专家。请根据以下信息进行分析诊断：\n\n传感器数据：{sensor_data}\n图像检测结果：{detection_results}\n知识库参考：{knowledge_context}\n\n请提供：\n1. 问题诊断结果\n2. 可能的原因分析\n3. 建议的处理措施',
        '农业病虫害诊断提示词模板',
        JSON.stringify([
          {name: "sensor_data", label: "传感器数据", type: "string", required: true},
          {name: "detection_results", label: "检测结果", type: "string", required: false},
          {name: "knowledge_context", label: "知识库上下文", type: "string", required: true}
        ]),
        'active'
      ]
    );
  }
}

// 测试连接
async function testConnection() {
  try {
    await initDatabase();
    return true;
  } catch (error) {
    console.error('数据库连接测试失败:', error);
    return false;
  }
}

// 导出数据库连接对象
export const db = {
  query: async <T>(sql: string, params?: any[]) => {
    const database = await initDatabase();
    const results = await database.all<T>(sql, params);
    return results;
  },
  execute: async <T>(sql: string, params?: any[]) => {
    const database = await initDatabase();
    const result = await database.run(sql, params);
    return result;
  },
  executeWithRetry: async <T>(sql: string, params?: any[], maxRetries: number = 3): Promise<T> => {
    const database = await initDatabase();
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await database.run(sql, params);
        return result as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 200 * attempt));
        }
      }
    }
    throw lastError;
  },
  testConnection
};

// 导出类型
export type RowDataPacket = any;
export type ResultSetHeader = any;