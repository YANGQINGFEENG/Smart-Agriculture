/**
 * @file    Key.h
 * @brief   按键驱动头文件
 * @details 定义按键初始化和扫描函数
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    基于STM32F103微控制器
 *          KEY0: PC13 (上拉输入，按下为低电平)
 *          WK_UP: PA0 (上拉输入，按下为低电平)
 */

#ifndef __KEY_H
#define __KEY_H

#include "stm32f10x.h"

/* ==================== KEY0 引脚定义 ==================== */

#define KEY0_GPIO_PORT                  GPIOC
#define KEY0_GPIO_PIN                   GPIO_Pin_13
#define KEY0_GPIO_CLK_ENABLE()          RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOC, ENABLE)

/* ==================== WK_UP 引脚定义 ==================== */

#define WKUP_GPIO_PORT                  GPIOA
#define WKUP_GPIO_PIN                   GPIO_Pin_0
#define WKUP_GPIO_CLK_ENABLE()          RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE)

/* ==================== 按键操作宏定义 ==================== */

#define KEY0        GPIO_ReadInputDataBit(KEY0_GPIO_PORT, KEY0_GPIO_PIN)     // 读取KEY0状态
#define WK_UP       GPIO_ReadInputDataBit(WKUP_GPIO_PORT, WKUP_GPIO_PIN)     // 读取WKUP状态

/* ==================== 按键返回值定义 ==================== */

#define KEY0_PRES    1              // KEY0按下
#define WKUP_PRES    2              // KEY_UP按下(即WK_UP)

/* ==================== 函数声明 ==================== */

/**
 * @brief   按键初始化函数
 */
void key_init(void);

/**
 * @brief   按键扫描函数
 * @param   mode: 0/1, 具体含义如下:
 *          @arg 0: 不支持连续按(当按键按下不松开时，只有第一次调用会返回键值，
 *                  必须松开以后，再次按下才会返回键值)
 *          @arg 1: 支持连续按(当按键按下不松开时，每次调用该函数都会返回键值)
 * @return  键值，定义如下:
 *          KEY0_PRES: 1, KEY0按下
 *          WKUP_PRES: 2, WK_UP按下
 */
uint8_t key_scan(uint8_t mode);

#endif
