/**
 * @file    Delay.h
 * @brief   延时函数头文件
 * @details 定义微秒、毫秒、秒级延时函数
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    基于SysTick定时器实现
 */

#ifndef __DELAY_H
#define __DELAY_H

#include "sys.h"
#include "stm32f10x.h"

/* ==================== 新版延时函数（基于SysTick） ==================== */

/**
 * @brief   微秒级延时
 * @param   us 延时时长，范围：0~233015
 */
void Delay_us(uint32_t us);

/**
 * @brief   毫秒级延时
 * @param   ms 延时时长，范围：0~4294967295
 */
void Delay_ms(uint32_t ms);

/**
 * @brief   秒级延时
 * @param   s 延时时长，范围：0~4294967295
 */
void Delay_s(uint32_t s);

/* ==================== 旧版延时函数（兼容性） ==================== */

/**
 * @brief   初始化延时函数
 * @param   SYSCLK 系统时钟频率（MHz）
 */
void delay_init(uint8_t SYSCLK);

/**
 * @brief   毫秒级延时
 * @param   nms 要延时的ms数
 */
void delay_ms(uint16_t nms);

/**
 * @brief   微秒级延时
 * @param   nus 要延时的us数
 */
void delay_us(uint32_t nus);

#endif
