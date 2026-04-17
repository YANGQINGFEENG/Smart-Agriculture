/**
 ****************************************************************************************************
 * @file        system.h
 * @author      Embedded System Team
 * @version     V1.0.0
 * @date        2026-04-18
 * @brief       系统基础服务头文件 - 提供系统tick和时间相关功能
 ****************************************************************************************************
 */

#ifndef __SYSTEM_H
#define __SYSTEM_H

#include "stm32f10x.h"

#ifdef __cplusplus
extern "C" {
#endif

/* ==================================== 类型定义 ==================================== */

typedef uint32_t tick_t;

/* ==================================== 函数声明 ==================================== */

/**
 * @brief  初始化系统tick定时器
 * @retval 无
 */
void sys_tick_init(void);

/**
 * @brief  获取当前系统tick值（毫秒）
 * @retval 当前系统tick值
 */
tick_t sys_get_tick(void);

/**
 * @brief  计算两个tick值的差值
 * @param  tick_start: 起始tick值
 * @param  tick_end: 结束tick值
 * @retval tick差值（毫秒）
 */
tick_t sys_get_tick_diff(tick_t tick_start, tick_t tick_end);

/**
 * @brief  SysTick中断处理函数（需在stm32f10x_it.c中调用）
 * @retval 无
 */
void sys_tick_inc(void);

#ifdef __cplusplus
}
#endif

#endif
