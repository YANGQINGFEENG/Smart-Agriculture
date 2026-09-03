#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""智慧农业硬件系统 - 统一入口

提供命令行控制：
    python main.py start               启动系统（带终端交互界面）
    python main.py start --no-ui      启动系统（无界面后台模式）
    python main.py scan               扫描已连接的硬件设备
    python main.py scan --save        扫描并保存结果到配置文件
    python main.py status             查看系统运行状态
    python main.py config [key]       查看配置（不指定 key 则查看全部）
    python main.py config upload.interval 30   修改指定配置项
    python main.py ota check          检查是否有可用更新
    python main.py ota update         执行升级流程
    python main.py ota rollback        回滚到上一版本
    python main.py ota status         查看 OTA 状态
    python main.py version            显示版本信息
"""

import os
import sys
import argparse
import json
import logging
import traceback
from typing import Optional

# 将项目根目录加入 sys.path，确保任意位置都能正确导入
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)


def _setup_minimal_logger():
    """在系统启动前先配置一个最小的根日志器"""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def _print_section(title: str):
    """打印分隔小节标题"""
    print(f"\n{'-' * 60}")
    print(f"  {title}")
    print(f"{'-' * 60}")


def _print_kv(key: str, value, indent: int = 0):
    """格式化打印键值对"""
    prefix = "  " * indent
    if isinstance(value, (dict, list)):
        print(f"{prefix}{key}:")
        print(f"{prefix}  {json.dumps(value, ensure_ascii=False, indent=2, default=str)}")
    else:
        print(f"{prefix}{key}: {value}")


# ===================================================================
# 命令处理函数
# ===================================================================

def cmd_start(args) -> int:
    """启动系统"""
    from app.system import System
    from cli.cli_interface import CLIInterface

    # 默认启动终端交互界面，--no-ui 为后台模式
    enable_cli = not args.no_ui
    enable_ui = False  # 不再使用图形 UI

    system = System(config_dir=args.config_dir, enable_ui=enable_ui)

    try:
        if enable_cli:
            # 终端模式：启动服务后立即返回，由 CLI 接管交互
            system.start()
            cli = CLIInterface(system)
            cli.run()
        else:
            # 后台模式：启动服务并进入主循环
            system.start()
        
        return 0
    except KeyboardInterrupt:
        print("\n收到中断信号，正在停止...")
        system.stop()
        return 0
    except Exception as e:
        logging.error(f"系统启动失败: {e}")
        traceback.print_exc()
        return 1


def cmd_scan(args) -> int:
    """扫描设备"""
    from core.config_manager import ConfigManager
    from scanner.device_scanner import DeviceScanner

    config = ConfigManager(args.config_dir)
    scanner_config = config.get("scanner", {}) or {}

    print(f"\n开始扫描设备...")
    print(f"启用接口: {scanner_config.get('enabled_interfaces', [])}")

    scanner = DeviceScanner(scanner_config)

    # 设置进度回调
    def on_progress(interface: str, current: int, total: int):
        print(f"  [{current}/{total}] 扫描 {interface} ...")

    scanner.set_progress_callback(on_progress)

    results = scanner.scan_all()

    _print_section("扫描结果")
    if not results:
        print("  未发现任何设备")
        return 0

    print(f"  共发现 {len(results)} 个设备：\n")
    print(f"  {'接口':<10}{'地址':<15}{'类型':<15}{'名称':<25}{'置信度':<10}")
    print(f"  {'-' * 75}")
    for r in results:
        print(f"  {r.interface:<10}{r.address:<15}{r.device_type:<15}{r.name:<25}{r.confidence:.0%}")

    # 转换为配置并保存
    if args.save:
        sensor_configs = scanner.to_config_sensors(results)
        existing = config.get_sensors()
        existing_ids = {s.get("id") for s in existing}

        added = 0
        for new_sensor in sensor_configs:
            if new_sensor["id"] not in existing_ids:
                existing.append(new_sensor)
                added += 1

        if added > 0:
            config.update("sensors", existing)
            print(f"\n  已保存 {added} 个新设备到 config/sensors.yaml")
        else:
            print(f"\n  无新设备需要保存")

    return 0


def cmd_status(args) -> int:
    """查看系统状态"""
    from app.system import System

    # 仅初始化系统（不启动）
    system = System(config_dir=args.config_dir, enable_ui=False)
    status = system.get_status()

    _print_section("系统状态")
    _print_kv("版本", status.get("version"))
    _print_kv("项目路径", status.get("project_root"))
    _print_kv("运行状态", "运行中" if status.get("running") else "已停止")

    _print_section("传感器")
    sensors = status.get("sensors", {})
    if sensors:
        for sid, s in sensors.items():
            print(f"  - {sid}: {s}")
    else:
        print("  无已加载传感器")

    _print_section("执行器")
    actuators = status.get("actuators", {})
    if actuators:
        for aid, a in actuators.items():
            print(f"  - {aid}: {a}")
    else:
        print("  无已加载执行器")

    _print_section("上传服务")
    upload = status.get("upload") or {}
    _print_kv("服务器地址", upload.get("server_url"))
    _print_kv("网关 IP", upload.get("gateway_ip"))
    _print_kv("农场 ID", upload.get("farm_id"))
    _print_kv("上传间隔", f"{upload.get('interval')} 秒")
    _print_kv("最后上传", upload.get("last_upload_time") or "从未")
    _print_kv("最后状态", upload.get("last_upload_status") or "未知")
    _print_kv("失败次数", upload.get("fail_count", 0))
    _print_kv("缓存数", upload.get("cache_count", 0))

    _print_section("OTA 升级")
    ota = status.get("ota") or {}
    _print_kv("当前状态", ota.get("status"))
    _print_kv("当前版本", ota.get("current_version"))
    _print_kv("主模式", ota.get("primary_mode"))
    _print_kv("已启用模式", ota.get("enabled_modes"))
    _print_kv("自动检查", "启用" if ota.get("auto_check_enabled") else "禁用")
    if ota.get("last_error"):
        _print_kv("最后错误", ota.get("last_error"))

    _print_section("心跳服务")
    hb = status.get("heartbeat") or {}
    _print_kv("心跳状态", "运行中" if hb.get("running") else "已停止")
    _print_kv("心跳间隔", f"{hb.get('interval')} 秒")

    return 0


def cmd_config(args) -> int:
    """查看或修改配置"""
    from core.config_manager import ConfigManager

    config = ConfigManager(args.config_dir)

    if not args.key:
        # 显示全部配置
        all_config = config.to_dict()
        _print_section("当前配置")
        print(json.dumps(all_config, ensure_ascii=False, indent=2, default=str))
        return 0

    if args.value is None:
        # 查看指定配置项
        value = config.get(args.key)
        if value is None:
            print(f"配置项 '{args.key}' 不存在")
            return 1
        if isinstance(value, (dict, list)):
            print(json.dumps(value, ensure_ascii=False, indent=2, default=str))
        else:
            print(value)
        return 0

    # 修改配置项
    # 尝试解析为对应类型
    parsed_value = args.value
    if args.value.lower() in ("true", "false"):
        parsed_value = args.value.lower() == "true"
    else:
        try:
            parsed_value = int(args.value)
        except ValueError:
            try:
                parsed_value = float(args.value)
            except ValueError:
                pass  # 保持字符串

    old_value = config.get(args.key)
    config.set(args.key, parsed_value)

    # 持久化到文件
    top_key = args.key.split(".")[0]
    if not config.update(top_key, config.get(top_key)):
        print(f"保存失败")
        return 1

    print(f"配置已更新：")
    print(f"  键:   {args.key}")
    print(f"  旧值: {old_value}")
    print(f"  新值: {parsed_value}")
    print(f"  保存到: config/{_section_to_file(top_key)}")
    return 0


def _section_to_file(section: str) -> str:
    """配置段对应的文件名"""
    mapping = {
        "sensors": "sensors.yaml",
        "actuators": "actuators.yaml",
    }
    return mapping.get(section, "settings.yaml")


def cmd_ota(args) -> int:
    """OTA 升级相关操作"""
    from app.system import System

    system = System(config_dir=args.config_dir, enable_ui=False)
    ota = system.ota_manager

    if args.action == "status":
        status = ota.get_status()
        _print_section("OTA 状态")
        _print_kv("当前状态", status.get("status"))
        _print_kv("当前版本", status.get("current_version"))
        _print_kv("主模式", status.get("primary_mode"))
        _print_kv("已启用模式", status.get("enabled_modes"))
        _print_kv("自动检查", "启用" if status.get("auto_check_enabled") else "禁用")
        if status.get("last_error"):
            _print_kv("最后错误", status.get("last_error"))
        if status.get("last_success_time"):
            _print_kv("上次成功升级", status.get("last_success_time"))
        return 0

    if args.action == "check":
        print("正在检查更新...")
        info = ota.check_update()
        _print_section("检查结果")
        _print_kv("当前版本", info.current_version)
        _print_kv("最新版本", info.latest_version or "未知")
        _print_kv("是否有更新", "是" if info.is_update_available else "否")
        if info.release_notes:
            print(f"\n更新说明：")
            print(info.release_notes)
        return 0

    if args.action == "update":
        print("开始执行升级流程...")

        def progress_cb(status: str, message: str, data: dict):
            print(f"  [{status}] {message}")

        ota.add_progress_callback(progress_cb)
        success = ota.perform_update()
        if success:
            print("\n升级成功！服务即将重启。")
            # 触发重启回调
            if system.config.get("ota.restart_after_update", True):
                system._restart_service()
            return 0
        else:
            print(f"\n升级失败: {ota._last_error}")
            return 1

    if args.action == "rollback":
        if not ota.rollback():
            print(f"回滚失败: {ota._last_error}")
            return 1
        print("回滚成功！服务即将重启。")
        system._restart_service()
        return 0

    print(f"未知 OTA 操作: {args.action}")
    return 1


def cmd_version(args) -> int:
    """显示版本信息"""
    from app.system import System

    _print_section("智慧农业硬件系统")
    _print_kv("系统版本", System.VERSION)
    _print_kv("项目路径", PROJECT_ROOT)

    # 读取 VERSION 文件
    version_file = os.path.join(PROJECT_ROOT, "VERSION")
    if os.path.exists(version_file):
        with open(version_file, "r", encoding="utf-8") as f:
            _print_kv("VERSION 文件", f.read().strip())

    # Python 版本
    _print_kv("Python 版本", sys.version.split()[0])
    return 0


# ===================================================================
# 参数解析
# ===================================================================

def build_parser() -> argparse.ArgumentParser:
    """构建命令行参数解析器"""
    parser = argparse.ArgumentParser(
        prog="smart-farm",
        description="智慧农业硬件系统 - 统一入口",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python main.py start                     # 启动系统（带触摸屏 UI）
  python main.py start --no-ui             # 启动系统（仅命令行）
  python main.py scan                      # 扫描设备
  python main.py scan --save               # 扫描并保存到配置
  python main.py status                    # 查看系统状态
  python main.py config                    # 查看全部配置
  python main.py config upload.interval    # 查看上传间隔
  python main.py config upload.interval 60  # 修改上传间隔为 60 秒
  python main.py ota check                 # 检查 OTA 更新
  python main.py ota update                # 执行升级
  python main.py ota rollback              # 回滚到上一版本
  python main.py version                   # 显示版本信息
""",
    )

    # 全局参数
    parser.add_argument(
        "--config-dir",
        default=None,
        help="配置文件目录（默认: ./config）",
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    # start 命令
    start_parser = subparsers.add_parser("start", help="启动系统")
    start_parser.add_argument(
        "--no-ui",
        action="store_true",
        help="不启动触摸屏 UI，仅命令行模式",
    )
    start_parser.set_defaults(func=cmd_start)

    # scan 命令
    scan_parser = subparsers.add_parser("scan", help="扫描已连接的硬件设备")
    scan_parser.add_argument(
        "--save",
        action="store_true",
        help="扫描完成后保存结果到 config/sensors.yaml",
    )
    scan_parser.set_defaults(func=cmd_scan)

    # status 命令
    status_parser = subparsers.add_parser("status", help="查看系统运行状态")
    status_parser.set_defaults(func=cmd_status)

    # config 命令
    config_parser = subparsers.add_parser("config", help="查看或修改配置")
    config_parser.add_argument(
        "key",
        nargs="?",
        default=None,
        help="配置键（如 upload.interval），不指定则查看全部",
    )
    config_parser.add_argument(
        "value",
        nargs="?",
        default=None,
        help="配置值（不指定则仅查看）",
    )
    config_parser.set_defaults(func=cmd_config)

    # ota 命令
    ota_parser = subparsers.add_parser("ota", help="OTA 升级操作")
    ota_parser.add_argument(
        "action",
        choices=["check", "update", "rollback", "status"],
        help="操作: check=检查更新, update=执行升级, rollback=回滚, status=查看状态",
    )
    ota_parser.set_defaults(func=cmd_ota)

    # version 命令
    version_parser = subparsers.add_parser("version", help="显示版本信息")
    version_parser.set_defaults(func=cmd_version)

    return parser


def main() -> int:
    """主入口"""
    _setup_minimal_logger()

    parser = build_parser()
    args = parser.parse_args()

    if not hasattr(args, "func"):
        parser.print_help()
        return 0

    try:
        return args.func(args)
    except KeyboardInterrupt:
        print("\n操作被中断")
        return 130
    except Exception as e:
        logging.error(f"命令执行失败: {e}")
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
