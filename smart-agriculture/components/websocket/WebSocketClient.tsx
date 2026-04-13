import { useState, useEffect, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  sensorId?: string;
  data?: any;
  message?: string;
  timestamp: string;
}

interface WebSocketClientProps {
  onMessage: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onOpen?: (event: Event) => void;
}

export function WebSocketClient({ onMessage, onError, onClose, onOpen }: WebSocketClientProps) {
  const [ws, setWs] = useState<WebSocket | null>(null);

  // 连接WebSocket
  const connectWebSocket = useCallback(() => {
    try {
      // 构建WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/api/websocket`;
      
      const newWs = new WebSocket(url);
      
      newWs.onopen = (event) => {
        console.log('WebSocket连接成功');
        if (onOpen) onOpen(event);
      };
      
      newWs.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          onMessage(message);
        } catch (error) {
          console.error('解析WebSocket消息失败:', error);
        }
      };
      
      newWs.onerror = (event) => {
        console.error('WebSocket错误:', event);
        if (onError) onError(event);
      };
      
      newWs.onclose = (event) => {
        console.log('WebSocket连接关闭:', event);
        if (onClose) onClose(event);
        // 尝试重连
        setTimeout(connectWebSocket, 3000);
      };
      
      setWs(newWs);
    } catch (error) {
      console.error('创建WebSocket连接失败:', error);
      // 尝试重连
      setTimeout(connectWebSocket, 3000);
    }
  }, [onMessage, onError, onClose, onOpen]);

  // 断开WebSocket连接
  const disconnectWebSocket = useCallback(() => {
    if (ws) {
      ws.close();
      setWs(null);
    }
  }, [ws]);

  // 发送消息
  const sendMessage = useCallback((message: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket未连接');
    }
  }, [ws]);

  useEffect(() => {
    // 连接WebSocket
    connectWebSocket();
    
    // 组件卸载时断开连接
    return () => {
      disconnectWebSocket();
    };
  }, [connectWebSocket, disconnectWebSocket]);

  return null;
}
