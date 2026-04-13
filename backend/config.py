# 系统配置文件
import os

# 数据库配置
DATABASE_CONFIG = {
    'db_file': os.path.join(os.path.dirname(__file__), '..', 'database', 'agriculture_iot.db')
}

# TCP服务器配置
TCP_SERVER_CONFIG = {
    'host': '0.0.0.0',
    'port': 8888
}

# API服务器配置
API_SERVER_CONFIG = {
    'host': '0.0.0.0',
    'port': 5000,
    'debug': False
}

# 日志配置
LOG_CONFIG = {
    'level': 'INFO',
    'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
}

# 数据处理配置
DATA_PROCESSING_CONFIG = {
    'max_data_points': 10000,  # 最大数据点数量
    'cleanup_interval': 3600,  # 数据清理间隔（秒）
    'data_retention_days': 30  # 数据保留天数
}
