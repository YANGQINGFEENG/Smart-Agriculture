#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""终端交互界面 - 提供命令行操作接口"""

import os
import sys
import time
import json
from typing import Dict, List
from utils.systemd_utils import (
    is_service_enabled, enable_service, disable_service,
    is_service_running, get_service_status
)


class CLIInterface:
    """终端交互界面"""
    
    def __init__(self, system=None):
        self.system = system
        self.running = True
        self.commands = {
            'help': self.cmd_help,
            'status': self.cmd_status,
            'config': self.cmd_config,
            'upload': self.cmd_upload,
            'actuator': self.cmd_actuator,
            'sensor': self.cmd_sensor,
            'autostart': self.cmd_autostart,
            'quit': self.cmd_quit,
            'exit': self.cmd_quit,
            'clear': self.cmd_clear
        }
    
    def run(self):
        """运行终端交互界面"""
        self._print_banner()
        self._print_help()
        
        while self.running:
            try:
                cmd = input('\n> ').strip()
                if not cmd:
                    continue
                
                parts = cmd.split()
                command = parts[0].lower()
                args = parts[1:]
                
                if command in self.commands:
                    self.commands[command](args)
                else:
                    print(f"未知命令: {command}，输入 'help' 查看帮助")
            except KeyboardInterrupt:
                print("\n程序退出中...")
                self.running = False
            except Exception as e:
                print(f"命令执行错误: {e}")
    
    def _print_banner(self):
        """打印欢迎横幅"""
        banner = """
╔════════════════════════════════════════════════════════════════╗
║                    智慧农业硬件系统 v2.0.0                      ║
║                终端管理界面 - 树莓派传感器检测与上传             ║
╚════════════════════════════════════════════════════════════════╝
        """
        print(banner)
    
    def _print_help(self):
        """打印帮助信息"""
        help_text = """
可用命令:
  help                 - 显示帮助信息
  status               - 查看系统状态
  config [list|set]    - 查看或修改配置
                         config list              - 列出所有配置
                         config set <key> <value> - 设置配置项
                         config set upload_interval <秒>    - 设置上传间隔
                         config set server_host <地址>       - 设置服务器地址
                         config set server_port <端口>       - 设置服务器端口
  upload [test]        - 手动触发数据上传
                         upload test              - 测试服务器连接
  actuator <id> <cmd>  - 控制执行器
                         actuator relay on/off
                         actuator laser on/off/value <0-100>
                         actuator rgb_led on/off/value <0-100>
  sensor [list|read]   - 查看传感器
                         sensor list             - 列出所有传感器
                         sensor read <id>        - 读取传感器数据
  autostart [on|off]   - 设置开机自启
                         autostart on            - 开启开机自启
                         autostart off           - 关闭开机自启
                         autostart status        - 查看自启状态
  clear                - 清屏
  quit/exit            - 退出程序
        """
        print(help_text)
    
    def cmd_help(self, args):
        """显示帮助信息"""
        self._print_help()
    
    def cmd_status(self, args):
        """查看系统状态"""
        print("\n" + "="*50)
        print("系统状态")
        print("="*50)
        
        # 传感器状态
        print("\n[传感器状态]")
        if self.system and hasattr(self.system, 'sensors'):
            for sensor_id, sensor in self.system.sensors.items():
                status = "✅ 正常" if sensor._initialized else "❌ 未初始化"
                last_value = sensor._last_value if sensor._last_value else "无数据"
                print(f"  {sensor_id}: {sensor.name} - {status} - 最新值: {last_value}")
        else:
            print("  传感器未加载")
        
        # 执行器状态
        print("\n[执行器状态]")
        if self.system and hasattr(self.system, 'actuators'):
            for actuator_id, actuator in self.system.actuators.items():
                status = "✅ 正常" if actuator._initialized else "❌ 未初始化"
                state = actuator._state.value if actuator._state else "未知"
                print(f"  {actuator_id}: {actuator.name} - {status} - 状态: {state}")
        else:
            print("  执行器未加载")
        
        # WebSocket 状态
        print("\n[网络状态]")
        ws_status = "❌ 未连接"
        if self.system and hasattr(self.system, '_websocket_service'):
            ws = self.system._websocket_service
            ws_status = "✅ 已连接" if ws.is_connected() else "❌ 未连接"
        print(f"  WebSocket: {ws_status}")
        
        # 开机自启状态
        print("\n[开机自启]")
        try:
            enabled = is_service_enabled()
            running = is_service_running()
            status = get_service_status()
            print(f"  服务状态: {status}")
            print(f"  开机自启: {'✅ 已启用' if enabled else '❌ 未启用'}")
            print(f"  当前运行: {'✅ 是' if running else '❌ 否'}")
        except Exception as e:
            print(f"  无法获取服务状态: {e}")
        
        # 配置信息
        print("\n[配置信息]")
        if self.system and hasattr(self.system, 'config'):
            config = self.system.config
            upload_interval = config.get('upload', {}).get('interval', 30)
            server_url = config.get('server', {}).get('url', '未设置')
            print(f"  上传间隔: {upload_interval}秒")
            print(f"  服务器地址: {server_url}")
        
        print("\n" + "="*50)
    
    def cmd_config(self, args):
        """查看或修改配置"""
        if not args:
            print("用法: config [list|set]")
            return
        
        sub_cmd = args[0].lower()
        
        if sub_cmd == 'list':
            self._config_list()
        elif sub_cmd == 'set':
            if len(args) >= 3:
                self._config_set(args[1], ' '.join(args[2:]))
            else:
                print("用法: config set <key> <value>")
    
    def _config_list(self):
        """列出所有配置"""
        print("\n" + "="*50)
        print("配置列表")
        print("="*50)
        
        if self.system and hasattr(self.system, 'config'):
            config = self.system.config
            # 上传配置
            upload = config.get('upload', {})
            print("\n[上传配置]")
            print(f"  upload_interval: {upload.get('interval', 30)}秒")
            print(f"  timeout: {upload.get('timeout', 10)}秒")
            
            # 服务器配置
            server = config.get('server', {})
            print("\n[服务器配置]")
            print(f"  url: {server.get('url', '未设置')}")
            print(f"  host: {server.get('host', 'localhost')}")
            print(f"  port: {server.get('port', 8080)}")
            
            # 心跳配置
            heartbeat = config.get('heartbeat', {})
            print("\n[心跳配置]")
            print(f"  interval: {heartbeat.get('interval', 30)}秒")
            
            # WebSocket配置
            ws = config.get('websocket', {})
            print("\n[WebSocket配置]")
            print(f"  enabled: {ws.get('enabled', True)}")
            print(f"  reconnect_delay: {ws.get('reconnect_delay', 1)}秒")
        
        print("\n" + "="*50)
    
    def _config_set(self, key, value):
        """设置配置项"""
        if not self.system or not hasattr(self.system, 'config'):
            print("错误: 系统未初始化")
            return
        
        config = self.system.config
        
        # 解析配置键路径
        key_map = {
            'upload_interval': ('upload', 'interval'),
            'server_host': ('server', 'host'),
            'server_port': ('server', 'port'),
            'server_url': ('server', 'url'),
            'heartbeat_interval': ('heartbeat', 'interval'),
            'upload_timeout': ('upload', 'timeout'),
        }
        
        if key in key_map:
            section, field = key_map[key]
            # 转换数值类型
            try:
                if field in ['interval', 'port', 'timeout']:
                    value = int(value)
                else:
                    value = value.strip()
            except ValueError:
                print(f"错误: {key} 必须是整数")
                return
            
            # 更新配置
            if section not in config.data:
                config.data[section] = {}
            config.data[section][field] = value
            
            # 保存配置
            config.save()
            
            # 如果是上传间隔，更新系统
            if key == 'upload_interval' and hasattr(self.system, '_upload_interval'):
                self.system._upload_interval = value
                print(f"已更新上传间隔为 {value} 秒，下次采集生效")
            
            print(f"配置已更新: {key} = {value}")
        else:
            print(f"未知配置项: {key}")
            print("可用配置项: upload_interval, server_host, server_port, server_url, heartbeat_interval, upload_timeout")
    
    def cmd_upload(self, args):
        """手动触发数据上传"""
        if not args:
            # 手动上传
            if self.system and hasattr(self.system, '_upload_data'):
                print("正在手动上传数据...")
                success = self.system._upload_data()
                print("上传成功" if success else "上传失败")
            else:
                print("错误: 系统未初始化")
        elif args[0].lower() == 'test':
            # 测试服务器连接
            self._test_connection()
    
    def _test_connection(self):
        """测试服务器连接"""
        print("正在测试服务器连接...")
        if self.system and hasattr(self.system, 'upload'):
            try:
                # 尝试获取命令来测试连接
                server_url = self.system.config.get('server', {}).get('url', '')
                if not server_url:
                    print("错误: 服务器地址未设置")
                    return
                
                # 发送心跳测试连接
                if hasattr(self.system, '_send_heartbeat'):
                    success = self.system._send_heartbeat()
                    if success:
                        print(f"✅ 服务器连接成功: {server_url}")
                    else:
                        print(f"❌ 服务器连接失败: {server_url}")
                else:
                    print("无法测试连接")
            except Exception as e:
                print(f"连接测试失败: {e}")
    
    def cmd_actuator(self, args):
        """控制执行器"""
        if len(args) < 2:
            print("用法: actuator <id> <command> [value]")
            print("执行器ID: relay, laser, rgb_led")
            print("命令: on, off, value")
            return
        
        actuator_id = args[0]
        command = args[1].lower()
        value = args[2] if len(args) > 2 else None
        
        if self.system and hasattr(self.system, 'actuators'):
            actuator = self.system.actuators.get(actuator_id)
            if not actuator:
                print(f"未知执行器: {actuator_id}")
                print(f"可用执行器: {list(self.system.actuators.keys())}")
                return
            
            if not actuator._initialized:
                print(f"执行器 {actuator_id} 未初始化")
                return
            
            print(f"正在控制 {actuator.name} ({actuator_id}) -> {command}")
            
            success = False
            if command == 'on':
                success = actuator.turn_on()
            elif command == 'off':
                success = actuator.turn_off()
            elif command == 'value' and value is not None:
                try:
                    int_value = int(value)
                    if hasattr(actuator, 'set_value'):
                        success = actuator.set_value(int_value)
                    else:
                        print(f"执行器 {actuator_id} 不支持 value 命令")
                except ValueError:
                    print("value 必须是整数")
            
            if success:
                print(f"✅ 执行成功")
            else:
                print(f"❌ 执行失败")
        else:
            print("错误: 系统未初始化")
    
    def cmd_sensor(self, args):
        """查看传感器"""
        if not args:
            print("用法: sensor [list|read]")
            return
        
        sub_cmd = args[0].lower()
        
        if sub_cmd == 'list':
            print("\n" + "="*50)
            print("传感器列表")
            print("="*50)
            if self.system and hasattr(self.system, 'sensors'):
                for sensor_id, sensor in self.system.sensors.items():
                    status = "✅" if sensor._initialized else "❌"
                    print(f"  {status} {sensor_id}: {sensor.name}")
            print("\n" + "="*50)
        
        elif sub_cmd == 'read':
            if len(args) < 2:
                print("用法: sensor read <id>")
                return
            
            sensor_id = args[1]
            if self.system and hasattr(self.system, 'sensors'):
                sensor = self.system.sensors.get(sensor_id)
                if not sensor:
                    print(f"未知传感器: {sensor_id}")
                    return
                
                if not sensor._initialized:
                    print(f"传感器 {sensor_id} 未初始化")
                    return
                
                data = sensor.read()
                print(f"\n{sensor.name} ({sensor_id}) 数据:")
                print(f"  值: {data.get('value')}")
                print(f"  单位: {data.get('unit')}")
                print(f"  质量: {data.get('quality')}")
            else:
                print("错误: 系统未初始化")
    
    def cmd_autostart(self, args):
        """设置开机自启"""
        if not args:
            print("用法: autostart [on|off|status]")
            return
        
        sub_cmd = args[0].lower()
        
        if sub_cmd == 'status':
            try:
                enabled = is_service_enabled()
                running = is_service_running()
                print(f"\n开机自启: {'✅ 已启用' if enabled else '❌ 未启用'}")
                print(f"当前运行: {'✅ 是' if running else '❌ 否'}")
            except Exception as e:
                print(f"获取状态失败: {e}")
        
        elif sub_cmd == 'on':
            try:
                if enable_service():
                    print("✅ 开机自启已启用")
                else:
                    print("❌ 启用失败，请检查权限")
            except Exception as e:
                print(f"启用失败: {e}")
        
        elif sub_cmd == 'off':
            try:
                if disable_service():
                    print("✅ 开机自启已禁用")
                else:
                    print("❌ 禁用失败，请检查权限")
            except Exception as e:
                print(f"禁用失败: {e}")
    
    def cmd_quit(self, args):
        """退出程序"""
        print("程序退出中...")
        self.running = False
        if self.system and hasattr(self.system, 'stop'):
            self.system.stop()
    
    def cmd_clear(self, args):
        """清屏"""
        os.system('cls' if os.name == 'nt' else 'clear')
        self._print_banner()