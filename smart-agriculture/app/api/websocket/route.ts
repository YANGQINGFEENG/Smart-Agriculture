import { NextRequest, NextResponse } from 'next/server';
import { WebSocketServer } from 'ws';

// 存储WebSocket连接
const clients = new Set<WebSocket>();

// 存储WebSocket服务器实例
let wss: WebSocketServer | null = null;

/**
 * 初始化WebSocket服务器
 */
function initWebSocketServer() {
  if (wss) {
    return wss;
  }

  // 创建WebSocket服务器
  wss = new WebSocketServer({
    noServer: true,
  });

  // 处理连接
  wss.on('connection', (ws) => {
    console.log('新的WebSocket连接');
    clients.add(ws);

    // 发送欢迎消息
    ws.send(JSON.stringify({
      type: 'welcome',
      message: '连接成功',
      timestamp: new Date().toISOString(),
    }));

    // 处理消息
    ws.on('message', (message) => {
      console.log('收到消息:', message.toString());
      // 可以在这里处理客户端发送的消息
    });

    // 处理断开连接
    ws.on('close', () => {
      console.log('WebSocket连接断开');
      clients.delete(ws);
    });

    // 处理错误
    ws.on('error', (error) => {
      console.error('WebSocket错误:', error);
      clients.delete(ws);
    });
  });

  return wss;
}

/**
 * 广播消息给所有客户端
 * @param message 消息内容
 */
export function broadcastMessage(message: any) {
  const messageString = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageString);
    }
  });
}

/**
 * GET /api/websocket
 * WebSocket端点
 */
export async function GET(request: NextRequest) {
  // 检查是否是WebSocket连接请求
  if (!request.headers.get('upgrade') || request.headers.get('upgrade') !== 'websocket') {
    return NextResponse.json(
      { success: false, error: 'Not a WebSocket request' },
      { status: 400 }
    );
  }

  // 初始化WebSocket服务器
  const wss = initWebSocketServer();

  // 升级HTTP连接为WebSocket连接
  const { socket, response } = await request.upgrade();
  wss.handleUpgrade(socket, response, (ws) => {
    wss.emit('connection', ws);
  });

  // 返回响应以完成升级
  return response;
}
