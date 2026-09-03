#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""舵机和摄像头追踪测试脚本"""

import sys
import os

# 添加项目路径
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PROJECT_ROOT)

from drivers.actuators.servo import ServoActuator, PanTiltController
from drivers.camera_tracker import CameraTracker
import time


def test_servo():
    """测试舵机功能"""
    print("=" * 50)
    print("【测试1】舵机测试")
    print("=" * 50)
    
    # 创建云台控制器
    pan_tilt = PanTiltController(pan_channel=0, tilt_channel=1, config={
        "min_angle": 0,
        "max_angle": 180,
        "default_angle": 90,
        "pan_inverted": True,
        "tilt_inverted": True
    })
    
    # 初始化
    print("正在初始化云台...")
    if not pan_tilt.initialize():
        print("❌ 云台初始化失败")
        return False
    
    print("✅ 云台初始化成功")
    
    # 测试移动
    print("\n测试云台移动...")
    test_positions = [
        (45, 45, "左上角"),
        (135, 45, "右上角"),
        (45, 135, "左下角"),
        (135, 135, "右下角"),
        (90, 90, "中心位置"),
    ]
    
    for pan, tilt, name in test_positions:
        print(f"  移动到{name} ({pan}°, {tilt}°)...", end=" ")
        success = pan_tilt.set_position(pan, tilt)
        time.sleep(0.5)
        if success:
            print("✅")
        else:
            print("❌")
    
    # 测试相对移动
    print("\n测试相对移动...")
    pos = pan_tilt.get_position()
    print(f"  当前位置: {pos[0]:.0f}°, {pos[1]:.0f}°")
    
    print("  向右移动10°...", end=" ")
    success, pan, tilt = pan_tilt.move(pan_delta=10)
    print(f"✅ 现在: {pan:.0f}°, {tilt:.0f}°")
    time.sleep(0.5)
    
    print("  向下移动10°...", end=" ")
    success, pan, tilt = pan_tilt.move(tilt_delta=10)
    print(f"✅ 现在: {pan:.0f}°, {tilt:.0f}°")
    time.sleep(0.5)
    
    # 重置
    print("\n重置云台...")
    pan_tilt.reset()
    time.sleep(1)
    
    # 清理
    pan_tilt.cleanup()
    print("✅ 舵机测试完成")
    return True


def test_camera():
    """测试摄像头功能"""
    print("\n" + "=" * 50)
    print("【测试2】摄像头测试")
    print("=" * 50)
    
    # 创建摄像头追踪器
    camera = CameraTracker(config={
        "resolution": (320, 240),
        "vflip": True,
        "tracking": {
            "enabled": True,
            "hue_low": 96,
            "hue_up": 120,
            "sat_low": 157,
            "val_low": 100,
            "min_area": 50,
            "dead_zone": 15,
            "gain": 75
        }
    })
    
    # 初始化
    print("正在初始化摄像头...")
    if not camera.initialize():
        print("❌ 摄像头初始化失败")
        return False
    
    print("✅ 摄像头初始化成功")
    
    # 测试捕获
    print("\n测试帧捕获...")
    frame = camera.capture_frame()
    if frame is not None:
        print(f"✅ 帧捕获成功: {frame.shape}")
    else:
        print("❌ 帧捕获失败")
        camera.cleanup()
        return False
    
    # 测试JPEG
    print("测试JPEG编码...")
    jpeg_data = camera.get_jpeg_frame()
    if jpeg_data:
        print(f"✅ JPEG编码成功: {len(jpeg_data)}字节")
    else:
        print("❌ JPEG编码失败")
    
    # 设置追踪回调
    detection_count = [0]
    def on_detection(result):
        detection_count[0] += 1
        if result.get("found"):
            print(f"  检测到目标: x={result['x']}, y={result['y']}, 面积={result['area']:.0f}")
    
    camera.set_track_callback(on_detection)
    
    # 启动追踪
    print("\n启动颜色追踪（运行5秒）...")
    camera.start_tracking()
    time.sleep(5)
    
    # 停止追踪
    camera.stop_tracking()
    
    print(f"\n检测次数: {detection_count[0]}")
    print("✅ 摄像头测试完成")
    
    # 清理
    camera.cleanup()
    return True


def main():
    """主测试函数"""
    print("\n" + "=" * 50)
    print("树莓派舵机和摄像头追踪测试")
    print("=" * 50)
    
    try:
        # 测试舵机
        servo_ok = test_servo()
        
        # 测试摄像头
        camera_ok = test_camera()
        
        # 汇总
        print("\n" + "=" * 50)
        print("测试汇总")
        print("=" * 50)
        print(f"舵机: {'✅ 通过' if servo_ok else '❌ 失败'}")
        print(f"摄像头: {'✅ 通过' if camera_ok else '❌ 失败'}")
        
    except KeyboardInterrupt:
        print("\n测试已中断")
    except Exception as e:
        print(f"\n测试异常: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
