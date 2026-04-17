/**
 ****************************************************************************************************
 * @file        command_manager.h
 * @author      Embedded System Team
 * @version     V2.0.0
 * @date        2026-04-17
 * @brief       命令管理模块头文件
 ****************************************************************************************************
 */

#ifndef __COMMAND_MANAGER_H
#define __COMMAND_MANAGER_H

#include "stm32f10x.h"
#include "system.h"

#ifdef __cplusplus
extern "C" {
#endif

/* ==================================== 常量定义 ==================================== */

#define MAX_COMMAND_HISTORY    10  /* 最大命令历史记录数 */

/* ==================================== 枚举定义 ==================================== */

/* 命令管理器状态 */
typedef enum {
    CMD_STATE_IDLE = 0,           /* 空闲状态 */
    CMD_STATE_PROCESSING,         /* 处理命令 */
    CMD_STATE_SENDING_ACK,        /* 发送确认 */
    CMD_STATE_ERROR               /* 错误状态 */
} CommandState;

/* ==================================== 结构体定义 ==================================== */

/* 命令信息 */
typedef struct {
    uint32_t command_id;          /* 命令ID */
    tick_t timestamp;             /* 执行时间戳 */
} CommandInfo;

/* 命令管理器 */
typedef struct {
    CommandState state;                       /* 当前状态 */
    uint32_t current_command_id;              /* 当前命令ID */
    char current_actuator_id[20];             /* 当前执行器ID */
    char current_command[16];                 /* 当前命令 */
    uint8_t ack_status;                       /* 确认状态 */
} CommandManager;

/* ==================================== 函数声明 ==================================== */

/**
 * @brief  初始化命令管理器
 * @retval 无
 */
void command_manager_init(void);

/**
 * @brief  处理命令管理器状态机
 * @retval 无
 */
void command_manager_process(void);

/**
 * @brief  处理接收到的命令
 * @param  actuator_id: 执行器ID
 * @param  command: 命令内容
 * @param  command_id: 命令ID
 * @retval 0: 成功
 */
uint8_t command_manager_handle_command(const char *actuator_id, const char *command, uint32_t command_id);

#ifdef __cplusplus
}
#endif

#endif