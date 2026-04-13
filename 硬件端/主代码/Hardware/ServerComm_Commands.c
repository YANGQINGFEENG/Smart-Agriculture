/**
 * @file    ServerComm_Commands.c
 * @brief   硬件端查询和执行控制指令
 * @details 硬件端定期查询服务器是否有新的控制指令，并执行
 */

#include "ServerComm.h"
#include "atk_mb026.h"
#include "OLED.h"
#include "relay.h"
#include <stdio.h>
#include <string.h>

/**
 * @brief 查询并执行控制指令
 * @param actuator_id 执行器ID
 * @return 0:成功 1:未连接 2:查询失败 3:执行失败
 */
uint8_t ServerComm_CheckAndExecuteCommand(const char *actuator_id)
{
    uint8_t *response;
    uint16_t timeout;
    uint8_t success = 0;
    int command_id = -1;
    char command[8] = {0};
    
    printf("\r\n[Command] 查询控制指令: %s\r\n", actuator_id);
    
    if (!ServerComm_IsConnected()) {
        printf("[Command] TCP未连接，尝试建立连接...\r\n");
        if (ServerComm_Connect() != 0) {
            printf("[Command] 建立连接失败\r\n");
            return 1;
        }
    }
    
    atk_mb026_uart_rx_restart();
    delay_ms(100);
    
    atk_mb026_uart_printf_blocking("GET /api/actuators/%s/commands HTTP/1.1\r\n", actuator_id);
    atk_mb026_uart_printf_blocking("Host: %s:%s\r\n", SERVER_IP, SERVER_PORT);
    atk_mb026_uart_printf_blocking("Connection: keep-alive\r\n");
    atk_mb026_uart_printf_blocking("\r\n");
    
    timeout = 3000;
    while (timeout > 0) {
        response = atk_mb026_uart_rx_get_frame();
        if (response != NULL) {
            if (strstr((const char *)response, "HTTP/1.1 200") != NULL) {
                printf("[Command] 服务器响应: HTTP 200 OK\r\n");
                
                char *data_start = strstr((const char *)response, "\"data\":");
                if (data_start != NULL) {
                    char *id_start = strstr(data_start, "\"id\":");
                    char *command_start = strstr(data_start, "\"command\":");
                    
                    if (id_start != NULL && command_start != NULL) {
                        sscanf(id_start, "\"id\":%d", &command_id);
                        
                        if (strstr(command_start, "\"on\"") != NULL) {
                            strcpy(command, "on");
                        } else if (strstr(command_start, "\"off\"") != NULL) {
                            strcpy(command, "off");
                        }
                        
                        if (command_id > 0 && strlen(command) > 0) {
                            printf("[Command] 收到指令: ID=%d, 命令=%s\r\n", command_id, command);
                            
                            if (strcmp(command, "on") == 0) {
                                RELAY_2(1);
                                printf("[Command] 执行指令: 打开继电器\r\n");
                                success = 1;
                            } else if (strcmp(command, "off") == 0) {
                                RELAY_2(0);
                                printf("[Command] 执行指令: 关闭继电器\r\n");
                                success = 1;
                            }
                            
                            if (success) {
                                ServerComm_ConfirmCommand(actuator_id, command_id, "executed");
                            } else {
                                ServerComm_ConfirmCommand(actuator_id, command_id, "failed");
                            }
                        }
                    } else {
                        printf("[Command] 没有待执行的指令\r\n");
                    }
                }
                break;
            } else if (strstr((const char *)response, "HTTP/1.1 400") != NULL ||
                       strstr((const char *)response, "HTTP/1.1 404") != NULL ||
                       strstr((const char *)response, "HTTP/1.1 500") != NULL) {
                printf("[Command] 服务器响应错误\r\n");
                break;
            }
        }
        timeout--;
        delay_ms(1);
    }
    
    if (timeout == 0) {
        printf("[Command] 查询超时\r\n");
        return 2;
    }
    
    return success ? 0 : 3;
}

/**
 * @brief 确认控制指令执行结果
 * @param actuator_id 执行器ID
 * @param command_id 指令ID
 * @param status 执行状态 ("executed" 或 "failed")
 * @return 0:成功 1:未连接 2:确认失败
 */
uint8_t ServerComm_ConfirmCommand(const char *actuator_id, int command_id, const char *status)
{
    char json_buf[64];
    uint8_t json_len;
    uint8_t *response;
    uint16_t timeout;
    
    printf("\r\n[Command] 确认指令执行: ID=%d, 状态=%s\r\n", command_id, status);
    
    sprintf(json_buf, "{\"command_id\":%d,\"status\":\"%s\"}", command_id, status);
    json_len = strlen(json_buf);
    
    atk_mb026_uart_rx_restart();
    delay_ms(100);
    
    atk_mb026_uart_printf_blocking("PATCH /api/actuators/%s/commands HTTP/1.1\r\n", actuator_id);
    atk_mb026_uart_printf_blocking("Host: %s:%s\r\n", SERVER_IP, SERVER_PORT);
    atk_mb026_uart_printf_blocking("Content-Type: application/json\r\n");
    atk_mb026_uart_printf_blocking("Content-Length: %d\r\n", json_len);
    atk_mb026_uart_printf_blocking("Connection: keep-alive\r\n");
    atk_mb026_uart_printf_blocking("\r\n");
    atk_mb026_uart_printf_blocking("%s", json_buf);
    
    timeout = 3000;
    while (timeout > 0) {
        response = atk_mb026_uart_rx_get_frame();
        if (response != NULL) {
            if (strstr((const char *)response, "HTTP/1.1 200") != NULL) {
                printf("[Command] 确认成功\r\n");
                return 0;
            } else if (strstr((const char *)response, "HTTP/1.1 400") != NULL ||
                       strstr((const char *)response, "HTTP/1.1 404") != NULL ||
                       strstr((const char *)response, "HTTP/1.1 500") != NULL) {
                printf("[Command] 确认失败\r\n");
                return 2;
            }
        }
        timeout--;
        delay_ms(1);
    }
    
    printf("[Command] 确认超时\r\n");
    return 2;
}
