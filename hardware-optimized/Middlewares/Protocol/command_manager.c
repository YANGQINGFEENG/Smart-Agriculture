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
#include "protocol.h"
#include "wifi_manager.h"
#include "state_manager.h"
#include <string.h>

/* ==================================== 静态变量 ==================================== */
static CommandManager g_cmd_mgr;
static CommandInfo g_cmd_history[MAX_COMMAND_HISTORY];
static uint8_t g_cmd_history_count = 0;

/* ==================================== 私有函数声明 ==================================== */
static uint8_t is_command_executed(uint32_t command_id);
static void add_command_to_history(uint32_t command_id);
static void execute_command(ControlCommandFrame *cmd_frame);
static void send_command_ack(uint32_t command_id, uint8_t status);

/* ==================================== 公共函数实现 ==================================== */

void command_manager_init(void)
{
    memset(&g_cmd_mgr, 0, sizeof(CommandManager));
    g_cmd_mgr.state = CMD_STATE_IDLE;
    g_cmd_history_count = 0;
    memset(g_cmd_history, 0, sizeof(g_cmd_history));
}

void command_manager_process(void)
{
    switch (g_cmd_mgr.state) {
        case CMD_STATE_IDLE:
            /* 空闲状态，等待新命令 */
            break;
            
        case CMD_STATE_PROCESSING:
            /* 处理命令 */
            if (g_cmd_mgr.current_cmd.command_id != 0) {
                execute_command(&g_cmd_mgr.current_cmd);
                g_cmd_mgr.state = CMD_STATE_IDLE;
            }
            break;
            
        case CMD_STATE_SENDING_ACK:
            /* 发送确认 */
            send_command_ack(g_cmd_mgr.current_cmd.command_id, g_cmd_mgr.ack_status);
            g_cmd_mgr.state = CMD_STATE_IDLE;
            break;
            
        default:
            break;
    }
}

sys_error_t command_manager_handle_command(const uint8_t *data, uint16_t data_len)
{
    ControlCommandFrame cmd_frame;
    
    /* 解析命令帧 */
    if (protocol_parse_control_command(data, data_len, &cmd_frame) != SYS_OK) {
        return SYS_ERROR;
    }
    
    /* 检查命令是否已经执行过 */
    if (is_command_executed(cmd_frame.command_id)) {
        debug_uart_printf("[Command] Command %d already executed\r\n", cmd_frame.command_id);
        /* 发送确认，避免服务器重复发送 */
        send_command_ack(cmd_frame.command_id, 1);
        return SYS_OK;
    }
    
    /* 存储当前命令 */
    memcpy(&g_cmd_mgr.current_cmd, &cmd_frame, sizeof(ControlCommandFrame));
    g_cmd_mgr.state = CMD_STATE_PROCESSING;
    
    debug_uart_printf("[Command] Received command: ID=%d, Type=%d, Actuator=%s\r\n", 
                     cmd_frame.command_id, cmd_frame.cmd_type, cmd_frame.actuator_id);
    
    return SYS_OK;
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

static void execute_command(ControlCommandFrame *cmd_frame)
{
    uint8_t status = 1; /* 默认执行成功 */
    uint8_t new_state = 0;
    
    /* 执行具体的命令 */
    switch (cmd_frame->cmd_type) {
        case CMD_TYPE_TURN_ON:
            debug_uart_printf("[Command] Executing TURN_ON command for actuator %s\r\n", 
                             cmd_frame->actuator_id);
            new_state = 1;
            /* 这里添加实际的硬件控制代码 */
            /* 模拟硬件控制可能的错误 */
            if (rand() % 100 < 5) { /* 5%的概率模拟错误 */
                status = 0;
                state_manager_report_error(ERROR_TYPE_HARDWARE, "Hardware control failed");
            }
            break;
            
        case CMD_TYPE_TURN_OFF:
            debug_uart_printf("[Command] Executing TURN_OFF command for actuator %s\r\n", 
                             cmd_frame->actuator_id);
            new_state = 0;
            /* 这里添加实际的硬件控制代码 */
            break;
            
        default:
            debug_uart_printf("[Command] Unknown command type: %d\r\n", cmd_frame->cmd_type);
            status = 0;
            state_manager_report_error(ERROR_TYPE_COMMAND, "Unknown command type");
            break;
    }
    
    if (status == 1) {
        /* 更新执行器状态 */
        if (state_manager_update_actuator_state((const char*)cmd_frame->actuator_id, new_state) != SYS_OK) {
            debug_uart_printf("[Command] Failed to update actuator state\r\n");
            state_manager_report_error(ERROR_TYPE_SYSTEM, "Failed to update actuator state");
        }
    }
    
    /* 添加到历史记录 */
    add_command_to_history(cmd_frame->command_id);
    
    /* 准备发送确认 */
    g_cmd_mgr.ack_status = status;
    g_cmd_mgr.state = CMD_STATE_SENDING_ACK;
}

static void send_command_ack(uint32_t command_id, uint8_t status)
{
    if (!wifi_manager_is_tcp_connected()) {
        debug_uart_printf("[Command] TCP not connected, skip sending ACK\r\n");
        return;
    }
    
    /* 构建确认帧 */
    CommandAckFrame ack_frame;
    if (protocol_build_command_ack_frame(&ack_frame, command_id, status) != SYS_OK) {
        debug_uart_printf("[Command] Failed to build ACK frame\r\n");
        return;
    }
    
    /* 转换为字节数组 */
    uint8_t send_buf[sizeof(CommandAckFrame)];
    uint16_t send_len = protocol_frame_to_bytes(&ack_frame, sizeof(CommandAckFrame),
                                                  send_buf, sizeof(send_buf));
    
    /* 发送确认 */
    if (wifi_manager_send_tcp_data(send_buf, send_len) == SYS_OK) {
        debug_uart_printf("[Command] ACK sent: ID=%d, Status=%d\r\n", command_id, status);
    } else {
        debug_uart_printf("[Command] Failed to send ACK\r\n");
    }
}
