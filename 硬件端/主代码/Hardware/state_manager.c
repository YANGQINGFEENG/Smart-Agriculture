/**
 ****************************************************************************************************
 * @file        state_manager.c
 * @author      Embedded System Team
 * @version     V2.0.0
 * @date        2026-04-17
 * @brief       状态管理模块 - 管理执行器状态和异常处理
 ****************************************************************************************************
 */

#include "state_manager.h"
#include "system.h"
#include "PrintManager.h"
#include <string.h>

/* ==================================== 静态变量 ==================================== */
static StateManager g_state_mgr;
static ActuatorState g_actuator_states[MAX_ACTUATORS];
static uint8_t g_actuator_count = 0;
static ErrorInfo g_error_history[MAX_ERROR_HISTORY];
static uint8_t g_error_count = 0;

/* ==================================== 私有函数声明 ==================================== */
static void add_error_to_history(ErrorType error_type, const char *error_msg);
static void process_error(ErrorType error_type, const char *error_msg);
static void check_system_state(void);
static void process_error_history(void);

/* ==================================== 公共函数实现 ==================================== */

void state_manager_init(void)
{
    memset(&g_state_mgr, 0, sizeof(StateManager));
    g_state_mgr.system_state = SYS_STATE_NORMAL;
    g_state_mgr.last_error_check = sys_get_tick();

    g_actuator_count = 0;
    memset(g_actuator_states, 0, sizeof(g_actuator_states));

    g_error_count = 0;
    memset(g_error_history, 0, sizeof(g_error_history));
    PRINT_INFO(PRINT_MODULE_SERVER, "状态管理器初始化完成\r\n");
}

void state_manager_process(void)
{
    /* 定期检查系统状态 */
    tick_t current = sys_get_tick();
    if (sys_get_tick_diff(g_state_mgr.last_error_check, current) >= ERROR_CHECK_INTERVAL) {
        g_state_mgr.last_error_check = current;

        /* 检查系统状态 */
        check_system_state();
    }

    /* 处理错误历史 */
    process_error_history();
}

ActuatorState* state_manager_get_actuator_state(const char *actuator_id)
{
    for (uint8_t i = 0; i < g_actuator_count; i++) {
        if (strcmp(g_actuator_states[i].actuator_id, actuator_id) == 0) {
            return &g_actuator_states[i];
        }
    }
    return NULL;
}

uint8_t state_manager_update_actuator_state(const char *actuator_id, uint8_t state, uint8_t mode)
{
    ActuatorState *act_state = state_manager_get_actuator_state(actuator_id);

    if (act_state) {
        /* 更新状态 */
        act_state->state = state;
        act_state->mode = mode;
        act_state->last_update = sys_get_tick();
        PRINT_INFO(PRINT_MODULE_ACTUATOR, "执行器状态更新: %s -> 状态=%d, 模式=%d\r\n",
                 actuator_id, state, mode);
        return 0;
    } else {
        /* 添加新执行器状态 */
        if (g_actuator_count < MAX_ACTUATORS) {
            strncpy(g_actuator_states[g_actuator_count].actuator_id, actuator_id, sizeof(g_actuator_states[g_actuator_count].actuator_id) - 1);
            g_actuator_states[g_actuator_count].state = state;
            g_actuator_states[g_actuator_count].mode = mode;
            g_actuator_states[g_actuator_count].last_update = sys_get_tick();
            g_actuator_count++;
            PRINT_INFO(PRINT_MODULE_ACTUATOR, "新执行器状态添加: %s -> 状态=%d, 模式=%d\r\n",
                     actuator_id, state, mode);
            return 0;
        } else {
            PRINT_ERROR(PRINT_MODULE_ACTUATOR, "执行器数量达到上限\r\n");
            return 1;
        }
    }
}

void state_manager_report_error(ErrorType error_type, const char *error_msg)
{
    /* 添加错误到历史记录 */
    add_error_to_history(error_type, error_msg);

    /* 处理错误 */
    process_error(error_type, error_msg);

    /* 更新系统状态 */
    g_state_mgr.system_state = SYS_STATE_ERROR;
    g_state_mgr.last_error_time = sys_get_tick();
}

SystemState state_manager_get_system_state(void)
{
    return g_state_mgr.system_state;
}

uint8_t state_manager_get_error_count(void)
{
    return g_error_count;
}

ErrorInfo* state_manager_get_error_history(void)
{
    return g_error_history;
}

/* ==================================== 私有函数实现 ==================================== */

static void add_error_to_history(ErrorType error_type, const char *error_msg)
{
    if (g_error_count < MAX_ERROR_HISTORY) {
        g_error_history[g_error_count].error_type = error_type;
        strncpy(g_error_history[g_error_count].error_msg, error_msg, sizeof(g_error_history[g_error_count].error_msg) - 1);
        g_error_history[g_error_count].timestamp = sys_get_tick();
        g_error_count++;
    } else {
        /* 历史记录已满，移除最旧的记录 */
        for (uint8_t i = 0; i < MAX_ERROR_HISTORY - 1; i++) {
            g_error_history[i] = g_error_history[i + 1];
        }
        g_error_history[MAX_ERROR_HISTORY - 1].error_type = error_type;
        strncpy(g_error_history[MAX_ERROR_HISTORY - 1].error_msg, error_msg, sizeof(g_error_history[MAX_ERROR_HISTORY - 1].error_msg) - 1);
        g_error_history[MAX_ERROR_HISTORY - 1].timestamp = sys_get_tick();
    }
}

static void process_error(ErrorType error_type, const char *error_msg)
{
    PRINT_ERROR(PRINT_MODULE_SERVER, "错误: 类型=%d, 消息=%s\r\n", error_type, error_msg);

    /* 根据错误类型进行处理 */
    switch (error_type) {
        case ERROR_TYPE_HARDWARE:
            /* 硬件错误处理 */
            PRINT_ERROR(PRINT_MODULE_SERVER, "硬件错误检测到\r\n");
            break;

        case ERROR_TYPE_COMMUNICATION:
            /* 通信错误处理 */
            PRINT_ERROR(PRINT_MODULE_SERVER, "通信错误检测到\r\n");
            break;

        case ERROR_TYPE_COMMAND:
            /* 命令执行错误处理 */
            PRINT_ERROR(PRINT_MODULE_SERVER, "命令执行错误检测到\r\n");
            break;

        case ERROR_TYPE_SYSTEM:
            /* 系统错误处理 */
            PRINT_ERROR(PRINT_MODULE_SERVER, "系统错误检测到\r\n");
            break;

        default:
            break;
    }
}

static void check_system_state(void)
{
    /* 检查系统状态 */
    if (g_state_mgr.system_state == SYS_STATE_ERROR) {
        /* 检查错误是否已解决 */
        if (sys_get_tick_diff(g_state_mgr.last_error_time, sys_get_tick()) > ERROR_RECOVERY_TIME) {
            g_state_mgr.system_state = SYS_STATE_NORMAL;
            PRINT_INFO(PRINT_MODULE_SERVER, "系统恢复到正常状态\r\n");
        }
    }
}

static void process_error_history(void)
{
    /* 清理过期的错误记录 */
    for (uint8_t i = 0; i < g_error_count; i++) {
        if (sys_get_tick_diff(g_error_history[i].timestamp, sys_get_tick()) > ERROR_HISTORY_EXPIRE_TIME) {
            /* 移除过期记录 */
            for (uint8_t j = i; j < g_error_count - 1; j++) {
                g_error_history[j] = g_error_history[j + 1];
            }
            g_error_count--;
            i--;
        }
    }
}