/**
 ****************************************************************************************************
 * @file        system.c
 * @author      Embedded System Team
 * @version     V2.0.0
 * @date        2026-04-13
 * @brief       系统核心模块实现 - SysTick、任务调度、看门狗
 ****************************************************************************************************
 */

#include "system.h"

/* ==================================== 全局变量 ==================================== */
volatile tick_t g_system_tick = 0;
static task_t *g_task_list[16] = {NULL};  /* 最多支持16个任务 */
static uint8_t g_task_count = 0;

/* ==================================== SysTick实现 ==================================== */

void sys_tick_init(void)
{
    /* 配置SysTick为1ms中断一次 */
    SysTick_Config(SYS_CLOCK_FREQ / SYSTICK_FREQ);
}

tick_t sys_get_tick(void)
{
    return g_system_tick;
}

void sys_delay_ms(uint32_t delay)
{
    tick_t start = sys_get_tick();
    while (!sys_is_timed_out(start, delay)) {
        /* 空循环，非阻塞延时 */
    }
}

uint8_t sys_is_timed_out(tick_t start_tick, uint32_t timeout)
{
    tick_t current = sys_get_tick();
    return (sys_get_tick_diff(start_tick, current) >= timeout);
}

uint32_t sys_get_tick_diff(tick_t start_tick, tick_t end_tick)
{
    if (end_tick >= start_tick) {
        return end_tick - start_tick;
    } else {
        /* 处理tick溢出 */
        return (0xFFFFFFFF - start_tick) + end_tick + 1;
    }
}

/* ==================================== 看门狗实现 ==================================== */

void sys_wdt_init(void)
{
#if USE_WATCHDOG
    /* 使能LSI时钟 */
    RCC_LSICmd(ENABLE);
    while (RCC_GetFlagStatus(RCC_FLAG_LSIRDY) == RESET);
    
    /* 配置独立看门狗 */
    IWDG_WriteAccessCmd(IWDG_WriteAccess_Enable);
    IWDG_SetPrescaler(IWDG_PRESCALER);
    IWDG_SetReload(IWDG_RELOAD_VALUE);
    IWDG_ReloadCounter();
    IWDG_Enable();
#endif
}

void sys_wdt_feed(void)
{
#if USE_WATCHDOG
    IWDG_ReloadCounter();
#endif
}

uint8_t sys_wdt_is_reset_source(void)
{
    return (RCC_GetFlagStatus(RCC_FLAG_IWDGRST) != RESET) ? 1 : 0;
}

/* ==================================== 任务调度器实现 ==================================== */

void sys_scheduler_init(void)
{
    g_task_count = 0;
    for (uint8_t i = 0; i < 16; i++) {
        g_task_list[i] = NULL;
    }
}

sys_error_t sys_task_create(task_t *task, task_callback_t callback, 
                            void *arg, uint32_t period, const char *name)
{
    if (task == NULL || callback == NULL) {
        return SYS_INVALID_PARAM;
    }
    
    if (g_task_count >= 16) {
        return SYS_NO_MEMORY;
    }
    
    task->callback = callback;
    task->arg = arg;
    task->period = period;
    task->last_run = 0;
    task->enabled = 0;
    task->name = name;
    
    g_task_list[g_task_count++] = task;
    
    return SYS_OK;
}

sys_error_t sys_task_start(task_t *task)
{
    if (task == NULL) {
        return SYS_INVALID_PARAM;
    }
    
    task->enabled = 1;
    task->last_run = sys_get_tick();
    
    return SYS_OK;
}

sys_error_t sys_task_stop(task_t *task)
{
    if (task == NULL) {
        return SYS_INVALID_PARAM;
    }
    
    task->enabled = 0;
    
    return SYS_OK;
}

void sys_scheduler_run(void)
{
    tick_t current_tick = sys_get_tick();
    
    for (uint8_t i = 0; i < g_task_count; i++) {
        task_t *task = g_task_list[i];
        if (task == NULL || !task->enabled) {
            continue;
        }
        
        if (sys_get_tick_diff(task->last_run, current_tick) >= task->period) {
            task->callback(task->arg);
            task->last_run = current_tick;
        }
    }
}

/* ==================================== SysTick中断处理函数 ==================================== */

void SysTick_Handler(void)
{
    g_system_tick++;
}
