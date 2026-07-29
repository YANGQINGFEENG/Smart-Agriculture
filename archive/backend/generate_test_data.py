import socket
import json
import time
import random
from datetime import datetime

# 服务器地址和端口
SERVER_HOST = 'localhost'
SERVER_PORT = 8888

# 模拟设备信息
devices = [
    {
        'device_id': 'esp32_001',
        'device_name': '环境传感器',
        'device_type': 'environment'
    },
    {
        'device_id': 'esp32_002',
        'device_name': '土壤传感器',
        'device_type': 'soil'
    },
    {
        'device_id': 'esp32_003',
        'device_name': '水质传感器',
        'device_type': 'water'
    },
    {
        'device_id': 'esp32_004',
        'device_name': '安全传感器',
        'device_type': 'security'
    }
]

# 传感器数据范围
sensor_ranges = {
    'environment': {
        'temperature': {'min': 15, 'max': 30, 'unit': '℃'},
        'humidity': {'min': 40, 'max': 80, 'unit': '%'},
        'illumination': {'min': 0, 'max': 10000, 'unit': 'lux'},
        'co2': {'min': 400, 'max': 1000, 'unit': 'ppm'},
        'pressure': {'min': 1000, 'max': 1020, 'unit': 'hPa'}
    },
    'soil': {
        'soil_moisture': {'min': 20, 'max': 80, 'unit': '%'},
        'soil_ph': {'min': 5.5, 'max': 7.5, 'unit': 'pH'},
        'soil_ec': {'min': 0.1, 'max': 2.0, 'unit': 'mS/cm'}
    },
    'water': {
        'water_ph': {'min': 6.5, 'max': 8.5, 'unit': 'pH'},
        'dissolved_oxygen': {'min': 5, 'max': 10, 'unit': 'mg/L'},
        'turbidity': {'min': 0, 'max': 50, 'unit': 'NTU'}
    },
    'security': {
        'pir': {'values': [True, False], 'unit': 'status'},
        'smoke': {'min': 0, 'max': 200, 'unit': 'ppm'},
        'rain': {'values': [True, False], 'unit': 'status'}
    }
}

def generate_sensor_data(device_type):
    """生成传感器数据"""
    sensors = {}
    ranges = sensor_ranges[device_type]
    
    for sensor_type, config in ranges.items():
        if 'values' in config:
            # 离散值
            value = random.choice(config['values'])
        else:
            # 连续值
            if sensor_type in ['soil_ph', 'soil_ec']:
                value = round(random.uniform(config['min'], config['max']), 2)
            else:
                value = round(random.uniform(config['min'], config['max']), 1)
        
        sensors[sensor_type] = {
            'value': value,
            'unit': config['unit']
        }
    
    return sensors

def send_data(device):
    """发送数据到服务器"""
    try:
        # 创建TCP连接
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((SERVER_HOST, SERVER_PORT))
        
        # 生成数据
        data = {
            'device_id': device['device_id'],
            'device_name': device['device_name'],
            'device_type': device['device_type'],
            'timestamp': datetime.now().isoformat(),
            'sensors': generate_sensor_data(device['device_type'])
        }
        
        # 发送数据
        message = json.dumps(data)
        sock.sendall(message.encode('utf-8'))
        
        # 关闭连接
        sock.close()
        
        print(f"发送数据成功: {device['device_name']}")
        print(f"数据: {json.dumps(data, indent=2)}")
        print("-" * 50)
        
    except Exception as e:
        print(f"发送数据失败: {e}")
        print("-" * 50)

def main():
    """主函数"""
    print("开始生成测试数据...")
    print("-" * 50)
    
    try:
        while True:
            # 为每个设备发送数据
            for device in devices:
                send_data(device)
                time.sleep(2)  # 每个设备间隔2秒
            
            # 所有设备发送完毕后，等待5秒
            time.sleep(5)
            
    except KeyboardInterrupt:
        print("\n停止生成数据")

if __name__ == "__main__":
    main()
