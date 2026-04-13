import threading
import time
import logging
import sys
import os
sys.path.append(os.path.dirname(__file__))
from src.tcp_server import TCPServer
from src.data_handler import DataHandler
from api.api import app
from config import TCP_SERVER_CONFIG, API_SERVER_CONFIG, LOG_CONFIG

# 配置日志
log_file = os.path.join(os.path.dirname(__file__), '..', 'logs', 'main.log')
logging.basicConfig(level=getattr(logging, LOG_CONFIG['level']), 
                    format=LOG_CONFIG['format'],
                    filename=log_file)
logger = logging.getLogger('main')

class Server:
    def __init__(self):
        """初始化服务器"""
        self.tcp_server = None
        self.data_handler = DataHandler()
        self.api_thread = None
    
    def start_tcp_server(self):
        """启动TCP服务器"""
        try:
            self.tcp_server = TCPServer(
                host=TCP_SERVER_CONFIG['host'],
                port=TCP_SERVER_CONFIG['port'],
                data_handler=self.data_handler.handle_data
            )
            self.tcp_server.start()
            logger.info(f"TCP服务器启动成功，监听地址: {TCP_SERVER_CONFIG['host']}:{TCP_SERVER_CONFIG['port']}")
        except Exception as e:
            logger.error(f"启动TCP服务器时出错: {e}")
    
    def start_api_server(self):
        """启动API服务器"""
        try:
            # 将数据库实例传递给API模块
            from api.api import set_database
            set_database(self.data_handler.db)
            
            app.run(
                host=API_SERVER_CONFIG['host'],
                port=API_SERVER_CONFIG['port'],
                debug=API_SERVER_CONFIG['debug']
            )
        except Exception as e:
            logger.error(f"启动API服务器时出错: {e}")
    
    def start(self):
        """启动所有服务"""
        try:
            # 启动TCP服务器
            self.start_tcp_server()
            
            # 启动API服务器（在新线程中）
            self.api_thread = threading.Thread(target=self.start_api_server)
            self.api_thread.daemon = True
            self.api_thread.start()
            
            logger.info("服务器启动成功")
            
            # 保持程序运行
            while True:
                time.sleep(1)
                
        except KeyboardInterrupt:
            logger.info("服务器正在停止...")
            self.stop()
        except Exception as e:
            logger.error(f"服务器运行时出错: {e}")
            self.stop()
    
    def stop(self):
        """停止所有服务"""
        try:
            if self.tcp_server:
                self.tcp_server.stop()
            logger.info("服务器已停止")
        except Exception as e:
            logger.error(f"停止服务器时出错: {e}")

if __name__ == "__main__":
    server = Server()
    server.start()
