#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
简单的MQTT匿名连接测试
"""

import paho.mqtt.client as mqtt
import time
import json

# MQTT 配置
MQTT_BROKER = "localhost"
MQTT_PORT = 1883
CLIENT_ID = f"anonymous-client-{time.time()}"

# 主题配置
TEST_TOPIC = "test/topic"

# 连接回调函数
def on_connect(client, userdata, flags, rc):
    """连接成功回调"""
    print(f"✅ 连接成功，返回码: {rc}")
    print(f"客户端ID: {client._client_id.decode()}")
    
    # 订阅测试主题
    client.subscribe(TEST_TOPIC, qos=1)
    print(f"📩 已订阅主题: {TEST_TOPIC}")

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

# 主函数
def main():
    """主函数"""
    print("🚀 简单 MQTT 匿名连接测试")
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
    
    try:
        # 连接到MQTT broker
        print("正在连接...")
        client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
        
        # 开始网络循环
        client.loop_start()
        
        # 等待连接成功
        time.sleep(2)
        
        # 发布测试消息
        print("\n发布测试消息...")
        for i in range(5):
            payload = json.dumps({"message": f"Hello MQTT! #{i+1}", "time": time.time()})
            result = client.publish(TEST_TOPIC, payload, qos=1)
            result.wait_for_publish()
            print(f"已发布消息 #{i+1}")
            time.sleep(2)
        
        # 保持运行
        print("\n保持运行中...")
        print("按 Ctrl+C 退出")
        
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n\n👋 用户中断")
    except Exception as e:
        print(f"\n\n❌ 发生错误: {e}")
    finally:
        # 断开连接
        print("\n\n🔌 正在断开连接...")
        client.loop_stop()
        client.disconnect()
        print("✅ 连接已断开")

if __name__ == "__main__":
    main()
