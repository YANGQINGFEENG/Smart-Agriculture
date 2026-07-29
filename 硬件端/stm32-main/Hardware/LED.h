/**
 * @file    LED.h
 * @brief   LED驱动头文件
 * @details 定义LED初始化和控制函数
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    LED使用GPIOB的PB12和PB13引脚
 */

#ifndef __LED_H
#define __LED_H

#include "stm32f10x.h"

/* ==================== 函数声明 ==================== */

/**
 * @brief   LED初始化
 */
void LED_Init(void);

/**
 * @brief   LED1开启
 */
void LED1_ON(void);

/**
 * @brief   LED1关闭
 */
void LED1_OFF(void);

/**
 * @brief   LED1翻转
 */
void LED1_Turn(void);

/**
 * @brief   LED2开启
 */
void LED2_ON(void);

/**
 * @brief   LED2关闭
 */
void LED2_OFF(void);

/**
 * @brief   LED2翻转
 */
void LED2_Turn(void);

#endif
