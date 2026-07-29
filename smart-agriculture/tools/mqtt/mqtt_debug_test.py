#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
详细的MQTT连接测试
"""

import paho.mqtt.client as mqtt
import time
import json

# MQTT 配置
MQTT_BROKER = "localhost"
MQTT_PORT = 1883
MQTT_USERNAME = "server"
MQTT_PASSWORD = "server-internal"
CLIENT_ID = "debug-test-client"

# 连接回调函数
def on_connect(client, userdata, flags, rc):
    """连接成功回调"""
    print(f"✅ 连接成功，返回码: {rc}")
    print(f"客户端ID: {client._client_id.decode()}")
    print(f"标志: {flags}")
    
    # 订阅测试主题
    client.subscribe("test/topic", qos=1)
    print("已订阅主题: test/topic")

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
        print(f"返回码含义: {get_rc_description(rc)}")
    else:
        print("🔌 正常断开连接")

# 日志回调函数
def on_log(client, userdata, level, buf):
    """日志回调"""
    print(f"📋 日志: {buf}")

# 获取返回码的描述
def get_rc_description(rc):
    """获取MQTT返回码的描述"""
    rc_codes = {
        0: "连接成功",
        1: "连接被拒绝 - 协议版本不支持",
        2: "连接被拒绝 - 客户端标识符无效",
        3: "连接被拒绝 - 服务器不可用",
        4: "连接被拒绝 - 用户名或密码错误",
        5: "连接被拒绝 - 未授权",
        16: "连接被拒绝 - 认证失败",
    }
    return rc_codes.get(rc, f"未知返回码: {rc}")

# 主函数
def main():
    """主函数"""
    print("🚀 详细 MQTT 连接测试")
    print(f"连接到: {MQTT_BROKER}:{MQTT_PORT}")
    print(f"客户端ID: {CLIENT_ID}")
    print(f"用户名: {MQTT_USERNAME}")
    print(f"密码: {'*' * len(MQTT_PASSWORD)}")
    print("=" * 50)
    
    # 创建MQTT客户端
    client = mqtt.Client(client_id=CLIENT_ID, clean_session=True, protocol=mqtt.MQTTv311)
    
    # 启用调试日志
    client.enable_logger()
    
    # 设置回调函数
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_publish = on_publish
    client.on_subscribe = on_subscribe
    client.on_disconnect = on_disconnect
    client.on_log = on_log
    
    # 设置用户名和密码
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    
    try:
        # 连接到MQTT broker
        print("正在连接...")
        result = client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
        print(f"连接结果: {result}")
        
        # 开始网络循环
        client.loop_start()
        
        # 等待连接成功
        time.sleep(2)
        
        # 发布测试消息
        print("\n发布测试消息...")
        payload = json.dumps({"test": "message", "time": time.time()})
        result = client.publish("test/topic", payload, qos=1)
        print(f"发布结果: {result}")
        
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
