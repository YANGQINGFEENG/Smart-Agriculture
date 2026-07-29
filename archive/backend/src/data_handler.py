import json
import logging
from datetime import datetime
from .database import Database

# 配置日志
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('data_handler')

class DataHandler:
    def __init__(self):
        """初始化数据处理器"""
        self.db = Database()
        # 创建数据库表结构
        self.db.create_tables()
    
    def handle_data(self, data, client_ip):
        """处理接收到的数据"""
        try:
            # 验证数据格式
            if not self._validate_data(data):
                logger.error("数据格式验证失败")
                return False
            
            # 处理设备信息
            device_id = data.get('device_id')
            device_type = data.get('device_type')
            device_name = data.get('device_name', device_id)
            
            # 注册设备
            self._register_device(device_id, device_name, device_type, client_ip)
            
            # 处理传感器数据
            timestamp = data.get('timestamp')
            sensors = data.get('sensors', {})
            
            for sensor_type, sensor_data in sensors.items():
                value = sensor_data.get('value')
                unit = sensor_data.get('unit')
                
                if value is not None and unit:
                    self._save_sensor_data(device_id, timestamp, sensor_type, value, unit)
            
            logger.info(f"数据处理成功，设备ID: {device_id}")
            return True
            
        except Exception as e:
            logger.error(f"处理数据时出错: {e}")
            return False
    
    def _validate_data(self, data):
        """验证数据格式"""
        required_fields = ['device_id', 'device_type', 'timestamp', 'sensors']
        for field in required_fields:
            if field not in data:
                logger.error(f"缺少必要字段: {field}")
                return False
        
        if not isinstance(data.get('sensors'), dict):
            logger.error("sensors字段必须是字典类型")
            return False
        
        return True
    
    def _register_device(self, device_id, device_name, device_type, client_ip):
        """注册设备"""
        try:
            logger.info(f"开始注册设备: {device_id}, {device_name}, {device_type}, {client_ip}")
            
            # 检查设备是否已存在
            sql = "SELECT * FROM devices WHERE device_id = ?"
            device = self.db.fetch_one(sql, (device_id,))
            
            if device:
                logger.info(f"设备已存在，更新信息: {device_id}")
                # 更新设备信息
                sql = "UPDATE devices SET ip_address = ?, last_seen = datetime('now') WHERE device_id = ?"
                result = self.db.execute(sql, (client_ip, device_id))
                logger.info(f"更新设备结果: {result}")
            else:
                logger.info(f"设备不存在，插入新设备: {device_id}")
                # 插入新设备
                sql = "INSERT INTO devices (device_id, device_name, device_type, ip_address, last_seen) VALUES (?, ?, ?, ?, datetime('now'))"
                result = self.db.execute(sql, (device_id, device_name, device_type, client_ip))
                logger.info(f"插入设备结果: {result}")
            
        except Exception as e:
            logger.error(f"注册设备时出错: {e}")
    
    def _save_sensor_data(self, device_id, timestamp, sensor_type, value, unit):
        """保存传感器数据"""
        try:
            # 格式化时间戳
            if isinstance(timestamp, str):
                timestamp = datetime.fromisoformat(timestamp)
            
            # 插入传感器数据
            sql = "INSERT INTO sensor_data (device_id, timestamp, sensor_type, value, unit) VALUES (?, ?, ?, ?, ?)"
            self.db.execute(sql, (device_id, timestamp, sensor_type, value, unit))
            
        except Exception as e:
            logger.error(f"保存传感器数据时出错: {e}")

if __name__ == "__main__":
    # 测试数据处理器
    test_data = {
        "device_id": "esp32_001",
        "device_name": "环境传感器",
        "device_type": "environment",
        "timestamp": datetime.now().isoformat(),
        "sensors": {
            "temperature": {"value": 25.5, "unit": "℃"},
            "humidity": {"value": 60.0, "unit": "%"}
        }
    }
    
    handler = DataHandler()
    handler.handle_data(test_data, "192.168.1.100")
