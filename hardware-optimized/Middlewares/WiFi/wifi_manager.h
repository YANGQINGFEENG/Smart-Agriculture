/**
 ****************************************************************************************************
 * @file        wifi_manager.h
 * @author      Embedded System Team
 * @version     V2.0.0
 * @date        2026-04-13
 * @brief       WiFi/TCP管理模块 - 状态机、长连接管理
 ****************************************************************************************************
 */

#ifndef __WIFI_MANAGER_H
#define __WIFI_MANAGER_H

#include "stm32f10x.h"
#include "sys_config.h"
#include "system.h"

#ifdef __cplusplus
extern "C" {
#endif

/* ==================================== 类型定义 ==================================== */

/* WiFi连接状态 */
typedef enum {
    WIFI_STATE_INIT = 0,
    WIFI_STATE_RESET,
    WIFI_STATE_AT_TEST,
    WIFI_STATE_SET_MODE,
    WIFI_STATE_JOINING,
    WIFI_STATE_CONNECTED,
    WIFI_STATE_ERROR,
    WIFI_STATE_RECONNECTING
} WifiState;

/* TCP连接状态 */
typedef enum {
    TCP_STATE_DISCONNECTED = 0,
    TCP_STATE_CONNECTING,
    TCP_STATE_CONNECTED,
    TCP_STATE_SENDING,
    TCP_STATE_ERROR
} TcpState;

/* WiFi管理状态结构 */
typedef struct {
    WifiState wifi_state;
    TcpState tcp_state;
    
    uint8_t wifi_retry_count;
    uint8_t tcp_retry_count;
    
    tick_t last_wifi_check;
    tick_t last_tcp_keep_alive;
    tick_t state_enter_time;
    
    uint8_t ip_address[16];
    uint8_t is_connected;
} WifiManager;

/* ==================================== 函数声明 ==================================== */

/**
 * @brief  初始化WiFi管理器
 * @retval 无
 */
void wifi_manager_init(void);

/**
 * @brief  WiFi管理器状态机运行（在主循环中调用）
 * @retval 无
 */
void wifi_manager_run(void);

/**
 * @brief  获取WiFi连接状态
 * @retval 1: 已连接, 0: 未连接
 */
uint8_t wifi_manager_is_wifi_connected(void);

/**
 * @brief  获取TCP连接状态
 * @retval 1: 已连接, 0: 未连接
 */
uint8_t wifi_manager_is_tcp_connected(void);

/**
 * @brief  发送数据到TCP服务器
 * @param  data: 数据指针
 * @param  len: 数据长度
 * @retval SYS_OK: 成功
 */
sys_error_t wifi_manager_send_tcp_data(const uint8_t *data, uint16_t len);

/**
 * @brief  强制重新连接
 * @retval 无
 */
void wifi_manager_force_reconnect(void);

/* ==================================== 低级AT命令接口 ==================================== */

/**
 * @brief  发送AT命令并等待响应
 * @param  cmd: AT命令
 * @param  ack: 期待的响应字符串
 * @param  timeout: 超时时间（毫秒）
 * @retval SYS_OK: 成功
 */
sys_error_t wifi_send_at_cmd(const char *cmd, const char *ack, uint32_t timeout);

/**
 * @brief  发送AT命令并获取响应
 * @param  cmd: AT命令
 * @param  resp_buf: 响应缓冲区
 * @param  buf_size: 缓冲区大小
 * @param  timeout: 超时时间（毫秒）
 * @retval SYS_OK: 成功
 */
sys_error_t wifi_send_at_cmd_with_resp(const char *cmd, uint8_t *resp_buf, 
                                       uint16_t buf_size, uint32_t timeout);

#ifdef __cplusplus
}
#endif

#endif
