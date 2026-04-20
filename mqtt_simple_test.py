#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
简单的MQTT连接测试
"""

import paho.mqtt.client as mqtt
import time

# MQTT 配置
MQTT_BROKER = "localhost"
MQTT_PORT = 1883
MQTT_USERNAME = "server"
MQTT_PASSWORD = "server-internal"
CLIENT_ID = "simple-test-client"

# 连接回调函数
def on_connect(client, userdata, flags, rc):
    """连接成功回调"""
    print(f"✅ 连接成功，返回码: {rc}")
    print(f"客户端ID: {client._client_id.decode()}")

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
    print("🚀 简单 MQTT 连接测试")
    print(f"连接到: {MQTT_BROKER}:{MQTT_PORT}")
    print(f"客户端ID: {CLIENT_ID}")
    print("=" * 50)
    
    # 创建MQTT客户端
    client = mqtt.Client(client_id=CLIENT_ID, clean_session=True, protocol=mqtt.MQTTv311)
    
    # 设置回调函数
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    
    # 设置用户名和密码
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    
    try:
        # 连接到MQTT broker
        print("正在连接...")
        client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
        
        # 开始网络循环
        client.loop_start()
        
        # 保持运行
        print("连接成功，保持运行中...")
        print("按 Ctrl+C 退出")
        
        while True:
            time.sleep(1)
            print(".", end="", flush=True)
            
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
