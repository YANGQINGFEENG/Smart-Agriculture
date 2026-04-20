const mqtt = require('mqtt');

// 连接选项
const options = {
  clientId: 'test-client',
  username: 'server',
  password: 'server-internal',
  protocolVersion: 4, // MQTT 3.1.1
  clean: true,
  keepalive: 60,
  connectTimeout: 30000
};

// 连接到MQTT broker
const client = mqtt.connect('mqtt://localhost:1883', options);

// 连接事件
client.on('connect', () => {
  console.log('✅ 连接成功！');
  
  // 发布测试消息
  const topic = 'test/topic';
  const message = 'Hello MQTT!';
  
  client.publish(topic, message, { qos: 1, retain: false }, (err) => {
    if (err) {
      console.error('❌ 发布消息失败:', err);
    } else {
      console.log('✅ 消息发布成功:', message);
    }
    
    // 订阅测试主题
    client.subscribe(topic, { qos: 1 }, (err) => {
      if (err) {
        console.error('❌ 订阅主题失败:', err);
      } else {
        console.log('✅ 主题订阅成功:', topic);
      }
      
      // 3秒后断开连接
      setTimeout(() => {
        client.end();
        console.log('🔌 连接已断开');
      }, 3000);
    });
  });
});

// 消息接收事件
client.on('message', (topic, message) => {
  console.log('📩 收到消息:', topic, message.toString());
});

// 错误事件
client.on('error', (error) => {
  console.error('❌ 连接错误:', error);
});

// 断开连接事件
client.on('disconnect', () => {
  console.log('🔌 连接已断开');
});

// 重连事件
client.on('reconnect', () => {
  console.log('🔄 正在重连...');
});
