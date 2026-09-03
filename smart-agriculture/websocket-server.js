/**
 * 独立WebSocket服务器
 * 与Next.js开发服务器并行运行，避免热重载导致的连接丢失问题
 * 
 * 使用方式：
 * node websocket-server.js
 */

const WebSocket = require('ws');
const { createLogger } = require('./lib/logger');
const log = createLogger('WS');
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
  MODEL_SWITCH: 'model_switch',
  MODEL_STATUS: 'model_status',
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
    
    log.info('数据库配置:', { host: dbConfig.host, user: dbConfig.user, database: dbConfig.database, password: dbConfig.password ? '***' : '空' });
    
    db = mysql.createPool(dbConfig);
    // 测试连接
    const [rows] = await db.query('SELECT 1');
    log.info('数据库连接成功');
  } catch (error) {
    log.error('数据库连接失败:', error.message);
    log.info('尝试使用SQLite作为后备...');
    // 如果MySQL连接失败，尝试SQLite（需要安装sqlite3）
    try {
      const sqlite3 = require('sqlite3').verbose();
      const sqlite = require('sqlite');
      db = await sqlite.open({
        filename: './database.sqlite',
        driver: sqlite3.Database,
      });
      log.info('SQLite连接成功');
    } catch (sqliteError) {
      log.error('SQLite连接也失败:', sqliteError.message);
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
      log.info(`Area connection registered: ${area}`);
    }
    
    if (deviceId) {
      deviceConnections.set(deviceId, ws);
      log.info(`Device connected: ${deviceId}`);
      
      ws.send(JSON.stringify({
        type: WebSocketMessageType.WELCOME,
        message: 'Device connected successfully',
        device_id: deviceId,
      }));
    } else if (actuatorId) {
      actuatorConnections.set(actuatorId, ws);
      log.info(`Actuator connected: ${actuatorId}`);
      
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
      
      log.info(`Gateway connected: ${gatewayIp}, Area: ${gatewayArea}`);
      
      ws.send(JSON.stringify({
        type: WebSocketMessageType.WELCOME,
        message: 'Gateway connected successfully',
        gateway_ip: gatewayIp,
        area: gatewayArea,
      }));
    } else {
      // 前端浏览器连接（没有查询参数）
      log.info(`Browser client connected: ${connectionId}`);
      
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
        log.info(`Device disconnected: ${deviceId}`);
      } else if (actuatorId) {
        actuatorConnections.delete(actuatorId);
        log.info(`Actuator disconnected: ${actuatorId}`);
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
        log.info(`Gateway disconnected: ${gatewayIp}`);
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
      log.error(`Error for ${connectionId}:`, error);
    });
  });
  
  log.info('Server started on port 8080');
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
        // 如果硬件端未传 gateway_ip，使用连接上下文中的 IP 作为回退
        await handleGatewayRegister(data, gatewayIp);
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
          await handleCommandAck(actuatorId, data.command_id, data.status, data.control_value, data.state);
        } else if (gatewayIp && data.command_id) {
          await handleCommandAck(data.actuator_id || '', data.command_id, data.status, data.control_value, data.state);
        }
        break;
      case WebSocketMessageType.AREA_SYNC:
        if (area) {
          await handleAreaSync(ws, area);
        }
        break;
      case WebSocketMessageType.MODEL_STATUS:
        // 树莓派上报识别模型状态/切换回执
        await handleModelStatus(gatewayIp, data.data || {});
        break;
      default:
        log.info('Unknown message type:', data.type);
    }
  } catch (error) {
    log.error('Message handling error:', error);
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
    log.info(`Device registered: ${device_id}, type: ${type}`);
    
    if (!db) return;
    
    await db.execute(
      `INSERT INTO device_nodes (node_id, name, node_type, sensor_type, location, area, status)
       VALUES (?, ?, ?, ?, ?, ?, 'online')
       ON DUPLICATE KEY UPDATE name = VALUES(name), sensor_type = VALUES(sensor_type), 
       location = VALUES(location), area = VALUES(area), status = 'online'`,
      [device_id, name || device_id, type === 'actuator' ? 'actuator' : 'sensor', type, location || '', area || '']
    );
  } catch (error) {
    log.error('Device register error:', error);
  }
}

/**
 * 处理网关注册
 */
async function handleGatewayRegister(data, connectionGatewayIp) {
  try {
    // 优先使用消息中的 gateway_ip，回退到连接上下文中的 IP
    const { gateway_type, mac, farm_id, area } = data;
    const gateway_ip = data.gateway_ip || connectionGatewayIp || 'unknown';
    log.info(`Gateway registered: ${gateway_ip}`);
    
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
    log.error('Gateway register error:', error);
  }
}

/**
 * 处理传感器数据
 */
async function handleSensorData(gatewayIp, sensorData) {
  try {
    log.debug('Sensor data from gateway %s: %d items', gatewayIp, sensorData.length);
    
    if (!db) return;
    
    const [gateways] = await db.query('SELECT id, farm_id FROM gateways WHERE ip_address = ?', [gatewayIp]);
    if (gateways.length === 0) {
      log.warn(`Gateway not found for IP: ${gatewayIp}`);
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
    log.error('Sensor data handling error:', error);
  }
}

/**
 * 处理执行器状态
 */
async function handleActuatorStatus(gatewayIp, actuatorData) {
  try {
    log.debug('Actuator status from gateway %s: %d items', gatewayIp, actuatorData.length);
    
    if (!db) return;
    
    const [gateways] = await db.query('SELECT id, farm_id FROM gateways WHERE ip_address = ?', [gatewayIp]);
    if (gateways.length === 0) {
      log.warn(`Gateway not found for IP: ${gatewayIp}`);
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
    log.error('Actuator status handling error:', error);
  }
}

/**
 * 处理数据上报
 */
async function handleDataReport(gatewayIp, reportData) {
  try {
    log.debug('Data report from gateway %s: %d nodes', gatewayIp, reportData.nodes ? reportData.nodes.length : 0);
    
    if (!db) return;
    
    const [gateways] = await db.query('SELECT id, farm_id FROM gateways WHERE ip_address = ?', [gatewayIp]);
    if (gateways.length === 0) {
      log.warn(`Gateway not found for IP: ${gatewayIp}`);
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
          
          // 更新执行器状态和 feedback（feedback 包含 tracking_enabled、gesture_control_enabled 等运行时状态）
          const feedbackJson = node.feedback ? JSON.stringify(node.feedback) : null;
          if (feedbackJson) {
            await db.execute(
              'UPDATE actuators SET status = ?, state = ?, mode = ?, last_update = ?, area = ?, feedback = ? WHERE id = ?',
              ['online', node.state || 'off', node.mode || 'auto', 
               new Date().toISOString().replace('T', ' ').slice(0, 19), deviceArea, feedbackJson, deviceId]
            );
          } else {
            await db.execute(
              'UPDATE actuators SET status = ?, state = ?, mode = ?, last_update = ?, area = ? WHERE id = ?',
              ['online', node.state || 'off', node.mode || 'auto', 
               new Date().toISOString().replace('T', ' ').slice(0, 19), deviceArea, deviceId]
            );
          }
        }
      }
    }
  } catch (error) {
    log.error('Data report handling error:', error);
  }
}

/**
 * 处理命令确认
 * 
 * 对于 track/gyro/color/reset 等摄像头子命令，不改变执行器 state，
 * 仅解锁并更新时间戳（与 PATCH /api/actuators/[id]/commands 逻辑一致）。
 * 这些命令的状态变化通过硬件定期上报的 feedback 字段反映。
 */
async function handleCommandAck(actuatorId, commandId, status, controlValue, state) {
  try {
    log.info(`Command ack - Actuator: ${actuatorId}, Command ID: ${commandId}, Status: ${status}, State: ${state}`);
    
    if (!db || !actuatorId) return;
    
    const [existingCommands] = await db.query(
      'SELECT id, command, control_value, command_data FROM actuator_commands WHERE id = ? AND actuator_id = ?',
      [commandId, actuatorId]
    );
    
    if (existingCommands.length === 0) {
      log.warn(`Command not found: ${commandId} for actuator ${actuatorId}`);
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
      // track/gyro/color/reset 命令不改变执行器 state，
      // 但必须同步更新 feedback 中的对应字段，避免前端等待数据上报周期（~30s）
      const noStateChangeCommands = ['track', 'color', 'reset', 'gyro'];
      const shouldUpdateState = !noStateChangeCommands.includes(command.command);
      
      if (shouldUpdateState) {
        // 优先使用硬件回传的 state，其次根据命令类型推断
        let newState = state;
        if (!newState) {
          if (command.command === 'on') newState = 'on';
          else if (command.command === 'off') newState = 'off';
          else if (command.command === 'value' && (command.control_value || controlValue) > 0) newState = 'on';
          else newState = 'off';
        }
        
        await db.execute(
          'UPDATE actuators SET state = ?, control_value = ?, last_update = ?, locked = 0 WHERE id = ?',
          [newState, controlValue || command.control_value || null, 
           new Date().toISOString().replace('T', ' ').slice(0, 19), actuatorId]
        );
        
        log.info(`Actuator ${actuatorId} updated - state: ${newState}`);
      } else {
        // gyro/track/color 命令：合并 feedback 字段后立即写入，不等数据上报
        // 关键：如果 feedback 为空（尚无数据上报），不写入避免丢失 stream_url 等字段
        const [fbRows] = await db.query(
          `SELECT feedback FROM actuators WHERE id = ?`, [actuatorId]
        );
        const existingFeedback = (fbRows.length > 0 && fbRows[0].feedback)
          ? (typeof fbRows[0].feedback === 'string' ? JSON.parse(fbRows[0].feedback) : fbRows[0].feedback)
          : {};
        
        const hasExistingData = Object.keys(existingFeedback).length > 0;
        
        if (hasExistingData) {
          let cmdData = command.command_data;
          if (cmdData && typeof cmdData === 'string') {
            try { cmdData = JSON.parse(cmdData); } catch {}
          }
          
          if (command.command === 'gyro') {
            const gyroValue = (cmdData && cmdData.value) || command.control_value;
            existingFeedback.gesture_control_enabled = (gyroValue === 'on' || gyroValue === true || gyroValue === 1);
          } else if (command.command === 'track') {
            const trackValue = (cmdData && cmdData.value) || command.control_value;
            existingFeedback.tracking_enabled = (trackValue === 'on' || trackValue === true || trackValue === 1);
          } else if (command.command === 'color') {
            existingFeedback.color_preset = (cmdData && cmdData.color) || existingFeedback.color_preset;
          }
          
          await db.execute(
            'UPDATE actuators SET last_update = ?, locked = 0, feedback = ? WHERE id = ?',
            [new Date().toISOString().replace('T', ' ').slice(0, 19), JSON.stringify(existingFeedback), actuatorId]
          );
          
          log.info(`Actuator ${actuatorId} unlocked (${command.command} command, feedback synced)`);
        } else {
          // feedback 为空，仅解锁，等待数据上报补充完整 feedback
          await db.execute(
            'UPDATE actuators SET last_update = ?, locked = 0 WHERE id = ?',
            [new Date().toISOString().replace('T', ' ').slice(0, 19), actuatorId]
          );
          log.info(`Actuator ${actuatorId} unlocked (${command.command} command, feedback empty - skipped write)`);
        }
      }
    } else {
      await db.execute('UPDATE actuators SET locked = 0 WHERE id = ?', [actuatorId]);
    }
    
    // 通知前端命令状态（含 feedback 数据，确保手势控制/追踪等状态同步）
    await notifyCommandStatus(actuatorId, commandId, status, controlValue, command.command);
  } catch (error) {
    log.error('Command ack handling error:', error);
  }
}

/**
 * 通知前端命令状态更新
 * 查询执行器的完整 feedback 数据，确保前端能同步手势控制/追踪等状态
 * command 参数用于前端判断是否需要更新 state（gyro/track 等命令不改变 state）
 */
async function notifyCommandStatus(actuatorId, commandId, status, controlValue, command) {
  try {
    // 查询执行器的完整信息（含 feedback）并广播给前端
    let feedback = null;
    let state = null;
    let area = null;
    
    if (db) {
      const [rows] = await db.query(
        'SELECT feedback, state, area FROM actuators WHERE id = ?', [actuatorId]
      );
      if (rows.length > 0) {
        feedback = rows[0].feedback;
        state = rows[0].state;
        area = rows[0].area;
      }
    }
    
    // 解析 feedback（可能是 JSON 字符串）
    let feedbackObj = {};
    if (feedback) {
      try {
        feedbackObj = typeof feedback === 'string' ? JSON.parse(feedback) : feedback;
      } catch {}
    }
    
    const statusMessage = {
      type: WebSocketMessageType.COMMAND_STATUS,
      data: {
        actuator_id: actuatorId,
        command_id: commandId,
        command: command || '',           // 命令类型，前端用于判断是否更新 state
        status: status,
        control_value: controlValue,
        state: state,
        feedback: feedbackObj,            // 包含手势控制/追踪等实时状态
        timestamp: Date.now(),
      },
    };
    
    // 通过执行器连接发送
    const actuatorWs = actuatorConnections.get(actuatorId);
    if (actuatorWs && actuatorWs.readyState === WebSocket.OPEN) {
      actuatorWs.send(JSON.stringify(statusMessage));
      log.info(`Command status sent to actuator client: ${actuatorId}`);
    }
    
    // 通过区域连接广播
    if (area) {
      const areaWsSet = areaConnections.get(area);
      if (areaWsSet && areaWsSet.size > 0) {
        areaWsSet.forEach((conn) => {
          if (conn.readyState === WebSocket.OPEN) {
            conn.send(JSON.stringify(statusMessage));
          }
        });
        log.info(`Command status broadcast to area: ${area} (含feedback)`);
      }
    }
  } catch (error) {
    log.error('Error in notifyCommandStatus:', error);
  }
}

/**
 * 处理区域同步请求
 */
async function handleAreaSync(ws, area) {
  try {
    log.info(`Area sync request for: ${area}`);
    
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
    log.error('Area sync error:', error);
    ws.send(JSON.stringify({
      type: WebSocketMessageType.ERROR,
      message: 'Area sync failed',
    }));
  }
}

/**
 * 发送命令到执行器（公开函数，供外部调用）
 */
function sendCommandToActuator(actuatorId, command) {
  // 优先尝试通过执行器直接连接发送
  let ws = actuatorConnections.get(actuatorId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: WebSocketMessageType.COMMAND,
      data: command
    }));
    log.info(`Command sent directly to actuator: ${actuatorId}`);
    return true;
  }
  
  // 如果执行器没有直接连接，尝试通过网关连接发送
  if (db) {
    db.query('SELECT area FROM actuators WHERE id = ?', [actuatorId])
      .then(([results]) => {
        if (results.length > 0 && results[0].area) {
          const area = results[0].area;
          
          // 通过区域名查找网关（区域名格式：区域-IP地址）
          if (area && area.startsWith('区域-')) {
            const gatewayIp = area.replace('区域-', '');
            ws = gatewayConnections.get(gatewayIp);
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: WebSocketMessageType.COMMAND,
                data: {
                  ...command,
                  actuator_id: actuatorId
                }
              }));
              log.info(`Command sent via gateway ${gatewayIp} to actuator: ${actuatorId}`);
              return true;
            }
          }
          
          // 通过区域连接广播发送
          const areaWsSet = areaConnections.get(area);
          if (areaWsSet && areaWsSet.size > 0) {
            areaWsSet.forEach(conn => {
              if (conn.readyState === WebSocket.OPEN) {
                conn.send(JSON.stringify({
                  type: WebSocketMessageType.COMMAND,
                  data: {
                    ...command,
                    actuator_id: actuatorId
                  }
                }));
              }
            });
            log.info(`Command sent via area broadcast ${area} to actuator: ${actuatorId}`);
            return true;
          }
        }
      })
      .catch((error) => {
        log.error('Error querying actuator area:', error);
      });
  }
  
  log.info(`No active connection found for actuator: ${actuatorId}`);
  return false;
}

/**
 * 发送任意消息到指定网关（供 Next.js 通过 HTTP 中继调用）
 */
function sendMessageToGateway(gatewayIp, message) {
  const ws = gatewayConnections.get(gatewayIp);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
    log.info(`Message sent to gateway ${gatewayIp}: ${message.type}`);
    return true;
  }
  log.info(`No active gateway connection: ${gatewayIp}`);
  return false;
}

/**
 * 处理树莓派上报的识别模型状态（type=model_status）
 * data: { gateway_ip, request_id, filename, success, message, current_model, ... }
 */
async function handleModelStatus(connGatewayIp, data) {
  const gatewayIp = data.gateway_ip || connGatewayIp;
  if (!gatewayIp || !db) return;

  const requestId = data.request_id || null;
  const filename = data.filename || data.current_model || null;
  const success = Boolean(data.success);
  const message = String(data.message || '').slice(0, 500);

  try {
    if (requestId) {
      // 回填切换请求回执（已成功的记录不覆盖）
      const [logs] = await db.query(
        'SELECT id, filename, status FROM yolo_model_switch_logs WHERE id = ? LIMIT 1',
        [requestId]
      );
      if (logs.length > 0 && logs[0].status !== 'success') {
        const targetFile = filename || logs[0].filename;
        await db.execute(
          `UPDATE yolo_model_switch_logs
           SET status = ?, message = ?, acked_at = NOW()
           WHERE id = ?`,
          [success ? 'success' : 'failed', message, requestId]
        );
        await db.execute(
          `UPDATE yolo_models SET last_message = ?, status = ?
           WHERE gateway_ip = ? AND filename = ?`,
          [message, success ? 'active' : 'failed', gatewayIp, targetFile]
        );

        if (success && targetFile) {
          // 切换成功：期望模型与硬件实际加载模型对齐
          await db.execute('UPDATE yolo_models SET is_active = 0 WHERE gateway_ip = ?', [gatewayIp]);
          await db.execute(
            'UPDATE yolo_models SET is_active = 1 WHERE gateway_ip = ? AND filename = ?',
            [gatewayIp, targetFile]
          );
          await db.execute(
            `INSERT INTO yolo_model_status (gateway_ip, current_model, loaded, reported_at)
             VALUES (?, ?, 1, NOW())
             ON DUPLICATE KEY UPDATE
               current_model = VALUES(current_model),
               loaded = 1,
               switching = 0,
               last_error = NULL,
               reported_at = VALUES(reported_at)`,
            [gatewayIp, targetFile]
          );
        }
        log.info(
          'Model switch ack #' + requestId + ' from ' + gatewayIp + ': ' + (success ? 'success' : 'failed') + ' ' + message
        );
      }
    } else if (filename) {
      // 无请求ID的状态播报：仅刷新当前模型
      await db.execute(
        `INSERT INTO yolo_model_status (gateway_ip, current_model, loaded, reported_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           current_model = VALUES(current_model),
           loaded = VALUES(loaded),
           switching = 0,
           reported_at = VALUES(reported_at)`,
        [gatewayIp, filename, data.loaded === false ? 0 : 1]
      );
    }
  } catch (error) {
    log.error('handleModelStatus error:', error.message);
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
  
  // 创建HTTP服务器用于命令转发
  const http = require('http');
  const httpServer = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/send-command') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const { actuator_id, command } = data;
          if (actuator_id && command) {
            const sent = sendCommandToActuator(actuator_id, command);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, sent }));
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Missing actuator_id or command' }));
          }
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: error.message }));
        }
      });
    } else if (req.method === 'POST' && req.url === '/send-gateway-message') {
      // 通用网关消息中继：{ gateway_ip, message }
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const { gateway_ip, message } = data;
          if (gateway_ip && message && message.type) {
            const sent = sendMessageToGateway(gateway_ip, message);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, sent }));
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Missing gateway_ip or message.type' }));
          }
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: error.message }));
        }
      });
    } else if (req.method === 'GET' && req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        connections: {
          devices: deviceConnections.size,
          actuators: actuatorConnections.size,
          gateways: gatewayConnections.size,
          areas: areaConnections.size
        }
      }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Not found' }));
    }
  });
  
  httpServer.listen(8081, () => {
    log.info('HTTP command relay server started on port 8081');
  });
  
  log.info('独立WebSocket服务器启动完成');
}

// 启动服务器
main().catch((error) => {
  log.error('启动失败:', error);
  process.exit(1);
});

// 处理进程退出
process.on('SIGINT', () => {
  log.info('正在关闭服务器...');
  if (wss) {
    wss.close(() => {
      log.info('服务器已关闭');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});
