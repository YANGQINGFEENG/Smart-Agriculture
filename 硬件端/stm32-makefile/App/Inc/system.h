/**
 ****************************************************************************************************
 * @file        system.h
 * @author      Embedded System Team
 * @version     V2.0.0
 * @date        2026-04-13
 * @brief       系统核心模块头文件 - SysTick、任务调度、看门狗
 ****************************************************************************************************
 */

#ifndef __SYSTEM_H
#define __SYSTEM_H

#include "stm32f10x.h"
#include "sys_config.h"

#ifdef __cplusplus
extern "C" {
#endif

/* ==================================== 类型定义 ==================================== */
typedef uint32_t tick_t;

/* 错误码定义 */
typedef enum {
    SYS_OK              =  0,
    SYS_ERROR           = -1,
    SYS_TIMEOUT         = -2,
    SYS_BUSY            = -3,
    SYS_INVALID_PARAM   = -4,
    SYS_NO_MEMORY       = -5
} sys_error_t;

/* ==================================== 全局变量声明 ==================================== */
extern volatile tick_t g_system_tick;

/* ==================================== 函数声明 - SysTick ==================================== */

/**
 * @brief  初始化SysTick定时器
 * @retval 无
 */
void sys_tick_init(void);

/**
 * @brief  获取系统tick计数
 * @retval 当前系统tick值（毫秒）
 */
tick_t sys_get_tick(void);

/**
 * @brief  非阻塞延时函数
 * @param  delay: 延时时间（毫秒）
 * @retval 无
 */
void sys_delay_ms(uint32_t delay);

/**
 * @brief  检查时间是否到达
 * @param  start_tick: 起始时间
 * @param  timeout: 超时时间（毫秒）
 * @retval 1: 已超时, 0: 未超时
 */
uint8_t sys_is_timed_out(tick_t start_tick, uint32_t timeout);

/**
 * @brief  获取两个时间点的差值
 * @param  start_tick: 起始时间
 * @param  end_tick: 结束时间
 * @retval 时间差值（毫秒）
 */
uint32_t sys_get_tick_diff(tick_t start_tick, tick_t end_tick);

/* ==================================== 函数声明 - 看门狗 ==================================== */

/**
 * @brief  初始化独立看门狗
 * @retval 无
 */
void sys_wdt_init(void);

/**
 * @brief  喂狗操作
 * @retval 无
 */
void sys_wdt_feed(void);

/**
 * @brief  检查是否是看门狗复位
 * @retval 1: 是看门狗复位, 0: 不是
 */
uint8_t sys_wdt_is_reset_source(void);

/* ==================================== 函数声明 - 任务调度器 ==================================== */

/* 任务回调函数类型 */
typedef void (*task_callback_t)(void *arg);

/* 任务控制块 */
typedef struct {
    task_callback_t callback;     /* 任务回调函数 */
    void *arg;                    /* 任务参数 */
    uint32_t period;              /* 任务周期（毫秒） */
    tick_t last_run;              /* 上次运行时间 */
    uint8_t enabled;              /* 是否使能 */
    const char *name;             /* 任务名称（调试用） */
} task_t;

/**
 * @brief  初始化任务调度器
 * @retval 无
 */
void sys_scheduler_init(void);

/**
 * @brief  创建任务
 * @param  task: 任务指针
 * @param  callback: 任务回调函数
 * @param  arg: 任务参数
 * @param  period: 任务周期（毫秒）
 * @param  name: 任务名称
 * @retval SYS_OK: 成功, 其他: 失败
 */
sys_error_t sys_task_create(task_t *task, task_callback_t callback, 
                            void *arg, uint32_t period, const char *name);

/**
 * @brief  启动任务
 * @param  task: 任务指针
 * @retval SYS_OK: 成功
 */
sys_error_t sys_task_start(task_t *task);

/**
 * @brief  停止任务
 * @param  task: 任务指针
 * @retval SYS_OK: 成功
 */
sys_error_t sys_task_stop(task_t *task);

/**
 * @brief  任务调度器运行（在主循环中调用）
 * @retval 无
 */
void sys_scheduler_run(void);

#ifdef __cplusplus
}
#endif

#endif
