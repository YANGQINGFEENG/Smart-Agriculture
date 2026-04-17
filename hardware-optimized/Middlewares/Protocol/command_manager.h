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
#include "protocol.h"

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
    ControlCommandFrame current_cmd;          /* 当前命令 */
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
 * @param  data: 命令数据
 * @param  data_len: 数据长度
 * @retval SYS_OK: 成功
 */
sys_error_t command_manager_handle_command(const uint8_t *data, uint16_t data_len);

#ifdef __cplusplus
}
#endif

#endif
