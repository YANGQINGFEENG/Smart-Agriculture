// 数据库连接模块 - 使用SQLite
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

let databaseInstance: Database | null = null;

// 初始化数据库连接
async function initDatabase() {
  if (!databaseInstance) {
    try {
      databaseInstance = await open({
        filename: './smart_agriculture.db',
        driver: sqlite3.Database
      });
      
      // 创建表结构
      await createTables();
      
      console.log('SQLite数据库连接成功');
    } catch (error) {
      console.error('SQLite数据库连接失败:', error);
      throw error;
    }
  }
  return databaseInstance;
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
  
  // 插入初始数据
  await insertInitialData();
}

// 插入初始数据
async function insertInitialData() {
  if (!databaseInstance) throw new Error('数据库未初始化');
  
  // 检查是否已有传感器类型数据
  const sensorTypesCount = await databaseInstance.get<{ count: number }>('SELECT COUNT(*) as count FROM sensor_types');
  if (sensorTypesCount && sensorTypesCount.count === 0) {
    // 插入传感器类型
    await databaseInstance.run(
      'INSERT INTO sensor_types (type, name, unit) VALUES (?, ?, ?)',
      ['temperature', '温度传感器', '°C']
    );
    await databaseInstance.run(
      'INSERT INTO sensor_types (type, name, unit) VALUES (?, ?, ?)',
      ['humidity', '空气湿度传感器', '%']
    );
    await databaseInstance.run(
      'INSERT INTO sensor_types (type, name, unit) VALUES (?, ?, ?)',
      ['soil', '土壤湿度传感器', '%']
    );
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

  // 检查是否已有执行器类型数据
  const actuatorTypesCount = await databaseInstance.get<{ count: number }>('SELECT COUNT(*) as count FROM actuator_types');
  if (actuatorTypesCount && actuatorTypesCount.count === 0) {
    // 插入执行器类型
    await databaseInstance.run(
      'INSERT INTO actuator_types (type, name, description) VALUES (?, ?, ?)',
      ['water_pump', '水泵', '灌溉用水泵设备']
    );
    await databaseInstance.run(
      'INSERT INTO actuator_types (type, name, description) VALUES (?, ?, ?)',
      ['fan', '风扇', '通风降温设备']
    );
    await databaseInstance.run(
      'INSERT INTO actuator_types (type, name, description) VALUES (?, ?, ?)',
      ['light', '补光灯', '植物补光设备']
    );
    await databaseInstance.run(
      'INSERT INTO actuator_types (type, name, description) VALUES (?, ?, ?)',
      ['valve', '电磁阀', '管路控制阀门']
    );
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
