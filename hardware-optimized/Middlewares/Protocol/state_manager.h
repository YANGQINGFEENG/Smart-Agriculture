/**
 ****************************************************************************************************
 * @file        state_manager.h
 * @author      Embedded System Team
 * @version     V2.0.0
 * @date        2026-04-17
 * @brief       状态管理模块头文件
 ****************************************************************************************************
 */

#ifndef __STATE_MANAGER_H
#define __STATE_MANAGER_H

#include "stm32f10x.h"
#include "system.h"

#ifdef __cplusplus
extern "C" {
#endif

/* ==================================== 常量定义 ==================================== */

#define MAX_ACTUATORS          10  /* 最大执行器数量 */
#define MAX_ERROR_HISTORY      20  /* 最大错误历史记录数 */
#define ERROR_CHECK_INTERVAL   5000  /* 错误检查间隔（毫秒） */
#define ERROR_RECOVERY_TIME    30000  /* 错误恢复时间（毫秒） */
#define ERROR_HISTORY_EXPIRE_TIME 3600000  /* 错误历史过期时间（毫秒） */

/* ==================================== 枚举定义 ==================================== */

/* 系统状态 */
typedef enum {
    SYS_STATE_NORMAL = 0,     /* 正常状态 */
    SYS_STATE_ERROR,           /* 错误状态 */
    SYS_STATE_WARNING,         /* 警告状态 */
    SYS_STATE_OFFLINE          /* 离线状态 */
} SystemState;

/* 错误类型 */
typedef enum {
    ERROR_TYPE_HARDWARE = 0,    /* 硬件错误 */
    ERROR_TYPE_COMMUNICATION,   /* 通信错误 */
    ERROR_TYPE_COMMAND,         /* 命令执行错误 */
    ERROR_TYPE_SYSTEM           /* 系统错误 */
} ErrorType;

/* ==================================== 结构体定义 ==================================== */

/* 执行器状态 */
typedef struct {
    uint8_t actuator_id[20];    /* 执行器ID */
    uint8_t state;              /* 执行器状态 (0: 关闭, 1: 开启) */
    tick_t last_update;         /* 最后更新时间 */
} ActuatorState;

/* 错误信息 */
typedef struct {
    ErrorType error_type;       /* 错误类型 */
    char error_msg[64];         /* 错误消息 */
    tick_t timestamp;           /* 错误发生时间 */
} ErrorInfo;

/* 状态管理器 */
typedef struct {
    SystemState system_state;   /* 系统状态 */
    tick_t last_error_check;    /* 上次错误检查时间 */
    tick_t last_error_time;     /* 上次错误发生时间 */
} StateManager;

/* ==================================== 函数声明 ==================================== */

/**
 * @brief  初始化状态管理器
 * @retval 无
 */
void state_manager_init(void);

/**
 * @brief  处理状态管理器
 * @retval 无
 */
void state_manager_process(void);

/**
 * @brief  获取执行器状态
 * @param  actuator_id: 执行器ID
 * @retval 执行器状态指针
 */
ActuatorState* state_manager_get_actuator_state(const char *actuator_id);

/**
 * @brief  更新执行器状态
 * @param  actuator_id: 执行器ID
 * @param  state: 新状态 (0: 关闭, 1: 开启)
 * @retval SYS_OK: 成功
 */
sys_error_t state_manager_update_actuator_state(const char *actuator_id, uint8_t state);

/**
 * @brief  报告错误
 * @param  error_type: 错误类型
 * @param  error_msg: 错误消息
 * @retval 无
 */
void state_manager_report_error(ErrorType error_type, const char *error_msg);

/**
 * @brief  获取系统状态
 * @retval 系统状态
 */
SystemState state_manager_get_system_state(void);

/**
 * @brief  获取错误计数
 * @retval 错误计数
 */
uint8_t state_manager_get_error_count(void);

/**
 * @brief  获取错误历史
 * @retval 错误历史指针
 */
ErrorInfo* state_manager_get_error_history(void);

#ifdef __cplusplus
}
#endif

#endif
