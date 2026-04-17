/**
 ****************************************************************************************************
 * @file        command_manager.c
 * @author      Embedded System Team
 * @version     V2.0.0
 * @date        2026-04-17
 * @brief       命令管理模块 - 处理指令接收、执行和确认
 ****************************************************************************************************
 */

#include "command_manager.h"
#include "ServerComm.h"
#include "PrintManager.h"
#include "Delay.h"
#include <string.h>

/* ==================================== 静态变量 ==================================== */
static CommandManager g_cmd_mgr;
static CommandInfo g_cmd_history[MAX_COMMAND_HISTORY];
static uint8_t g_cmd_history_count = 0;

/* ==================================== 私有函数声明 ==================================== */
static uint8_t is_command_executed(uint32_t command_id);
static void add_command_to_history(uint32_t command_id);
static void execute_command(const char *actuator_id, const char *command, uint32_t command_id);
static void send_command_ack(const char *actuator_id, uint32_t command_id, uint8_t status);

/* ==================================== 公共函数实现 ==================================== */

void command_manager_init(void)
{
    memset(&g_cmd_mgr, 0, sizeof(CommandManager));
    g_cmd_mgr.state = CMD_STATE_IDLE;
    g_cmd_history_count = 0;
    memset(g_cmd_history, 0, sizeof(g_cmd_history));
    PRINT_INFO(PRINT_MODULE_SERVER, "命令管理器初始化完成\r\n");
}

void command_manager_process(void)
{
    switch (g_cmd_mgr.state) {
        case CMD_STATE_IDLE:
            /* 空闲状态，等待新命令 */
            break;

        case CMD_STATE_PROCESSING:
            /* 处理命令 */
            if (g_cmd_mgr.current_command_id != 0) {
                execute_command(g_cmd_mgr.current_actuator_id, g_cmd_mgr.current_command, g_cmd_mgr.current_command_id);
                g_cmd_mgr.state = CMD_STATE_SENDING_ACK;
            }
            break;

        case CMD_STATE_SENDING_ACK:
            /* 发送确认 */
            send_command_ack(g_cmd_mgr.current_actuator_id, g_cmd_mgr.current_command_id, g_cmd_mgr.ack_status);
            g_cmd_mgr.state = CMD_STATE_IDLE;
            break;

        default:
            break;
    }
}

uint8_t command_manager_handle_command(const char *actuator_id, const char *command, uint32_t command_id)
{
    /* 检查命令是否已经执行过 */
    if (is_command_executed(command_id)) {
        PRINT_INFO(PRINT_MODULE_SERVER, "命令 %d 已经执行过\r\n", command_id);
        /* 发送确认，避免服务器重复发送 */
        send_command_ack(actuator_id, command_id, 1);
        return 0;
    }

    /* 存储当前命令 */
    g_cmd_mgr.current_command_id = command_id;
    strncpy(g_cmd_mgr.current_actuator_id, actuator_id, sizeof(g_cmd_mgr.current_actuator_id) - 1);
    strncpy(g_cmd_mgr.current_command, command, sizeof(g_cmd_mgr.current_command) - 1);
    g_cmd_mgr.state = CMD_STATE_PROCESSING;

    PRINT_INFO(PRINT_MODULE_SERVER, "收到命令: ID=%d, 执行器=%s, 命令=%s\r\n",
             command_id, actuator_id, command);

    return 0;
}

/* ==================================== 私有函数实现 ==================================== */

static uint8_t is_command_executed(uint32_t command_id)
{
    for (uint8_t i = 0; i < g_cmd_history_count; i++) {
        if (g_cmd_history[i].command_id == command_id) {
            return 1;
        }
    }
    return 0;
}

static void add_command_to_history(uint32_t command_id)
{
    if (g_cmd_history_count < MAX_COMMAND_HISTORY) {
        g_cmd_history[g_cmd_history_count].command_id = command_id;
        g_cmd_history[g_cmd_history_count].timestamp = sys_get_tick();
        g_cmd_history_count++;
    } else {
        /* 历史记录已满，移除最旧的记录 */
        for (uint8_t i = 0; i < MAX_COMMAND_HISTORY - 1; i++) {
            g_cmd_history[i] = g_cmd_history[i + 1];
        }
        g_cmd_history[MAX_COMMAND_HISTORY - 1].command_id = command_id;
        g_cmd_history[MAX_COMMAND_HISTORY - 1].timestamp = sys_get_tick();
    }
}

static void execute_command(const char *actuator_id, const char *command, uint32_t command_id)
{
    uint8_t status = 1; /* 默认执行成功 */

    /* 执行具体的命令 */
    if (ServerComm_ExecuteCommand(actuator_id, command) != 0) {
        status = 0;
        PRINT_ERROR(PRINT_MODULE_ACTUATOR, "命令执行失败: %s\r\n", command);
    }

    /* 添加到历史记录 */
    add_command_to_history(command_id);

    /* 准备发送确认 */
    g_cmd_mgr.ack_status = status;
}

static void send_command_ack(const char *actuator_id, uint32_t command_id, uint8_t status)
{
    const char *status_str = status ? "executed" : "failed";
    if (ServerComm_ConfirmCommand(actuator_id, command_id, status_str) != 0) {
        PRINT_ERROR(PRINT_MODULE_SERVER, "发送命令确认失败\r\n");
    } else {
        PRINT_INFO(PRINT_MODULE_SERVER, "命令确认发送成功: ID=%d, 状态=%s\r\n", command_id, status_str);
    }
}