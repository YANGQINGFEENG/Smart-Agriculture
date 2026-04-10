#include "ServerComm.h"
#include "atk_mb026.h"
#include "atk_mb026_uart.h"
#include "Delay.h"
#include <string.h>
#include <stdio.h>

/**
 * @brief 初始化服务器通信
 * @retval 无
 */
void ServerComm_Init(void)
{
    printf("[ServerComm] 初始化服务器通信模块...\r\n");
    printf("[ServerComm] 服务器地址: %s:%s\r\n", SERVER_IP, SERVER_PORT);
}

/**
 * @brief 发送传感器数据到服务器
 * @param sensor_id 传感器ID
 * @param value 传感器值
 * @retval 0: 成功, 非0: 失败
 */
uint8_t ServerComm_SendSensorData(const char *sensor_id, float value)
{
    char url[128];
    char request[256];
    char data[64];
    
    // 构建URL路径
    sprintf(url, "/api/sensors/%s/data", sensor_id);
    
    // 构建JSON数据
    sprintf(data, "{\"value\":%.2f}", value);
    
    // 构建HTTP POST请求
    sprintf(request, "POST %s HTTP/1.1\r\n" 
                   "Host: %s:%s\r\n" 
                   "Content-Type: application/json\r\n" 
                   "Content-Length: %d\r\n" 
                   "Connection: close\r\n" 
                   "\r\n" 
                   "%s",
                   url, SERVER_IP, SERVER_PORT, strlen(data), data);
    
    printf("[ServerComm] 发送数据到传感器: %s\r\n", sensor_id);
    printf("[ServerComm] 数据值: %.2f\r\n", value);
    printf("[ServerComm] HTTP请求: \r\n%s\r\n", request);
    
    // 连接到服务器
    if (atk_mb026_connect_tcp_server(SERVER_IP, SERVER_PORT) != ATK_MB026_EOK) {
        printf("[ServerComm] 连接服务器失败\r\n");
        return 1;
    }
    
    printf("[ServerComm] 连接服务器成功\r\n");
    
    // 发送HTTP请求
    char cmd[32];
    int req_len = strlen(request);
    sprintf(cmd, "AT+CIPSEND=%d", req_len);
    
    if (atk_mb026_send_at_cmd(cmd, ">", 2000) != ATK_MB026_EOK) {
        printf("[ServerComm] 发送AT命令失败\r\n");
        atk_mb026_send_at_cmd("AT+CIPCLOSE", "OK", 2000);
        return 2;
    }
    
    // 发送HTTP请求数据
    atk_mb026_uart_printf(request);
    delay_ms(2000);
    
    // 读取服务器响应
    uint8_t *response = atk_mb026_uart_rx_get_frame();
    if (response != NULL) {
        printf("[ServerComm] 收到服务器响应: \r\n%s\r\n", response);
        
        // 检查响应状态
        if (strstr((const char *)response, "200 OK") != NULL) {
            printf("[ServerComm] 数据发送成功\r\n");
        } else {
            printf("[ServerComm] 服务器响应异常\r\n");
        }
    } else {
        printf("[ServerComm] 未收到服务器响应\r\n");
    }
    
    // 关闭TCP连接
    atk_mb026_send_at_cmd("AT+CIPCLOSE", "OK", 2000);
    
    return 0;
}

/**
 * @brief 检查服务器连接状态
 * @retval 0: 连接正常, 非0: 连接失败
 */
uint8_t ServerComm_CheckConnection(void)
{
    printf("[ServerComm] 检查服务器连接状态...\r\n");
    
    // 连接到服务器
    if (atk_mb026_connect_tcp_server(SERVER_IP, SERVER_PORT) != ATK_MB026_EOK) {
        printf("[ServerComm] 服务器连接失败\r\n");
        return 1;
    }
    
    printf("[ServerComm] 服务器连接正常\r\n");
    
    // 关闭TCP连接
    atk_mb026_send_at_cmd("AT+CIPCLOSE", "OK", 2000);
    
    return 0;
}