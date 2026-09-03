#!/usr/bin/env node

/**
 * 测试脚本 - 模拟硬件端通信和指令执行流程
 */

const WebSocket = require('ws');
const axios = require('axios');

// 配置
const CONFIG = {
  SERVER_URL: 'http://localhost:3000',
  WEBSOCKET_URL: 'ws://localhost:8080',
  ACTUATOR_ID: 'WP-001',
  TEST_COMMANDS: ['on', 'off', 'on']
};

class MockHardware {
  constructor(actuatorId) {
    this.actuatorId = actuatorId;
    this.ws = null;
    this.commandHistory = new Set();
    this.currentState = 'off';
  }

  async start() {
    console.log(`[MockHardware] 启动模拟硬件 - 执行器ID: ${this.actuatorId}`);
    
    // 初始化WebSocket连接
    await this.initWebSocket();
    
    // 开始轮询指令
    this.startPolling();
  }

  async initWebSocket() {
    return new Promise((resolve) => {
      this.ws = new WebSocket(`${CONFIG.WEBSOCKET_URL}?actuator_id=${this.actuatorId}`);
      
      this.ws.on('open', () => {
        console.log('[MockHardware] WebSocket连接已建立');
        resolve();
      });
      
      this.ws.on('message', (message) => {
        this.handleWebSocketMessage(message);
      });
      
      this.ws.on('close', () => {
        console.log('[MockHardware] WebSocket连接已关闭');
        // 尝试重连
        setTimeout(() => this.initWebSocket(), 5000);
      });
      
      this.ws.on('error', (error) => {
        console.error('[MockHardware] WebSocket错误:', error);
      });
    });
  }

  handleWebSocketMessage(message) {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'welcome':
          console.log('[MockHardware] 收到欢迎消息:', data.message);
          break;
          
        case 'command':
          console.log('[MockHardware] 收到WebSocket命令:', data.data);
          this.executeCommand(data.data);
          break;
          
        case 'heartbeat_ack':
          console.log('[MockHardware] 收到心跳响应');
          break;
          
        default:
          console.log('[MockHardware] 收到未知消息类型:', data.type);
      }
    } catch (error) {
      console.error('[MockHardware] 处理WebSocket消息错误:', error);
    }
  }

  startPolling() {
    setInterval(async () => {
      await this.pollCommand();
    }, 2000);
  }

  async pollCommand() {
    try {
      const response = await axios.get(`${CONFIG.SERVER_URL}/api/actuators/${this.actuatorId}/commands`);
      
      if (response.data.success && response.data.data) {
        const command = response.data.data;
        console.log('[MockHardware] 轮询到指令:', command);
        this.executeCommand(command);
      }
    } catch (error) {
      console.error('[MockHardware] 轮询指令错误:', error.message);
    }
  }

  async executeCommand(command) {
    // 检查是否已经执行过该命令
    if (this.commandHistory.has(command.id)) {
      console.log(`[MockHardware] 命令 ${command.id} 已执行过，跳过`);
      return;
    }

    // 标记为已执行
    this.commandHistory.add(command.id);

    // 模拟执行命令
    console.log(`[MockHardware] 执行命令: ${command.command} (ID: ${command.id})`);
    
    // 模拟执行时间
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 更新状态
    this.currentState = command.command;
    console.log(`[MockHardware] 执行器状态更新为: ${this.currentState}`);
    
    // 发送执行结果
    await this.sendCommandAck(command.id, 'executed');
  }

  async sendCommandAck(commandId, status) {
    try {
      // 通过WebSocket发送确认
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'command_ack',
          command_id: commandId,
          status: status
        }));
        console.log(`[MockHardware] 通过WebSocket发送确认 - 命令ID: ${commandId}, 状态: ${status}`);
      } else {
        // 回退到HTTP API
        await axios.patch(`${CONFIG.SERVER_URL}/api/actuators/${this.actuatorId}/commands`, {
          command_id: commandId,
          status: status
        });
        console.log(`[MockHardware] 通过HTTP API发送确认 - 命令ID: ${commandId}, 状态: ${status}`);
      }
    } catch (error) {
      console.error('[MockHardware] 发送确认错误:', error.message);
    }
  }

  async sendHeartbeat() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'heartbeat',
        timestamp: Date.now()
      }));
    }
  }
}

// 测试函数
async function runTest() {
  console.log('=== 开始测试通信协议和指令执行流程 ===');
  
  // 创建模拟硬件
  const hardware = new MockHardware(CONFIG.ACTUATOR_ID);
  await hardware.start();
  
  // 发送测试命令
  console.log('\n=== 发送测试命令 ===');
  for (const command of CONFIG.TEST_COMMANDS) {
    try {
      const response = await axios.post(`${CONFIG.SERVER_URL}/api/actuators/${CONFIG.ACTUATOR_ID}/commands`, {
        command: command
      });
      console.log(`发送命令 ${command} 成功，命令ID: ${response.data.data.id}, 通过WebSocket: ${response.data.data.sent_via_websocket}`);
      // 等待一段时间，让硬件执行
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.error(`发送命令 ${command} 失败:`, error.message);
    }
  }
  
  console.log('\n=== 测试完成 ===');
  console.log('请查看日志输出，确认指令执行流程是否正确');
}

// 运行测试
runTest().catch(console.error);
