const net = require('net');

// 创建TCP服务器
const server = net.createServer((socket) => {
  console.log('✅ 客户端连接:', socket.remoteAddress, socket.remotePort);
  
  // 发送欢迎消息
  socket.write('Welcome to MQTT test server!\n');
  
  // 接收数据
  socket.on('data', (data) => {
    console.log('📩 收到数据:', data.toString('hex'));
    
    // 简单的MQTT CONNACK响应（固定头部 + 可变头部）
    // CONNACK: 0x20 0x02 0x00 0x00
    const connack = Buffer.from([0x20, 0x02, 0x00, 0x00]);
    socket.write(connack);
    console.log('📤 发送CONNACK响应');
  });
  
  // 连接关闭
  socket.on('end', () => {
    console.log('🔌 客户端断开连接');
  });
  
  // 错误处理
  socket.on('error', (error) => {
    console.error('❌ 连接错误:', error);
  });
});

// 监听端口
const PORT = 1883;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`🚀 TCP服务器已启动: ${HOST}:${PORT}`);
  console.log('等待客户端连接...');
});

// 错误处理
server.on('error', (error) => {
  console.error('❌ 服务器错误:', error);
});
