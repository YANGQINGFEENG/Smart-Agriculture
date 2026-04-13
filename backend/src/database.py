import sqlite3
import logging
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from config import DATABASE_CONFIG, LOG_CONFIG

# 配置日志
log_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), '..', 'logs', 'database.log')
logging.basicConfig(level=getattr(logging, LOG_CONFIG['level']), 
                    format=LOG_CONFIG['format'],
                    filename=log_file)
logger = logging.getLogger('database')

class Database:
    def __init__(self):
        """初始化数据库连接"""
        self.db_file = DATABASE_CONFIG['db_file']
        self.connection = None
        self.connect()
    
    def connect(self):
        """连接数据库"""
        try:
            # 确保数据库文件目录存在
            db_dir = os.path.dirname(self.db_file)
            if db_dir and not os.path.exists(db_dir):
                os.makedirs(db_dir)
            
            if self.connection is None:
                self.connection = sqlite3.connect(self.db_file)
                self.connection.row_factory = sqlite3.Row
                logger.info("数据库连接成功")
            return True
        except Exception as e:
            logger.error(f"数据库连接失败: {e}")
            return False
    
    def execute(self, sql, params=None):
        """执行SQL语句"""
        if not self.connection:
            self.connect()
        try:
            cursor = self.connection.cursor()
            if params:
                cursor.execute(sql, params)
            else:
                cursor.execute(sql)
            self.connection.commit()
            return True
        except Exception as e:
            logger.error(f"执行SQL语句时出错: {e}")
            if self.connection:
                self.connection.rollback()
            return False
        finally:
            if 'cursor' in locals():
                cursor.close()
    
    def fetch_one(self, sql, params=None):
        """执行SQL语句并返回一条结果"""
        if not self.connection:
            self.connect()
        try:
            cursor = self.connection.cursor()
            if params:
                cursor.execute(sql, params)
            else:
                cursor.execute(sql)
            
            row = cursor.fetchone()
            if row:
                return dict(row)
            return None
        except Exception as e:
            logger.error(f"执行SQL查询时出错: {e}")
            return None
        finally:
            if 'cursor' in locals():
                cursor.close()
    
    def fetch_all(self, sql, params=None):
        """执行SQL语句并返回所有结果"""
        if not self.connection:
            self.connect()
        try:
            cursor = self.connection.cursor()
            if params:
                cursor.execute(sql, params)
            else:
                cursor.execute(sql)
            
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"执行SQL查询时出错: {e}")
            return []
        finally:
            if 'cursor' in locals():
                cursor.close()
    
    def disconnect(self):
        """关闭数据库连接"""
        if self.connection:
            self.connection.close()
            self.connection = None
            logger.info("数据库连接已关闭")
    
    def create_tables(self):
        """创建数据库表"""
        try:
            # 创建设备表
            create_devices_table = """
            CREATE TABLE IF NOT EXISTS devices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL UNIQUE,
                device_name TEXT NOT NULL,
                device_type TEXT NOT NULL,
                ip_address TEXT,
                last_seen TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
            self.execute(create_devices_table)
            
            # 创建传感器数据表
            create_sensor_data_table = """
            CREATE TABLE IF NOT EXISTS sensor_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                timestamp TIMESTAMP NOT NULL,
                sensor_type TEXT NOT NULL,
                value REAL NOT NULL,
                unit TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (device_id) REFERENCES devices(device_id)
            )
            """
            self.execute(create_sensor_data_table)
            
            # 创建索引
            create_indexes = [
                "CREATE INDEX IF NOT EXISTS idx_sensor_data_device_id ON sensor_data(device_id)",
                "CREATE INDEX IF NOT EXISTS idx_sensor_data_timestamp ON sensor_data(timestamp)",
                "CREATE INDEX IF NOT EXISTS idx_sensor_data_sensor_type ON sensor_data(sensor_type)"
            ]
            for index_sql in create_indexes:
                self.execute(index_sql)
            
            logger.info("数据库表创建成功")
            return True
        except Exception as e:
            logger.error(f"创建数据库表时出错: {e}")
            return False

if __name__ == "__main__":
    # 测试数据库连接
    db = Database()
    print("数据库连接成功")
    db.create_tables()
    db.disconnect()
