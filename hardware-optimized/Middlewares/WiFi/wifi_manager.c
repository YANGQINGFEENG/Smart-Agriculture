/**
 ****************************************************************************************************
 * @file        wifi_manager.c
 * @author      Embedded System Team
 * @version     V2.0.0
 * @date        2026-04-13
 * @brief       WiFi/TCP管理模块实现 - 状态机、长连接管理
 ****************************************************************************************************
 */

#include "wifi_manager.h"
#include "uart.h"
#include "command_manager.h"
#include <string.h>

/* ==================================== 静态变量 ==================================== */
static WifiManager g_wifi_mgr;
static uint8_t g_at_response_buf[256];

/* ==================================== 私有函数声明 ==================================== */
static void wifi_enter_state(WifiState new_state);
static void wifi_state_init_handler(void);
static void wifi_state_reset_handler(void);
static void wifi_state_at_test_handler(void);
static void wifi_state_set_mode_handler(void);
static void wifi_state_joining_handler(void);
static void wifi_state_connected_handler(void);
static void wifi_state_error_handler(void);
static void wifi_state_reconnecting_handler(void);
static void tcp_state_machine(void);

/* ==================================== 公共函数实现 ==================================== */

void wifi_manager_init(void)
{
    memset(&g_wifi_mgr, 0, sizeof(WifiManager));
    g_wifi_mgr.wifi_state = WIFI_STATE_INIT;
    g_wifi_mgr.tcp_state = TCP_STATE_DISCONNECTED;
    g_wifi_mgr.state_enter_time = sys_get_tick();
    g_wifi_mgr.rx_buffer_len = 0;
}

static void process_received_data(void)
{
    if (g_wifi_mgr.rx_buffer_len == 0) {
        return;
    }
    
    /* 查找帧头 */
    uint16_t frame_start = 0;
    while (frame_start < g_wifi_mgr.rx_buffer_len) {
        if (g_wifi_mgr.rx_buffer[frame_start] == PROTOCOL_HEADER) {
            break;
        }
        frame_start++;
    }
    
    if (frame_start >= g_wifi_mgr.rx_buffer_len) {
        /* 没有找到帧头，清空缓冲区 */
        g_wifi_mgr.rx_buffer_len = 0;
        return;
    }
    
    /* 查找帧尾 */
    uint16_t frame_end = frame_start;
    while (frame_end < g_wifi_mgr.rx_buffer_len) {
        if (g_wifi_mgr.rx_buffer[frame_end] == PROTOCOL_FOOTER) {
            break;
        }
        frame_end++;
    }
    
    if (frame_end >= g_wifi_mgr.rx_buffer_len) {
        /* 没有找到帧尾，等待更多数据 */
        return;
    }
    
    /* 计算帧长度 */
    uint16_t frame_len = frame_end - frame_start + 1;
    
    /* 处理帧 */
    if (frame_len > 0) {
        /* 检查消息类型 */
        if (frame_start + 1 < g_wifi_mgr.rx_buffer_len) {
            uint8_t msg_type = g_wifi_mgr.rx_buffer[frame_start + 1];
            
            switch (msg_type) {
                case MSG_TYPE_CONTROL_CMD:
                    /* 处理控制命令 */
                    command_manager_handle_command(&g_wifi_mgr.rx_buffer[frame_start], frame_len);
                    break;
                    
                default:
                    debug_uart_printf("[WiFi] Unknown message type: %d\r\n", msg_type);
                    break;
            }
        }
    }
    
    /* 移除已处理的帧 */
    if (frame_end + 1 < g_wifi_mgr.rx_buffer_len) {
        memmove(g_wifi_mgr.rx_buffer, &g_wifi_mgr.rx_buffer[frame_end + 1], 
                g_wifi_mgr.rx_buffer_len - (frame_end + 1));
        g_wifi_mgr.rx_buffer_len -= (frame_end + 1);
    } else {
        g_wifi_mgr.rx_buffer_len = 0;
    }
}

void wifi_manager_run(void)
{
    /* 检查是否有数据接收 */
    if (wifi_manager_is_tcp_connected()) {
        uint16_t available = wifi_uart_available();
        if (available > 0) {
            uint16_t read_len = (available > (sizeof(g_wifi_mgr.rx_buffer) - g_wifi_mgr.rx_buffer_len)) ? 
                               (sizeof(g_wifi_mgr.rx_buffer) - g_wifi_mgr.rx_buffer_len) : available;
            
            if (read_len > 0) {
                wifi_uart_read(&g_wifi_mgr.rx_buffer[g_wifi_mgr.rx_buffer_len], read_len);
                g_wifi_mgr.rx_buffer_len += read_len;
            }
        }
        
        /* 处理接收到的数据 */
        process_received_data();
    }
    
    /* WiFi状态机 */
    switch (g_wifi_mgr.wifi_state) {
        case WIFI_STATE_INIT:
            wifi_state_init_handler();
            break;
        case WIFI_STATE_RESET:
            wifi_state_reset_handler();
            break;
        case WIFI_STATE_AT_TEST:
            wifi_state_at_test_handler();
            break;
        case WIFI_STATE_SET_MODE:
            wifi_state_set_mode_handler();
            break;
        case WIFI_STATE_JOINING:
            wifi_state_joining_handler();
            break;
        case WIFI_STATE_CONNECTED:
            wifi_state_connected_handler();
            break;
        case WIFI_STATE_ERROR:
            wifi_state_error_handler();
            break;
        case WIFI_STATE_RECONNECTING:
            wifi_state_reconnecting_handler();
            break;
        default:
            break;
    }
    
    /* TCP状态机 */
    tcp_state_machine();
}

uint8_t wifi_manager_is_wifi_connected(void)
{
    return (g_wifi_mgr.wifi_state == WIFI_STATE_CONNECTED) ? 1 : 0;
}

uint8_t wifi_manager_is_tcp_connected(void)
{
    return (g_wifi_mgr.tcp_state == TCP_STATE_CONNECTED) ? 1 : 0;
}

sys_error_t wifi_manager_send_tcp_data(const uint8_t *data, uint16_t len)
{
    if (!wifi_manager_is_tcp_connected()) {
        return SYS_ERROR;
    }
    
    /* 发送AT+CIPSEND命令 */
    char cmd[32];
    sprintf(cmd, "AT+CIPSEND=%d", len);
    
    if (wifi_send_at_cmd(cmd, ">", 2000) != SYS_OK) {
        debug_uart_printf("[WiFi] Failed to get '>' prompt\r\n");
        return SYS_ERROR;
    }
    
    /* 发送数据 */
    if (wifi_uart_send(data, len) != SYS_OK) {
        debug_uart_printf("[WiFi] Failed to send data\r\n");
        return SYS_ERROR;
    }
    
    return SYS_OK;
}

void wifi_manager_force_reconnect(void)
{
    g_wifi_mgr.wifi_state = WIFI_STATE_RECONNECTING;
    g_wifi_mgr.state_enter_time = sys_get_tick();
    g_wifi_mgr.wifi_retry_count = 0;
    g_wifi_mgr.tcp_retry_count = 0;
}

/* ==================================== AT命令接口实现 ==================================== */

sys_error_t wifi_send_at_cmd(const char *cmd, const char *ack, uint32_t timeout)
{
    wifi_uart_rx_flush();
    
    char cmd_with_crlf[64];
    snprintf(cmd_with_crlf, sizeof(cmd_with_crlf), "%s\r\n", cmd);
    wifi_uart_send_string(cmd_with_crlf);
    
    if (ack == NULL || timeout == 0) {
        return SYS_OK;
    }
    
    uint16_t len = wifi_uart_get_frame(g_at_response_buf, sizeof(g_at_response_buf), timeout);
    if (len == 0) {
        debug_uart_printf("[WiFi] AT cmd timeout: %s\r\n", cmd);
        return SYS_TIMEOUT;
    }
    
    if (strstr((char*)g_at_response_buf, ack) != NULL) {
        return SYS_OK;
    }
    
    debug_uart_printf("[WiFi] AT cmd failed: %s, resp: %s\r\n", cmd, g_at_response_buf);
    return SYS_ERROR;
}

sys_error_t wifi_send_at_cmd_with_resp(const char *cmd, uint8_t *resp_buf, 
                                       uint16_t buf_size, uint32_t timeout)
{
    wifi_uart_rx_flush();
    
    char cmd_with_crlf[64];
    snprintf(cmd_with_crlf, sizeof(cmd_with_crlf), "%s\r\n", cmd);
    wifi_uart_send_string(cmd_with_crlf);
    
    uint16_t len = wifi_uart_get_frame(g_at_response_buf, sizeof(g_at_response_buf), timeout);
    if (len == 0) {
        return SYS_TIMEOUT;
    }
    
    if (resp_buf != NULL && buf_size > 0) {
        uint16_t copy_len = (len < buf_size - 1) ? len : (buf_size - 1);
        memcpy(resp_buf, g_at_response_buf, copy_len);
        resp_buf[copy_len] = '\0';
    }
    
    return SYS_OK;
}

/* ==================================== 状态机实现 ==================================== */

static void wifi_enter_state(WifiState new_state)
{
    g_wifi_mgr.wifi_state = new_state;
    g_wifi_mgr.state_enter_time = sys_get_tick();
}

static void wifi_state_init_handler(void)
{
    debug_uart_printf("[WiFi] State: INIT\r\n");
    wifi_enter_state(WIFI_STATE_RESET);
}

static void wifi_state_reset_handler(void)
{
    debug_uart_printf("[WiFi] State: RESET\r\n");
    
    /* 发送AT+RST命令 */
    if (wifi_send_at_cmd("AT+RST", "OK", 2000) == SYS_OK) {
        sys_delay_ms(1000);
        wifi_enter_state(WIFI_STATE_AT_TEST);
    } else {
        g_wifi_mgr.wifi_retry_count++;
        if (g_wifi_mgr.wifi_retry_count >= MAX_WIFI_RETRY) {
            wifi_enter_state(WIFI_STATE_ERROR);
        }
    }
}

static void wifi_state_at_test_handler(void)
{
    debug_uart_printf("[WiFi] State: AT_TEST\r\n");
    
    uint8_t retry = 0;
    while (retry < 5) {
        if (wifi_send_at_cmd("AT", "OK", 500) == SYS_OK) {
            debug_uart_printf("[WiFi] AT test OK\r\n");
            wifi_enter_state(WIFI_STATE_SET_MODE);
            return;
        }
        retry++;
        sys_delay_ms(200);
    }
    
    g_wifi_mgr.wifi_retry_count++;
    if (g_wifi_mgr.wifi_retry_count >= MAX_WIFI_RETRY) {
        wifi_enter_state(WIFI_STATE_ERROR);
    } else {
        wifi_enter_state(WIFI_STATE_RESET);
    }
}

static void wifi_state_set_mode_handler(void)
{
    debug_uart_printf("[WiFi] State: SET_MODE\r\n");
    
    /* 设置Station模式 */
    if (wifi_send_at_cmd("AT+CWMODE=1", "OK", 1000) != SYS_OK) {
        wifi_enter_state(WIFI_STATE_ERROR);
        return;
    }
    
    /* 关闭回显 */
    wifi_send_at_cmd("ATE0", "OK", 500);
    
    /* 设置单连接模式 */
    wifi_send_at_cmd("AT+CIPMUX=0", "OK", 1000);
    
    wifi_enter_state(WIFI_STATE_JOINING);
}

static void wifi_state_joining_handler(void)
{
    debug_uart_printf("[WiFi] State: JOINING %s\r\n", WIFI_SSID);
    
    char cmd[128];
    snprintf(cmd, sizeof(cmd), "AT+CWJAP=\"%s\",\"%s\"", WIFI_SSID, WIFI_PASSWORD);
    
    if (wifi_send_at_cmd(cmd, "WIFI GOT IP", WIFI_CONNECT_TIMEOUT) == SYS_OK) {
        debug_uart_printf("[WiFi] WiFi connected!\r\n");
        g_wifi_mgr.wifi_retry_count = 0;
        wifi_enter_state(WIFI_STATE_CONNECTED);
        
        /* 获取IP地址 */
        if (wifi_send_at_cmd_with_resp("AT+CIFSR", g_at_response_buf, 
                                       sizeof(g_at_response_buf), 1000) == SYS_OK) {
            debug_uart_printf("[WiFi] IP: %s\r\n", g_at_response_buf);
        }
    } else {
        g_wifi_mgr.wifi_retry_count++;
        debug_uart_printf("[WiFi] Join failed, retry %d/%d\r\n", 
                          g_wifi_mgr.wifi_retry_count, MAX_WIFI_RETRY);
        
        if (g_wifi_mgr.wifi_retry_count >= MAX_WIFI_RETRY) {
            wifi_enter_state(WIFI_STATE_ERROR);
        } else {
            sys_delay_ms(2000);
        }
    }
}

static void wifi_state_connected_handler(void)
{
    /* 定期检查WiFi连接状态 */
    tick_t current = sys_get_tick();
    if (sys_get_tick_diff(g_wifi_mgr.last_wifi_check, current) >= 10000) {
        g_wifi_mgr.last_wifi_check = current;
        
        /* 简单的检查方式：发送AT命令 */
        if (wifi_send_at_cmd("AT", "OK", 1000) != SYS_OK) {
            debug_uart_printf("[WiFi] WiFi connection lost\r\n");
            wifi_enter_state(WIFI_STATE_RECONNECTING);
        }
    }
}

static void wifi_state_error_handler(void)
{
    debug_uart_printf("[WiFi] State: ERROR\r\n");
    
    /* 等待一段时间后尝试重新连接 */
    tick_t current = sys_get_tick();
    if (sys_get_tick_diff(g_wifi_mgr.state_enter_time, current) >= 5000) {
        g_wifi_mgr.wifi_retry_count = 0;
        wifi_enter_state(WIFI_STATE_RESET);
    }
}

static void wifi_state_reconnecting_handler(void)
{
    debug_uart_printf("[WiFi] State: RECONNECTING\r\n");
    g_wifi_mgr.tcp_state = TCP_STATE_DISCONNECTED;
    g_wifi_mgr.wifi_retry_count = 0;
    wifi_enter_state(WIFI_STATE_RESET);
}

static void tcp_state_machine(void)
{
    tick_t current = sys_get_tick();
    
    switch (g_wifi_mgr.tcp_state) {
        case TCP_STATE_DISCONNECTED:
            if (wifi_manager_is_wifi_connected()) {
                debug_uart_printf("[TCP] Connecting to %s:%s\r\n", SERVER_IP, SERVER_PORT);
                g_wifi_mgr.tcp_state = TCP_STATE_CONNECTING;
                g_wifi_mgr.state_enter_time = current;
            }
            break;
            
        case TCP_STATE_CONNECTING: {
            char cmd[64];
            snprintf(cmd, sizeof(cmd), "AT+CIPSTART=\"TCP\",\"%s\",%s", SERVER_IP, SERVER_PORT);
            
            if (wifi_send_at_cmd(cmd, "CONNECT", TCP_CONNECT_TIMEOUT) == SYS_OK) {
                debug_uart_printf("[TCP] Connected!\r\n");
                g_wifi_mgr.tcp_state = TCP_STATE_CONNECTED;
                g_wifi_mgr.last_tcp_keep_alive = current;
                g_wifi_mgr.tcp_retry_count = 0;
            } else if (sys_is_timed_out(g_wifi_mgr.state_enter_time, TCP_CONNECT_TIMEOUT)) {
                g_wifi_mgr.tcp_retry_count++;
                debug_uart_printf("[TCP] Connect failed, retry %d/%d\r\n", 
                                  g_wifi_mgr.tcp_retry_count, MAX_TCP_RETRY);
                
                if (g_wifi_mgr.tcp_retry_count >= MAX_TCP_RETRY) {
                    g_wifi_mgr.tcp_state = TCP_STATE_ERROR;
                } else {
                    g_wifi_mgr.tcp_state = TCP_STATE_DISCONNECTED;
                    sys_delay_ms(2000);
                }
            }
            break;
        }
            
        case TCP_STATE_CONNECTED:
            /* 心跳保活由任务处理 */
            break;
            
        case TCP_STATE_ERROR:
            if (sys_is_timed_out(g_wifi_mgr.state_enter_time, 5000)) {
                g_wifi_mgr.tcp_retry_count = 0;
                g_wifi_mgr.tcp_state = TCP_STATE_DISCONNECTED;
            }
            break;
            
        default:
            break;
    }
}
