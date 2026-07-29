#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MQTT 测试客户端
功能：模拟MQTT客户端连接、订阅和发布数据
"""

import paho.mqtt.client as mqtt
import json
import time
import random

# MQTT 配置
MQTT_BROKER = "localhost"
MQTT_PORT = 1883
MQTT_USERNAME = "server"
MQTT_PASSWORD = "server-internal"
CLIENT_ID = f"python-client-{random.randint(1000, 9999)}"

# 主题配置
DATA_TOPIC = "sa/v1/TEST-001/$data"
CMD_TOPIC = "sa/v1/TEST-001/$cmd"

# 连接回调函数
def on_connect(client, userdata, flags, rc):
    """连接成功回调"""
    print(f"✅ 连接成功，返回码: {rc}")
    print(f"客户端ID: {client._client_id.decode()}")
    
    # 订阅指令主题
    client.subscribe(CMD_TOPIC, qos=1)
    print(f"📩 已订阅主题: {CMD_TOPIC}")

# 消息接收回调函数
def on_message(client, userdata, msg):
    """收到消息回调"""
    print(f"\n📨 收到消息:")
    print(f"   主题: {msg.topic}")
    print(f"   内容: {msg.payload.decode()}")
    print(f"   QoS: {msg.qos}")

# 发布成功回调函数
def on_publish(client, userdata, mid):
    """发布成功回调"""
    print(f"✅ 消息发布成功，消息ID: {mid}")

# 订阅成功回调函数
def on_subscribe(client, userdata, mid, granted_qos):
    """订阅成功回调"""
    print(f"✅ 订阅成功，消息ID: {mid}, QoS: {granted_qos}")

# 断开连接回调函数
def on_disconnect(client, userdata, rc):
    """断开连接回调"""
    if rc != 0:
        print(f"❌ 意外断开连接，返回码: {rc}")
    else:
        print("🔌 正常断开连接")

# 生成模拟传感器数据
def generate_sensor_data():
    """生成模拟传感器数据"""
    return {
        "f": [
            round(random.uniform(20.0, 30.0), 1),  # 温度
            round(random.uniform(40.0, 70.0), 1),  # 湿度
            round(random.uniform(500, 2000), 1),   # 光照
            round(random.uniform(20.0, 60.0), 1),  # 土壤湿度
            round(random.uniform(18.0, 25.0), 1),  # 土壤温度
            round(random.uniform(50, 200), 1),     # 土壤EC
            round(random.uniform(5.5, 7.5), 1)      # 土壤pH
        ],
        "ts": int(time.time())
    }

# 主函数
def main():
    """主函数"""
    print("🚀 MQTT 测试客户端启动")
    print(f"连接到: {MQTT_BROKER}:{MQTT_PORT}")
    print(f"客户端ID: {CLIENT_ID}")
    print("=" * 50)
    
    # 创建MQTT客户端
    client = mqtt.Client(client_id=CLIENT_ID, clean_session=True, protocol=mqtt.MQTTv311)
    
    # 设置回调函数
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_publish = on_publish
    client.on_subscribe = on_subscribe
    client.on_disconnect = on_disconnect
    
    # 设置用户名和密码
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    
    try:
        # 连接到MQTT broker
        client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
        
        # 开始网络循环
        client.loop_start()
        
        # 等待连接成功
        time.sleep(2)
        
        # 发布测试数据
        print("\n" + "=" * 50)
        print("📤 开始发布测试数据...")
        
        for i in range(5):
            # 生成传感器数据
            sensor_data = generate_sensor_data()
            payload = json.dumps(sensor_data)
            
            print(f"\n发布第 {i+1} 条数据:")
            print(f"主题: {DATA_TOPIC}")
            print(f"内容: {payload}")
            
            # 发布数据
            result = client.publish(DATA_TOPIC, payload, qos=1)
            
            # 等待发布完成
            result.wait_for_publish()
            
            # 等待一段时间
            time.sleep(3)
        
        # 保持运行，等待接收消息
        print("\n" + "=" * 50)
        print("📥 等待接收指令消息...")
        print("按 Ctrl+C 退出")
        print("=" * 50)
        
        # 保持运行
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n\n👋 用户中断")
    except Exception as e:
        print(f"\n\n❌ 发生错误: {e}")
    finally:
        # 断开连接
        print("\n" + "=" * 50)
        print("🔌 正在断开连接...")
        client.loop_stop()
        client.disconnect()
        print("✅ 连接已断开")
        print("=" * 50)

if __name__ == "__main__":
    main()
