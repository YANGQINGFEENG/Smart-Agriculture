/**
 * 独立WebSocket服务器
 * 与Next.js开发服务器并行运行，避免热重载导致的连接丢失问题
 * 
 * 使用方式：
 * node websocket-server.js
 */

const WebSocket = require('ws');
const mysql = require('mysql2/promise');

// WebSocket服务器实例
let wss = null;

// 连接映射
const deviceConnections = new Map();
const actuatorConnections = new Map();
const gatewayConnections = new Map();
const areaConnections = new Map();

// 消息类型枚举
const WebSocketMessageType = {
  HEARTBEAT: 'heartbeat',
  HEARTBEAT_ACK: 'heartbeat_ack',
  WELCOME: 'welcome',
  SENSOR_DATA: 'sensor_data',
  ACTUATOR_STATUS: 'actuator_status',
  COMMAND: 'command',
  COMMAND_ACK: 'command_ack',
  COMMAND_STATUS: 'command_status',
  DEVICE_REGISTER: 'device_register',
  GATEWAY_REGISTER: 'gateway_register',
  DATA_REPORT: 'data_report',
  STATUS_UPDATE: 'status_update',
  AREA_UPDATE: 'area_update',
  ERROR: 'error',
  AREA_SYNC: 'area_sync',
};

// 创建数据库连接池
let db = null;

async function initDatabase() {
  try {
    // 在函数内部获取环境变量，确保已加载
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'smart_agriculture',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    };
    
    console.log('[DB] 数据库配置:', { host: dbConfig.host, user: dbConfig.user, database: dbConfig.database, password: dbConfig.password ? '***' : '空' });
    
    db = mysql.createPool(dbConfig);
    // 测试连接
    const [rows] = await db.query('SELECT 1');
    console.log('[DB] 数据库连接成功');
  } catch (error) {
    console.error('[DB] 数据库连接失败:', error.message);
    console.log('[DB] 尝试使用SQLite作为后备...');
    // 如果MySQL连接失败，尝试SQLite（需要安装sqlite3）
    try {
      const sqlite3 = require('sqlite3').verbose();
      const sqlite = require('sqlite');
      db = await sqlite.open({
        filename: './database.sqlite',
        driver: sqlite3.Database,
      });
      console.log('[DB] SQLite连接成功');
    } catch (sqliteError) {
      console.error('[DB] SQLite连接也失败:', sqliteError.message);
      process.exit(1);
    }
  }
}

/**
 * 初始化WebSocket服务器
 */
function initWebSocketServer() {
  wss = new WebSocket.Server({ port: 8080 });
  
  wss.on('connection', (ws, req) => {
    // 解析查询参数
    const url = new URL(req.url || '', 'http://localhost');
    const deviceId = url.searchParams.get('device_id');
    const actuatorId = url.searchParams.get('actuator_id');
    const gatewayIp = url.searchParams.get('gateway_ip');
    const area = url.searchParams.get('area');
    
    // 记录连接信息
    const connectionId = deviceId || actuatorId || gatewayIp || area || 'unknown';
    
    // 注册连接到区域
    if (area) {
      let wsSet = areaConnections.get(area);
      if (!wsSet) {
        wsSet = new Set();
        areaConnections.set(area, wsSet);
      }
      wsSet.add(ws);
      console.log(`[WS] Area connection registered: ${area}`);
    }
    
    if (deviceId) {
      deviceConnections.set(deviceId, ws);
      console.log(`[WS] Device connected: ${deviceId}`);
      
      ws.send(JSON.stringify({
        type: WebSocketMessageType.WELCOME,
        message: 'Device connected successfully',
        device_id: deviceId,
      }));
    } else if (actuatorId) {
      actuatorConnections.set(actuatorId, ws);
      console.log(`[WS] Actuator connected: ${actuatorId}`);
      
      ws.send(JSON.stringify({
        type: WebSocketMessageType.WELCOME,
        message: 'Actuator connected successfully',
        actuator_id: actuatorId,
      }));
    } else if (gatewayIp) {
      gatewayConnections.set(gatewayIp, ws);
      
      const gatewayArea = `区域-${gatewayIp}`;
      let wsSet = areaConnections.get(gatewayArea);
      if (!wsSet) {
        wsSet = new Set();
        areaConnections.set(gatewayArea, wsSet);
      }
      wsSet.add(ws);
      
      console.log(`[WS] Gateway connected: ${gatewayIp}, Area: ${gatewayArea}`);
      
      ws.send(JSON.stringify({
        type: WebSocketMessageType.WELCOME,
        message: 'Gateway connected successfully',
        gateway_ip: gatewayIp,
        area: gatewayArea,
      }));
    } else {
      // 前端浏览器连接（没有查询参数）
      console.log(`[WS] Browser client connected: ${connectionId}`);
      
      ws.send(JSON.stringify({
        type: WebSocketMessageType.WELCOME,
        message: 'Browser client connected successfully',
        connection_id: connectionId,
      }));
    }
    
    // 处理消息
    ws.on('message', (message) => {
      handleWebSocketMessage(ws, message.toString(), deviceId, actuatorId, gatewayIp, area);
    });
    
    // 处理连接关闭
    ws.on('close', () => {
      if (deviceId) {
        deviceConnections.delete(deviceId);
        console.log(`[WS] Device disconnected: ${deviceId}`);
      } else if (actuatorId) {
        actuatorConnections.delete(actuatorId);
        console.log(`[WS] Actuator disconnected: ${actuatorId}`);
      } else if (gatewayIp) {
        gatewayConnections.delete(gatewayIp);
        const gatewayArea = `区域-${gatewayIp}`;
        const wsSet = areaConnections.get(gatewayArea);
        if (wsSet) {
          wsSet.delete(ws);
          if (wsSet.size === 0) {
            areaConnections.delete(gatewayArea);
          }
        }
        console.log(`[WS] Gateway disconnected: ${gatewayIp}`);
      }
      
      if (area) {
        const wsSet = areaConnections.get(area);
        if (wsSet) {
          wsSet.delete(ws);
          if (wsSet.size === 0) {
            areaConnections.delete(area);
          }
        }
      }
    });
    
    // 处理错误
    ws.on('error', (error) => {
      console.error(`[WS] Error for ${connectionId}:`, error);
    });
  });
  
  console.log('[WS] Server started on port 8080');
}

/**
 * 处理WebSocket消息
 */
async function handleWebSocketMessage(ws, message, deviceId, actuatorId, gatewayIp, area) {
  try {
    const data = JSON.parse(message);
    
    switch (data.type) {
      case WebSocketMessageType.HEARTBEAT:
        handleHeartbeat(ws);
        break;
      case WebSocketMessageType.DEVICE_REGISTER:
        await handleDeviceRegister(data);
        break;
      case WebSocketMessageType.GATEWAY_REGISTER:
        await handleGatewayRegister(data);
        break;
      case WebSocketMessageType.SENSOR_DATA:
        if (gatewayIp) {
          await handleSensorData(gatewayIp, data.data);
        }
        break;
      case WebSocketMessageType.ACTUATOR_STATUS:
        if (gatewayIp) {
          await handleActuatorStatus(gatewayIp, data.data);
        }
        break;
      case WebSocketMessageType.DATA_REPORT:
        if (gatewayIp) {
          await handleDataReport(gatewayIp, data.data);
        }
        break;
      case WebSocketMessageType.COMMAND_ACK:
        if (actuatorId && data.command_id) {
          await handleCommandAck(actuatorId, data.command_id, data.status, data.control_value);
        } else if (gatewayIp && data.command_id) {
          await handleCommandAck(data.actuator_id || '', data.command_id, data.status, data.control_value);
        }
        break;
      case WebSocketMessageType.AREA_SYNC:
        if (area) {
          await handleAreaSync(ws, area);
        }
        break;
      default:
        console.log('[WS] Unknown message type:', data.type);
    }
  } catch (error) {
    console.error('[WS] Message handling error:', error);
    ws.send(JSON.stringify({
      type: WebSocketMessageType.ERROR,
      message: 'Invalid message format',
    }));
  }
}

/**
 * 处理心跳
 */
function handleHeartbeat(ws) {
  ws.send(JSON.stringify({
    type: WebSocketMessageType.HEARTBEAT_ACK,
    timestamp: Date.now(),
  }));
}

/**
 * 处理设备注册
 */
async function handleDeviceRegister(data) {
  try {
    const { device_id, type, name, location, area } = data;
    console.log(`[WS] Device registered: ${device_id}, type: ${type}`);
    
    if (!db) return;
    
    await db.execute(
      `INSERT INTO device_nodes (node_id, name, node_type, sensor_type, location, area, status)
       VALUES (?, ?, ?, ?, ?, ?, 'online')
       ON DUPLICATE KEY UPDATE name = VALUES(name), sensor_type = VALUES(sensor_type), 
       location = VALUES(location), area = VALUES(area), status = 'online'`,
      [device_id, name || device_id, type === 'actuator' ? 'actuator' : 'sensor', type, location || '', area || '']
    );
  } catch (error) {
    console.error('[WS] Device register error:', error);
  }
}

/**
 * 处理网关注册
 */
async function handleGatewayRegister(data) {
  try {
    const { gateway_ip, gateway_type, mac, farm_id, area } = data;
    console.log(`[WS] Gateway registered: ${gateway_ip}`);
    
    if (!db) return;
    
    const [existingGateways] = await db.query('SELECT id FROM gateways WHERE ip_address = ?', [gateway_ip]);
    const defaultArea = area || `区域-${gateway_ip}`;
    
    if (existingGateways.length === 0) {
      await db.execute(
        `INSERT INTO gateways (farm_id, name, gateway_type, ip_address, mac_address, status, area)
         VALUES (?, ?, ?, ?, ?, 'online', ?)`,
        [farm_id || 0, `WS-${gateway_ip}`, gateway_type || 'ws_gateway', gateway_ip, mac || null, defaultArea]
      );
    } else {
      await db.execute(
        'UPDATE gateways SET status = ?, last_heartbeat = ?, area = ? WHERE ip_address = ?',
        ['online', new Date().toISOString().replace('T', ' ').slice(0, 19), defaultArea, gateway_ip]
      );
    }
  } catch (error) {
    console.error('[WS] Gateway register error:', error);
  }
}

/**
 * 处理传感器数据
 */
async function handleSensorData(gatewayIp, sensorData) {
  try {
    console.log(`[WS] Sensor data from gateway ${gatewayIp}:`, sensorData);
    
    if (!db) return;
    
    const [gateways] = await db.query('SELECT id, farm_id FROM gateways WHERE ip_address = ?', [gatewayIp]);
    if (gateways.length === 0) {
      console.warn(`[WS] Gateway not found for IP: ${gatewayIp}`);
      return;
    }
    
    const gatewayId = gateways[0].id;
    const farmId = gateways[0].farm_id;
    const area = `区域-${gatewayIp}`;
    
    for (const sensor of sensorData) {
      if (sensor.value !== undefined && sensor.type && sensor.node_id) {
        // 生成设备ID
        const deviceId = `${sensor.type}-${gatewayId}-${sensor.node_id}`;
        
        // 检查传感器类型是否存在
        let [sensorTypes] = await db.query('SELECT id FROM sensor_types WHERE type = ?', [sensor.type]);
        
        if (sensorTypes.length === 0) {
          await db.execute(
            'INSERT INTO sensor_types (type, name, unit) VALUES (?, ?, ?)',
            [sensor.type, sensor.type, sensor.unit || '']
          );
          [sensorTypes] = await db.query('SELECT id FROM sensor_types WHERE type = ?', [sensor.type]);
        }
        
        // 检查传感器是否存在
        let [sensors] = await db.query('SELECT id FROM sensors WHERE id = ?', [deviceId]);
        
        if (sensors.length === 0) {
          await db.execute(
            `INSERT INTO sensors (id, name, type_id, location, status, battery, area)
             VALUES (?, ?, ?, ?, 'online', 100, ?)`,
            [deviceId, sensor.name || deviceId, sensorTypes[0].id, sensor.location || sensor.node_id, area]
          );
        }
        
        // 更新传感器状态
        await db.execute(
          'UPDATE sensors SET status = ?, last_update = ?, area = ? WHERE id = ?',
          ['online', new Date().toISOString().replace('T', ' ').slice(0, 19), area, deviceId]
        );
        
        // 插入传感器数据
        await db.execute(
          'INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES (?, ?, ?)',
          [deviceId, sensor.value, new Date().toISOString().replace('T', ' ').slice(0, 19)]
        );
      }
    }
  } catch (error) {
    console.error('[WS] Sensor data handling error:', error);
  }
}

/**
 * 处理执行器状态
 */
async function handleActuatorStatus(gatewayIp, actuatorData) {
  try {
    console.log(`[WS] Actuator status from gateway ${gatewayIp}:`, actuatorData);
    
    if (!db) return;
    
    const [gateways] = await db.query('SELECT id, farm_id FROM gateways WHERE ip_address = ?', [gatewayIp]);
    if (gateways.length === 0) {
      console.warn(`[WS] Gateway not found for IP: ${gatewayIp}`);
      return;
    }
    
    const gatewayId = gateways[0].id;
    const farmId = gateways[0].farm_id;
    const area = `区域-${gatewayIp}`;
    
    for (const actuator of actuatorData) {
      if (actuator.type && actuator.node_id) {
        const deviceId = `${actuator.type}-${gatewayId}-${actuator.node_id}`;
        
        let [actuatorTypes] = await db.query('SELECT id FROM actuator_types WHERE type = ?', [actuator.type]);
        
        if (actuatorTypes.length === 0) {
          await db.execute(
            'INSERT INTO actuator_types (type, name, description) VALUES (?, ?, ?)',
            [actuator.type, actuator.type, actuator.description || '']
          );
          [actuatorTypes] = await db.query('SELECT id FROM actuator_types WHERE type = ?', [actuator.type]);
        }
        
        let [actuators] = await db.query('SELECT id FROM actuators WHERE id = ?', [deviceId]);
        
        if (actuators.length === 0) {
          await db.execute(
            `INSERT INTO actuators (id, name, type_id, location, status, state, mode, farm_id, area)
             VALUES (?, ?, ?, ?, 'online', ?, ?, ?, ?)`,
            [deviceId, actuator.name || deviceId, actuatorTypes[0].id, actuator.location || actuator.node_id, 
             actuator.state || 'off', actuator.mode || 'auto', farmId, area]
          );
        }
        
        // 更新执行器状态
        await db.execute(
          'UPDATE actuators SET status = ?, state = ?, mode = ?, last_update = ?, area = ? WHERE id = ?',
          ['online', actuator.state || 'off', actuator.mode || 'auto', 
           new Date().toISOString().replace('T', ' ').slice(0, 19), area, deviceId]
        );
      }
    }
  } catch (error) {
    console.error('[WS] Actuator status handling error:', error);
  }
}

/**
 * 处理数据上报
 */
async function handleDataReport(gatewayIp, reportData) {
  try {
    console.log(`[WS] Data report from gateway ${gatewayIp}:`, reportData);
    
    if (!db) return;
    
    const [gateways] = await db.query('SELECT id, farm_id FROM gateways WHERE ip_address = ?', [gatewayIp]);
    if (gateways.length === 0) {
      console.warn(`[WS] Gateway not found for IP: ${gatewayIp}`);
      return;
    }
    
    const gatewayId = gateways[0].id;
    const farmId = gateways[0].farm_id;
    const defaultArea = reportData.area || `区域-${gatewayIp}`;
    
    await db.execute(
      'UPDATE gateways SET area = ? WHERE ip_address = ?',
      [defaultArea, gatewayIp]
    );
    
    if (reportData.nodes && Array.isArray(reportData.nodes)) {
      for (const node of reportData.nodes) {
        if (!node.type || !node.node_id) continue;
        
        const deviceId = `${node.type}-${gatewayId}-${node.node_id}`;
        const deviceArea = node.area || defaultArea;
        
        // 判断是传感器还是执行器
        const isSensor = node.value !== undefined;
        const isActuator = node.state !== undefined;
        
        if (isSensor) {
          let [sensorTypes] = await db.query('SELECT id FROM sensor_types WHERE type = ?', [node.type]);
          
          if (sensorTypes.length === 0) {
            await db.execute(
              'INSERT INTO sensor_types (type, name, unit) VALUES (?, ?, ?)',
              [node.type, node.type, node.unit || '']
            );
            [sensorTypes] = await db.query('SELECT id FROM sensor_types WHERE type = ?', [node.type]);
          }
          
          let [sensors] = await db.query('SELECT id FROM sensors WHERE id = ?', [deviceId]);
          
          if (sensors.length === 0) {
            await db.execute(
              `INSERT INTO sensors (id, name, type_id, location, status, battery, area)
               VALUES (?, ?, ?, ?, 'online', 100, ?)`,
              [deviceId, node.name || deviceId, sensorTypes[0].id, node.location || node.node_id, deviceArea]
            );
          }
          
          await db.execute(
            'UPDATE sensors SET status = ?, last_update = ?, area = ? WHERE id = ?',
            ['online', new Date().toISOString().replace('T', ' ').slice(0, 19), deviceArea, deviceId]
          );
          
          await db.execute(
            'INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES (?, ?, ?)',
            [deviceId, node.value || 0, new Date().toISOString().replace('T', ' ').slice(0, 19)]
          );
        } else if (isActuator) {
          let [actuatorTypes] = await db.query('SELECT id FROM actuator_types WHERE type = ?', [node.type]);
          
          if (actuatorTypes.length === 0) {
            await db.execute(
              'INSERT INTO actuator_types (type, name, description) VALUES (?, ?, ?)',
              [node.type, node.type, node.description || '']
            );
            [actuatorTypes] = await db.query('SELECT id FROM actuator_types WHERE type = ?', [node.type]);
          }
          
          let [actuators] = await db.query('SELECT id FROM actuators WHERE id = ?', [deviceId]);
          
          if (actuators.length === 0) {
            await db.execute(
              `INSERT INTO actuators (id, name, type_id, location, status, state, mode, farm_id, area)
               VALUES (?, ?, ?, ?, 'online', ?, ?, ?, ?)`,
              [deviceId, node.name || deviceId, actuatorTypes[0].id, node.location || node.node_id, 
               node.state || 'off', node.mode || 'auto', farmId, deviceArea]
            );
          }
          
          await db.execute(
            'UPDATE actuators SET status = ?, state = ?, mode = ?, last_update = ?, area = ? WHERE id = ?',
            ['online', node.state || 'off', node.mode || 'auto', 
             new Date().toISOString().replace('T', ' ').slice(0, 19), deviceArea, deviceId]
          );
        }
      }
    }
  } catch (error) {
    console.error('[WS] Data report handling error:', error);
  }
}

/**
 * 处理命令确认
 */
async function handleCommandAck(actuatorId, commandId, status, controlValue) {
  try {
    console.log(`[WS] Command ack - Actuator: ${actuatorId}, Command ID: ${commandId}, Status: ${status}`);
    
    if (!db || !actuatorId) return;
    
    const [existingCommands] = await db.query(
      'SELECT id, command, control_value FROM actuator_commands WHERE id = ? AND actuator_id = ?',
      [commandId, actuatorId]
    );
    
    if (existingCommands.length === 0) {
      console.warn(`[WS] Command not found: ${commandId} for actuator ${actuatorId}`);
      return;
    }
    
    const command = existingCommands[0];
    
    // 更新命令状态
    await db.execute(
      `UPDATE actuator_commands 
       SET status = ?, executed_at = ? 
       WHERE id = ? AND actuator_id = ?`,
      [status, new Date().toISOString().replace('T', ' ').slice(0, 19), commandId, actuatorId]
    );
    
    // 如果指令执行成功，更新执行器状态
    if (status === 'executed') {
      const newState = command.command === 'value' && (command.control_value || controlValue) > 0 ? 'on' : (command.command === 'on' ? 'on' : 'off');
      
      await db.execute(
        'UPDATE actuators SET state = ?, control_value = ?, last_update = ?, locked = 0 WHERE id = ?',
        [newState, controlValue || command.control_value || null, 
         new Date().toISOString().replace('T', ' ').slice(0, 19), actuatorId]
      );
      
      console.log(`[WS] Actuator ${actuatorId} updated - state: ${newState}`);
    } else {
      await db.execute('UPDATE actuators SET locked = 0 WHERE id = ?', [actuatorId]);
    }
    
    // 通知前端命令状态
    notifyCommandStatus(actuatorId, commandId, status, controlValue);
  } catch (error) {
    console.error('[WS] Command ack handling error:', error);
  }
}

/**
 * 通知前端命令状态
 */
function notifyCommandStatus(actuatorId, commandId, status, controlValue) {
  const statusMessage = {
    type: WebSocketMessageType.COMMAND_STATUS,
    data: {
      actuator_id: actuatorId,
      command_id: commandId,
      status: status,
      control_value: controlValue,
      timestamp: Date.now(),
    },
  };
  
  // 通过执行器连接发送
  const actuatorWs = actuatorConnections.get(actuatorId);
  if (actuatorWs && actuatorWs.readyState === WebSocket.OPEN) {
    actuatorWs.send(JSON.stringify(statusMessage));
    console.log(`[WS] Command status sent to actuator client: ${actuatorId}`);
  }
  
  // 通过区域连接广播
  if (db) {
    db.query('SELECT area FROM actuators WHERE id = ?', [actuatorId])
      .then(([results]) => {
        if (results.length > 0 && results[0].area) {
          const areaWsSet = areaConnections.get(results[0].area);
          if (areaWsSet && areaWsSet.size > 0) {
            areaWsSet.forEach((conn) => {
              if (conn.readyState === WebSocket.OPEN) {
                conn.send(JSON.stringify(statusMessage));
              }
            });
            console.log(`[WS] Command status broadcast to area: ${results[0].area}`);
          }
        }
      })
      .catch((error) => {
        console.error('[WS] Error querying actuator area:', error);
      });
  }
}

/**
 * 处理区域同步请求
 */
async function handleAreaSync(ws, area) {
  try {
    console.log(`[WS] Area sync request for: ${area}`);
    
    if (!db) {
      ws.send(JSON.stringify({
        type: WebSocketMessageType.ERROR,
        message: 'Database not available',
      }));
      return;
    }
    
    const [sensors] = await db.query('SELECT * FROM sensors WHERE area = ? AND status = "online"', [area]);
    const [actuators] = await db.query('SELECT * FROM actuators WHERE area = ? AND status = "online"', [area]);
    
    ws.send(JSON.stringify({
      type: WebSocketMessageType.AREA_SYNC,
      data: {
        area,
        sensors: sensors.length,
        actuators: actuators.length,
        sensor_list: sensors,
        actuator_list: actuators,
      },
    }));
  } catch (error) {
    console.error('[WS] Area sync error:', error);
    ws.send(JSON.stringify({
      type: WebSocketMessageType.ERROR,
      message: 'Area sync failed',
    }));
  }
}

/**
 * 主函数
 */
async function main() {
  // 加载环境变量（优先加载.env.local）
  try {
    require('dotenv').config({ path: './.env.local' });
  } catch (e) {
    // 如果.env.local不存在，尝试.env
    try {
      require('dotenv').config();
    } catch (e2) {
      // 忽略dotenv加载失败
    }
  }
  
  // 初始化数据库
  await initDatabase();
  
  // 初始化WebSocket服务器
  initWebSocketServer();
  
  console.log('[WS] 独立WebSocket服务器启动完成');
}

// 启动服务器
main().catch((error) => {
  console.error('[WS] 启动失败:', error);
  process.exit(1);
});

// 处理进程退出
process.on('SIGINT', () => {
  console.log('[WS] 正在关闭服务器...');
  if (wss) {
    wss.close(() => {
      console.log('[WS] 服务器已关闭');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});
