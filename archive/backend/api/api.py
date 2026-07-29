from flask import Flask, jsonify, request
from flask_cors import CORS
import logging
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

# 配置日志
log_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), '..', 'logs', 'api.log')
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                    filename=log_file)
logger = logging.getLogger('api')

app = Flask(__name__)
# 启用CORS，允许所有跨域请求
CORS(app)
# 从data_handler模块导入数据库实例
db = None

def set_database(database):
    """设置数据库实例"""
    global db
    db = database

@app.route('/api/devices', methods=['GET'])
def get_devices():
    """获取所有设备列表"""
    try:
        if db is None:
            logger.error("数据库实例未初始化")
            return jsonify({
                'success': False,
                'error': '数据库实例未初始化'
            }), 500
        
        sql = "SELECT * FROM devices"
        devices = db.fetch_all(sql, [])
        logger.info(f"获取设备列表成功，设备数量: {len(devices)}")
        return jsonify({
            'success': True,
            'data': devices
        })
    except Exception as e:
        logger.error(f"获取设备列表时出错: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/devices/<device_id>', methods=['GET'])
def get_device(device_id):
    """获取设备详细信息"""
    try:
        sql = "SELECT * FROM devices WHERE device_id = ?"
        device = db.fetch_one(sql, (device_id,))
        if device:
            return jsonify({
                'success': True,
                'data': device
            })
        else:
            return jsonify({
                'success': False,
                'error': '设备不存在'
            }), 404
    except Exception as e:
        logger.error(f"获取设备信息时出错: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/sensor-data', methods=['GET'])
def get_sensor_data():
    """获取传感器数据"""
    try:
        # 获取查询参数
        device_id = request.args.get('device_id')
        sensor_type = request.args.get('sensor_type')
        limit = request.args.get('limit', 100, type=int)
        
        # 构建SQL查询
        sql = "SELECT * FROM sensor_data WHERE 1=1"
        params = []
        
        if device_id:
            sql += " AND device_id = ?"
            params.append(device_id)
        
        if sensor_type:
            sql += " AND sensor_type = ?"
            params.append(sensor_type)
        
        sql += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)
        
        data = db.fetch_all(sql, params)
        return jsonify({
            'success': True,
            'data': data
        })
    except Exception as e:
        logger.error(f"获取传感器数据时出错: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/sensor-data/latest', methods=['GET'])
def get_latest_sensor_data():
    """获取最新的传感器数据"""
    try:
        # 获取查询参数
        device_id = request.args.get('device_id')
        sensor_type = request.args.get('sensor_type')
        
        # 构建SQL查询
        sql = """
        SELECT * FROM sensor_data
        WHERE 1=1
        """
        params = []
        
        if device_id:
            sql += " AND device_id = ?"
            params.append(device_id)
        
        if sensor_type:
            sql += " AND sensor_type = ?"
            params.append(sensor_type)
        
        sql += " ORDER BY timestamp DESC LIMIT 1"
        
        data = db.fetch_one(sql, params)
        if data:
            return jsonify({
                'success': True,
                'data': data
            })
        else:
            return jsonify({
                'success': False,
                'error': '没有找到数据'
            }), 404
    except Exception as e:
        logger.error(f"获取最新传感器数据时出错: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
