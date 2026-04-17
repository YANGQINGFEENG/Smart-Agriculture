/**
 ****************************************************************************************************
 * @file        system.c
 * @author      Embedded System Team
 * @version     V1.0.0
 * @date        2026-04-18
 * @brief       系统基础服务实现 - 提供系统tick和时间相关功能
 ****************************************************************************************************
 */

#include "system.h"

/* ==================================== 静态变量 ==================================== */

static volatile tick_t g_sys_tick = 0;

/* ==================================== 公共函数实现 ==================================== */

/**
 * @brief  初始化系统tick定时器
 * @note   配置SysTick为1ms中断一次
 * @retval 无
 */
void sys_tick_init(void)
{
    g_sys_tick = 0;
    SysTick_Config(SystemCoreClock / 1000);
}

/**
 * @brief  获取当前系统tick值（毫秒）
 * @retval 当前系统tick值
 */
tick_t sys_get_tick(void)
{
    return g_sys_tick;
}

/**
 * @brief  计算两个tick值的差值
 * @param  tick_start: 起始tick值
 * @param  tick_end: 结束tick值
 * @retval tick差值（毫秒），自动处理uint32_t溢出
 */
tick_t sys_get_tick_diff(tick_t tick_start, tick_t tick_end)
{
    if (tick_end >= tick_start) {
        return tick_end - tick_start;
    } else {
        return (0xFFFFFFFF - tick_start) + tick_end + 1;
    }
}

/**
 * @brief  SysTick中断处理函数
 * @note   需在stm32f10x_it.c的SysTick_Handler中调用
 * @retval 无
 */
void sys_tick_inc(void)
{
    g_sys_tick++;
}
