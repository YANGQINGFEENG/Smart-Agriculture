#!/usr/bin/env node

const mqtt = require('mqtt');

// MQTT 配置
const MQTT_BROKER = 'mqtt://localhost:1883';
const MQTT_USERNAME = 'server';
const MQTT_PASSWORD = 'server-internal';
const CLIENT_ID = `node-client-${Date.now()}`;

// 主题配置
const TEST_TOPIC = 'test/topic';

// 创建MQTT客户端
const client = mqtt.connect(MQTT_BROKER, {
  clientId: CLIENT_ID,
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  protocolVersion: 4, // MQTT 3.1.1
  clean: true,
  keepalive: 60,
  connectTimeout: 30000
});

// 连接事件
client.on('connect', () => {
  console.log('✅ 连接成功！');
  console.log(`客户端ID: ${CLIENT_ID}`);
  
  // 订阅测试主题
  client.subscribe(TEST_TOPIC, { qos: 1 }, (err) => {
    if (err) {
      console.error('❌ 订阅失败:', err);
    } else {
      console.log(`📩 已订阅主题: ${TEST_TOPIC}`);
    }
  });
  
  // 发布测试消息
  console.log('\n📤 开始发布测试消息...');
  
  let count = 0;
  const interval = setInterval(() => {
    count++;
    const payload = JSON.stringify({
      message: `Hello MQTT! #${count}`,
      time: Date.now()
    });
    
    client.publish(TEST_TOPIC, payload, { qos: 1 }, (err) => {
      if (err) {
        console.error('❌ 发布失败:', err);
      } else {
        console.log(`✅ 已发布消息 #${count}`);
      }
    });
    
    if (count >= 5) {
      clearInterval(interval);
      console.log('\n发布完成，等待接收消息...');
    }
  }, 2000);
});

// 消息接收事件
client.on('message', (topic, message) => {
  console.log('\n📨 收到消息:');
  console.log(`   主题: ${topic}`);
  console.log(`   内容: ${message.toString()}`);
});

// 错误事件
client.on('error', (error) => {
  console.error('❌ 连接错误:', error);
});

// 断开连接事件
client.on('disconnect', (packet) => {
  console.log('🔌 已断开连接:', packet);
});

// 重连事件
client.on('reconnect', () => {
  console.log('🔄 正在重连...');
});

// 结束事件
client.on('end', () => {
  console.log('🔚 连接已结束');
});

// 保持运行
console.log('🚀 MQTT 测试客户端启动');
console.log(`连接到: ${MQTT_BROKER}`);
console.log(`客户端ID: ${CLIENT_ID}`);
console.log('=' .repeat(50));
console.log('按 Ctrl+C 退出');
