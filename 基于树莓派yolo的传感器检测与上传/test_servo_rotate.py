#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""云台独立测试 - 自动旋转后归位"""

import time
import sys
import os
import logging

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PROJECT_ROOT)

from drivers.actuators.servo import PanTiltController

logging.basicConfig(level=logging.INFO, format='%(asctime)s [INFO] %(message)s', datefmt='%H:%M:%S')
logger = logging.getLogger(__name__)


def main():
    """云台旋转测试"""
    logger.info("=" * 40)
    logger.info("云台旋转测试")
    logger.info("=" * 40)

    # 初始化
    pan_tilt = PanTiltController(pan_channel=0, tilt_channel=1, config={
        "min_angle": 0,
        "max_angle": 180,
        "default_angle": 90,
        "pan_inverted": False,
        "tilt_inverted": False,
    })

    if not pan_tilt.initialize():
        logger.error("云台初始化失败")
        return

    logger.info("云台初始化成功，开始旋转测试...")

    # 1. 水平扫描
    logger.info("--- 水平扫描（pan: 0->180->90）---")
    for angle in range(0, 181, 10):
        pan_tilt.set_position(angle, 90)
        logger.info(f"  pan={angle} tilt=90")
        time.sleep(0.3)
    pan_tilt.set_position(90, 90)
    time.sleep(0.5)

    # 2. 垂直扫描
    logger.info("--- 垂直扫描（tilt: 0->180->90）---")
    for angle in range(0, 181, 10):
        pan_tilt.set_position(90, angle)
        logger.info(f"  pan=90 tilt={angle}")
        time.sleep(0.3)
    pan_tilt.set_position(90, 90)
    time.sleep(0.5)

    # 3. 四角扫描
    logger.info("--- 四角扫描 ---")
    corners = [(0, 0), (180, 0), (180, 180), (0, 180), (90, 90)]
    for pan, tilt in corners:
        pan_tilt.set_position(pan, tilt)
        logger.info(f"  pan={pan} tilt={tilt}")
        time.sleep(1)

    # 4. 归位
    logger.info("--- 归位到中心 ---")
    pan_tilt.reset()
    time.sleep(1)
    pos = pan_tilt.get_position()
    logger.info(f"最终位置: pan={pos[0]:.0f} tilt={pos[1]:.0f}")

    pan_tilt.cleanup()
    logger.info("测试完成")


if __name__ == "__main__":
    main()
