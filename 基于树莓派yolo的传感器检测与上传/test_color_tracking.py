#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""摄像头颜色追踪调试工具 - 纯后台运行，集成云台控制"""

import cv2
import numpy as np
import time
import sys
import os
import logging

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PROJECT_ROOT)

from picamera2 import Picamera2
import libcamera
from drivers.actuators.servo import PanTiltController

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)


# 预设颜色阈值
COLOR_PRESETS = {
    "blue":   {"name": "蓝色", "hue_low": 96,  "hue_up": 120, "sat_low": 157, "val_low": 100},
    "red":    {"name": "红色", "hue_low": 0,   "hue_up": 10,  "sat_low": 157, "val_low": 100},
    "green":  {"name": "绿色", "hue_low": 35,  "hue_up": 80,  "sat_low": 157, "val_low": 100},
    "yellow": {"name": "黄色", "hue_low": 20,  "hue_up": 35,  "sat_low": 157, "val_low": 100},
    "orange": {"name": "橙色", "hue_low": 10,  "hue_up": 25,  "sat_low": 157, "val_low": 100},
}


def test_tracking(color="blue", duration=10, save_images=True, enable_servo=True):
    """测试颜色追踪（纯日志输出 + 云台控制）
    
    Args:
        color: 颜色预设名称
        duration: 测试持续时间（秒）
        save_images: 是否保存追踪结果图片
        enable_servo: 是否启用云台追踪
    
    Returns:
        是否检测到目标
    """
    preset = COLOR_PRESETS.get(color, COLOR_PRESETS["blue"])
    
    logger.info("=" * 50)
    logger.info(f"颜色追踪测试 - {preset['name']}")
    logger.info(f"持续时间: {duration}秒 | 云台追踪: {'开启' if enable_servo else '关闭'}")
    logger.info("=" * 50)
    
    # 初始化摄像头
    picamera = Picamera2()
    config = picamera.create_preview_configuration(
        main={"format": 'RGB888', "size": (320, 240)}
    )
    config["transform"] = libcamera.Transform(hflip=0, vflip=1)
    picamera.configure(config)
    picamera.start()
    time.sleep(0.5)
    logger.info("摄像头初始化成功")
    
    # 初始化云台
    pan_tilt = None
    if enable_servo:
        pan_tilt = PanTiltController(pan_channel=0, tilt_channel=1, config={
            "min_angle": 0,
            "max_angle": 180,
            "default_angle": 90,
            "pan_inverted": False,
            "tilt_inverted": False,
        })
        if pan_tilt.initialize():
            logger.info("云台初始化成功")
        else:
            logger.warning("云台初始化失败，仅做颜色追踪")
            pan_tilt = None
    
    # HSV 阈值
    h_low = preset["hue_low"]
    h_up = preset["hue_up"]
    s_low = preset["sat_low"]
    v_low = preset["val_low"]
    s_high = 255
    v_high = 255
    min_area = 50
    
    # 云台追踪参数
    dead_zone = 15       # 死区（像素），偏差小于此值不移动
    gain = 75.0          # 增益系数，值越大移动越慢
    
    logger.info(f"HSV 阈值: H:{h_low}-{h_up} S:{s_low}-{s_high} V:{v_low}-{v_high}")
    logger.info(f"云台参数: 死区={dead_zone}px 增益={gain}")
    
    # 创建输出目录
    output_dir = os.path.join(PROJECT_ROOT, "tracking_output")
    if save_images and not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    logger.info(f"开始追踪...（将{preset['name']}物体放在摄像头前）")
    
    start_time = time.time()
    detection_count = 0
    total_frames = 0
    detection_positions = []
    saved_count = 0
    last_log_time = 0
    
    while time.time() - start_time < duration:
        # 捕获帧
        frame = picamera.capture_array()
        if frame is None:
            continue
        
        total_frames += 1
        elapsed = time.time() - start_time
        
        # 转换到HSV
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        
        # 创建掩码
        lower = np.array([h_low, s_low, v_low])
        upper = np.array([h_up, s_high, v_high])
        mask = cv2.inRange(hsv, lower, upper)
        
        # 形态学操作去噪
        mask = cv2.erode(mask, None, iterations=2)
        mask = cv2.dilate(mask, None, iterations=2)
        
        # 查找轮廓
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        
        detected = False
        
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < min_area:
                continue
            
            (x, y, w, h) = cv2.boundingRect(cnt)
            obj_x = x + w // 2
            obj_y = y + h // 2
            error_x = obj_x - 160  # 320/2
            error_y = obj_y - 120  # 240/2
            
            detection_count += 1
            detection_positions.append((obj_x, obj_y, area))
            detected = True
            
            # 云台控制
            servo_moved = ""
            if pan_tilt:
                pan_delta = 0
                tilt_delta = 0
                
                if abs(error_x) > dead_zone:
                    pan_delta = error_x / gain
                
                if abs(error_y) > dead_zone:
                    tilt_delta = error_y / gain
                
                if pan_delta != 0 or tilt_delta != 0:
                    success, cur_pan, cur_tilt = pan_tilt.move(pan_delta, tilt_delta)
                    if success:
                        servo_moved = f" 云台->(pan={cur_pan:.0f} tilt={cur_tilt:.0f})"
            
            # 日志输出（每秒输出一次）
            if elapsed - last_log_time >= 1.0 or elapsed < 1:
                logger.info(f"[{elapsed:.1f}s] 检测: x={obj_x} y={obj_y} 面积={area:.0f} 偏差=({error_x},{error_y}){servo_moved}")
                last_log_time = elapsed
            
            # 每秒保存一张图片
            if save_images and int(elapsed) > saved_count:
                saved_count = int(elapsed)
                result_frame = frame.copy()
                cv2.rectangle(result_frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
                cv2.circle(result_frame, (obj_x, obj_y), 5, (0, 0, 255), -1)
                # 画十字线
                cv2.line(result_frame, (160, 0), (160, 240), (255, 255, 0), 1)
                cv2.line(result_frame, (0, 120), (320, 120), (255, 255, 0), 1)
                info_text = f"({obj_x},{obj_y}) A={area:.0f} err=({error_x},{error_y})"
                cv2.putText(result_frame, info_text, (5, 15),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 0), 1)
                
                img_path = os.path.join(output_dir, f"track_{color}_{saved_count}.jpg")
                cv2.imwrite(img_path, result_frame)
            
            break
        
        if not detected and elapsed - last_log_time >= 1.0:
            logger.info(f"[{elapsed:.1f}s] 未检测到目标")
            last_log_time = elapsed
    
    # 保存最终结果图
    if save_images:
        final_path = os.path.join(output_dir, f"final_{color}.jpg")
        cv2.imwrite(final_path, frame)
    
    # 重置云台
    if pan_tilt:
        pan_tilt.reset()
        logger.info("云台已重置到中心位置")
        pan_tilt.cleanup()
    
    picamera.stop()
    
    # 统计结果
    logger.info("=" * 50)
    logger.info("测试结果汇总")
    logger.info("=" * 50)
    logger.info(f"总帧数: {total_frames}")
    detect_rate = detection_count / max(total_frames, 1) * 100
    logger.info(f"检测到: {detection_count} 次 ({detect_rate:.1f}%)")
    
    if detection_positions:
        xs = [p[0] for p in detection_positions]
        ys = [p[1] for p in detection_positions]
        areas = [p[2] for p in detection_positions]
        
        logger.info(f"目标位置统计:")
        logger.info(f"  X 范围: {min(xs)}-{max(xs)} (平均: {sum(xs)/len(xs):.0f})")
        logger.info(f"  Y 范围: {min(ys)}-{max(ys)} (平均: {sum(ys)/len(ys):.0f})")
        logger.info(f"  面积范围: {min(areas):.0f}-{max(areas):.0f} (平均: {sum(areas)/len(areas):.0f})")
        
        # 中心偏差统计
        center_errors_x = [abs(p[0] - 160) for p in detection_positions]
        center_errors_y = [abs(p[1] - 120) for p in detection_positions]
        avg_err_x = sum(center_errors_x) / len(center_errors_x)
        avg_err_y = sum(center_errors_y) / len(center_errors_y)
        logger.info(f"  平均中心偏差: X={avg_err_x:.0f}px Y={avg_err_y:.0f}px")
        
        if avg_err_x < 30 and avg_err_y < 30:
            logger.info("  追踪效果: 优秀（目标基本在中心）")
        elif avg_err_x < 80 and avg_err_y < 80:
            logger.info("  追踪效果: 良好（目标接近中心）")
        else:
            logger.info("  追踪效果: 需调整（目标偏离中心较多）")
    
    if save_images:
        logger.info(f"图片已保存到: {output_dir}/")
    
    return detection_count > 0


def test_all_colors(duration=5):
    """测试所有预设颜色
    
    Args:
        duration: 每种颜色测试时间（秒）
    """
    logger.info("=" * 50)
    logger.info("全颜色扫描测试（不启动云台）")
    logger.info("=" * 50)
    
    results = {}
    
    for color_key, preset in COLOR_PRESETS.items():
        logger.info(f">>> 测试 {preset['name']} ({color_key}) - {duration}秒 <<<")
        success = test_tracking(color=color_key, duration=duration, save_images=False, enable_servo=False)
        results[color_key] = success
        time.sleep(1)
    
    logger.info("=" * 50)
    logger.info("全颜色扫描结果")
    logger.info("=" * 50)
    
    for color, success in results.items():
        status = "检测到" if success else "未检测到"
        logger.info(f"  {COLOR_PRESETS[color]['name']} ({color}): {status}")
    
    detected = [c for c, s in results.items() if s]
    if detected:
        logger.info(f"推荐使用颜色: {', '.join(detected)}")


def main():
    """主函数"""
    logger.info("摄像头颜色追踪调试工具 (云台追踪版)")
    
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        
        if cmd == "all":
            # 扫描所有颜色（不启动云台）
            duration = int(sys.argv[2]) if len(sys.argv) > 2 else 5
            test_all_colors(duration)
            
        elif cmd in COLOR_PRESETS:
            # 测试指定颜色（启动云台）
            duration = int(sys.argv[2]) if len(sys.argv) > 2 else 10
            test_tracking(color=cmd, duration=duration, enable_servo=True)
            
        elif cmd == "noservo":
            # 只测试颜色追踪，不启动云台
            color = sys.argv[2] if len(sys.argv) > 2 else "blue"
            duration = int(sys.argv[3]) if len(sys.argv) > 3 else 10
            test_tracking(color=color, duration=duration, enable_servo=False)
            
        elif cmd == "help":
            logger.info("用法:")
            logger.info(f"  python3 {sys.argv[0]} <颜色> [秒数]      # 颜色追踪+云台控制")
            logger.info(f"  python3 {sys.argv[0]} noservo <颜色> [秒] # 仅颜色追踪，不动云台")
            logger.info(f"  python3 {sys.argv[0]} all [秒数]          # 扫描所有颜色")
            logger.info("可选颜色:")
            for k, v in COLOR_PRESETS.items():
                logger.info(f"  {k} - {v['name']}")
            logger.info("示例:")
            logger.info(f"  python3 {sys.argv[0]} blue 15        # 蓝色追踪+云台 15秒")
            logger.info(f"  python3 {sys.argv[0]} noservo blue 10 # 仅蓝色追踪 10秒")
            
        else:
            logger.warning(f"未知命令: {cmd}")
            logger.warning(f"运行 'python3 {sys.argv[0]} help' 查看用法")
    else:
        logger.info("默认测试蓝色追踪+云台控制（15秒）")
        logger.info("将蓝色物体放在摄像头前并缓慢移动...")
        time.sleep(2)
        test_tracking(color="blue", duration=15, enable_servo=True)


if __name__ == "__main__":
    main()
