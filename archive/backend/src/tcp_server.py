import socket
import threading
import json
import logging

# 配置日志
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('tcp_server')

class TCPServer:
    def __init__(self, host='0.0.0.0', port=8888, data_handler=None):
        """初始化TCP服务器"""
        self.host = host
        self.port = port
        self.data_handler = data_handler
        self.server_socket = None
        self.running = False
    
    def start(self):
        """启动TCP服务器"""
        try:
            self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.server_socket.bind((self.host, self.port))
            self.server_socket.listen(5)
            self.running = True
            logger.info(f"TCP服务器启动成功，监听地址: {self.host}:{self.port}")
            
            # 启动线程接受连接
            accept_thread = threading.Thread(target=self._accept_connections)
            accept_thread.daemon = True
            accept_thread.start()
            
        except Exception as e:
            logger.error(f"TCP服务器启动失败: {e}")
    
    def _accept_connections(self):
        """接受客户端连接"""
        while self.running:
            try:
                client_socket, client_address = self.server_socket.accept()
                logger.info(f"接受到来自 {client_address} 的连接")
                
                # 为每个客户端创建一个线程处理数据
                client_thread = threading.Thread(
                    target=self._handle_client, 
                    args=(client_socket, client_address)
                )
                client_thread.daemon = True
                client_thread.start()
                
            except Exception as e:
                if self.running:
                    logger.error(f"接受连接时出错: {e}")
    
    def _handle_client(self, client_socket, client_address):
        """处理客户端数据"""
        try:
            buffer = b''
            # 定义协议分隔符
            PROTOCOL_DELIMITER = b'\n'
            while self.running:
                # 接收数据
                data = client_socket.recv(4096)
                if not data:
                    break
                
                # 累积数据到缓冲区
                buffer += data
                
                # 按分隔符分割完整消息
                while PROTOCOL_DELIMITER in buffer:
                    # 分割出一条完整消息
                    message, buffer = buffer.split(PROTOCOL_DELIMITER, 1)
                    
                    # 解码数据
                    try:
                        data_str = message.decode('utf-8')
                        logger.info(f"接收到数据: {data_str}")
                        
                        # 解析JSON数据
                        data_json = json.loads(data_str)
                        
                        # 调用数据处理函数
                        if self.data_handler:
                            self.data_handler(data_json, client_address[0])
                        
                    except json.JSONDecodeError as e:
                        logger.error(f"JSON解析失败: {e}")
                    except Exception as e:
                        logger.error(f"处理数据时出错: {e}")
                    
        except Exception as e:
            logger.error(f"处理客户端连接时出错: {e}")
        finally:
            client_socket.close()
            logger.info(f"与 {client_address} 的连接已关闭")
    
    def stop(self):
        """停止TCP服务器"""
        self.running = False
        if self.server_socket:
            try:
                self.server_socket.close()
                logger.info("TCP服务器已停止")
            except Exception as e:
                logger.error(f"停止TCP服务器时出错: {e}")

if __name__ == "__main__":
    # 测试TCP服务器
    def test_data_handler(data, client_ip):
        print(f"处理数据: {data}")
        print(f"客户端IP: {client_ip}")
    
    server = TCPServer(data_handler=test_data_handler)
    server.start()
    
    try:
        input("按回车键停止服务器...\n")
    finally:
        server.stop()
