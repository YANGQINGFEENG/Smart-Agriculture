/**
 * @file    OLED_Display.h
 * @brief   OLED显示管理头文件
 * @details 智能农业监控系统的OLED显示管理函数声明
 * @author  Smart Agriculture Team
 * @date    2026-04-15
 * @version 1.0.0
 */

#ifndef __OLED_DISPLAY_H
#define __OLED_DISPLAY_H

#include "stm32f10x.h"

/**
 * @brief   初始化OLED显示管理
 * @details 初始化显示相关的变量和状态
 */
void OLED_Display_Init(void);

/**
 * @brief   更新OLED显示
 * @details 根据当前显示模式更新OLED显示内容
 */
void OLED_Display_Update(void);

/**
 * @brief   循环切换显示模式
 * @details 按顺序切换显示模式
 */
void OLED_Display_CycleMode(void);

#endif
