/**
 * @file    main.c
 * @brief   智能农业监控系统主程序
 * @details 实现WiFi连接、服务器通信、传感器数据采集、设备控制等功能
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    基于STM32F103C8微控制器开发
 */

#include "stm32f10x.h"                  // Device header
#include "Delay.h"
#include "LED.h"
#include "string.h"
#include "usart.h"
#include "atk_mb026.h"
#include "atk_mb026_uart.h"
#include "demo.h"
#include "../Hardware/RELAY/relay.h"
#include "../Hardware/TOUCH_KEY/touch_key.h"
#include "../Hardware/OLED.h"
#include "../Hardware/dht11.h"
#include "../Hardware/LightSensor.h"
#include "../Hardware/RS485.h"
#include "../Hardware/SoilSensor.h"
#include "../Hardware/ServerComm.h"
#include <stdio.h>

/* ==================== 全局变量定义 ==================== */

uint32_t timecount = 0;                  // 系统运行时间计数器（ms）
uint8_t g_wifi_connected = 0;            // WiFi连接状态标志（0: 未连接, 1: 已连接）
uint8_t g_server_connected = 0;          // 服务器连接状态标志（0: 未连接, 1: 已连接）

/* ==================== 配置参数定义 ==================== */

#define MAX_WIFI_RETRY 5                 // WiFi连接最大重试次数
#define MAX_SERVER_RETRY 3               // 服务器连接最大重试次数
#define WIFI_CHECK_INTERVAL 50000        // WiFi状态检查间隔（ms）
#define SERVER_TEST_COUNT 3              // 服务器测试次数
#define BAIDU_PING_INTERVAL 30000        // 百度Ping测试间隔（ms）

// 服务器信息 - 已移至ServerComm.h中定义

/* ==================== WiFi连接功能 ==================== */

/**
 * @brief   检查WiFi连接状态
 * @details 通过AT命令查询WiFi模块的连接状态
 * @return  WiFi连接状态
 * @retval  1: WiFi已连接
 * @retval  0: WiFi未连接
 * @note    使用AT+CWSTATUS命令查询状态
 */
uint8_t check_wifi_status(void)
{
    uint8_t *ret = NULL;
    if (atk_mb026_send_at_cmd("AT+CWSTATUS", "OK", 1000) == ATK_MB026_EOK) {
        ret = atk_mb026_uart_rx_get_frame();
        if (ret != NULL) {
            if (strstr((const char *)ret, "+CWSTATUS:1") != NULL) {
                return 1; // WiFi已连接（STA模式，已连接AP）
            }
            if (strstr((const char *)ret, "+CWSTATUS:3") != NULL) {
                return 1; // WiFi已连接（STA+AP模式）
            }
        }
    }
    return 0; // WiFi未连接
}

/**
 * @brief   初始化WiFi模块
 * @details 初始化ATK-MB026 WiFi模块，设置波特率并检测模块响应
 * @return  初始化结果
 * @retval  1: 初始化成功
 * @retval  0: 初始化失败
 * @note    波特率设置为115200
 */
uint8_t init_wifi_module(void)
{
    uint8_t ret = 0;
    
    printf("[System] 初始化WiFi模块...\r\n");
    OLED_ShowString(1, 1, "  System Init");
    OLED_ShowString(2, 1, "  WiFi Module");
    
    if (atk_mb026_init(115200) == 0) {
        printf("[System] WiFi模块初始化成功\r\n");
        OLED_ShowString(2, 1, "  Init: OK");
        ret = 1;
    } else {
        printf("[System] WiFi模块初始化失败\r\n");
        OLED_ShowString(2, 1, "  Init: Failed");
        ret = 0;
    }
    
    return ret;
}
/**
 * @brief   连接WiFi网络
 * @details 使用配置的SSID和密码连接WiFi网络，支持自动重试
 * @return  连接结果
 * @retval  1: 连接成功
 * @retval  0: 连接失败
 * @note    最大重试次数由MAX_WIFI_RETRY定义
 */
uint8_t connect_wifi(void)
{
    uint8_t retry = 0;
    uint8_t ret = 0;
    
    while (retry < MAX_WIFI_RETRY) {
        printf("[WiFi] 连接到WiFi: %s (尝试 %d/%d)\r\n", DEMO_WIFI_SSID, retry + 1, MAX_WIFI_RETRY);
        
        if (atk_mb026_join_ap(DEMO_WIFI_SSID, DEMO_WIFI_PWD) == ATK_MB026_EOK) {
            printf("[WiFi] WiFi连接成功\r\n");
            
            // 获取IP地址
            char ip_buf[20] = {0};
            if (atk_mb026_get_ip(ip_buf) == ATK_MB026_EOK) {
                printf("[WiFi] 获取IP地址: %s\r\n", ip_buf);
            }
            
            g_wifi_connected = 1;
            ret = 1;
            break;
        } else {
            printf("[WiFi] WiFi连接失败，%d秒后重试\r\n", (retry + 1) * 2);
            retry++;
            delay_ms((retry + 1) * 2000); // 递增重试间隔
        }
    }
    
    if (retry >= MAX_WIFI_RETRY) {
        printf("[WiFi] WiFi连接失败，已达到最大重试次数\r\n");
        ret = 0;
    }
    
    return ret;
}

/* ==================== 服务器通信功能 ==================== */

/*
 * @brief   发送数据到服务器
 * @details 通过TCP连接发送数据到服务器
 * @param   data 要发送的数据
 * @param   len 数据长度
 * @return  发送结果
 * @retval  1: 发送成功
 * @retval  0: 发送失败
 * @note    使用AT+CIPSEND命令发送数据
 */
/*
uint8_t send_data_to_server(char *data, uint16_t len)
{
    uint8_t ret = 0;
    
    // 连接到服务器
    if (atk_mb026_connect_tcp_server(SERVER_URL, SERVER_PORT) == ATK_MB026_EOK) {
        printf("[Server] 连接服务器成功\r\n");
        
        // 使用AT+CIPSEND命令发送数据
        char cmd[32];
        sprintf(cmd, "AT+CIPSEND=%d", len);
        
        if (atk_mb026_send_at_cmd(cmd, ">", 2000) == ATK_MB026_EOK) {
            printf("[Server] 发送数据...\r\n");
            atk_mb026_uart_printf(data);
            delay_ms(1000);
            
            // 关闭TCP连接
            atk_mb026_send_at_cmd("AT+CIPCLOSE", "OK", 2000);
            ret = 1;
        } else {
            printf("[Server] 发送命令失败\r\n");
        }
    } else {
        printf("[Server] 连接服务器失败\r\n");
    }
    
    return ret;
}
*/

/**
 * @brief   Ping服务器功能
 * @details 使用AT+PING命令测试服务器连通性
 * @param   server_address 服务器地址
 * @return  Ping响应时间（ms）
 * @retval  0: 失败或超时
 * @note    超时时间设置为15秒
 */
uint32_t ping_server(const char *server_address)
{
    char cmd[64];
    uint8_t *ret = NULL;
    uint32_t ping_time = 0;
    
    // 构建AT+PING命令
    sprintf(cmd, "AT+PING=\"%s\"", server_address);
    printf("[DEBUG] 发送Ping命令: %s\r\n", cmd);
    
    // 发送命令并等待响应 - 增加超时时间到15秒
    if (atk_mb026_send_at_cmd(cmd, "OK", 15000) == ATK_MB026_EOK) {
        ret = atk_mb026_uart_rx_get_frame();
        if (ret != NULL) {
            // 解析Ping响应时间
            if (strstr((const char *)ret, "+PING:") != NULL) {
                // 检查是否超时
                if (strstr((const char *)ret, "+PING:TIMEOUT") != NULL) {
                    printf("[DEBUG] Ping超时\r\n");
                    return 0; // 超时返回0
                } else {
                    // 提取响应时间
                    // 注意：这里需要根据实际的响应格式进行调整
                    // 尝试多种可能的格式
                    if (sscanf((const char *)ret, "%*[^0-9]%u", &ping_time) == 1) {
                        printf("[DEBUG] Ping响应时间: %lu ms\r\n", ping_time);
                        return ping_time;
                    }
                }
            }
        }
    }
    printf("[DEBUG] Ping命令执行失败\r\n");
    return 0; // 失败返回0
}

/*
 * @brief   发送HTTP请求到服务器
 * @details 建立TCP连接并发送HTTP请求，支持重试机制
 * @param   server_url 服务器地址
 * @param   server_port 服务器端口
 * @param   request HTTP请求内容
 * @return  发送结果
 * @retval  1: 发送成功
 * @retval  0: 发送失败
 * @note    最大重试次数由MAX_SERVER_RETRY定义
 */
/*
uint8_t send_http_request(char *server_url, char *server_port, char *request)
{
    uint8_t ret = 0;
    uint8_t retry = 0;
    uint8_t *response = NULL;
    uint32_t wait_timeout = 0;
    
    while (retry < MAX_SERVER_RETRY) {
        printf("[DEBUG] 尝试连接服务器: %s:%s (尝试 %d/%d)\r\n", server_url, server_port, retry + 1, MAX_SERVER_RETRY);
        OLED_ShowString(3, 1, "  Connecting");
        OLED_ShowString(4, 1, "  Server");
        
        if (atk_mb026_connect_tcp_server(server_url, server_port) == ATK_MB026_EOK) {
            printf("[DEBUG] 连接服务器成功\r\n");
            OLED_ShowString(3, 1, "  Connected");
            OLED_ShowString(4, 1, "  Server");
            g_server_connected = 1;
            
            char cmd[32];
            int req_len = strlen(request);
            sprintf(cmd, "AT+CIPSEND=%d", req_len);
            printf("[DEBUG] 发送AT命令: %s\r\n", cmd);
            
            atk_mb026_uart_rx_restart();
            
            if (atk_mb026_send_at_cmd(cmd, ">", 3000) == ATK_MB026_EOK) {
                printf("[DEBUG] 收到'>'提示符，发送HTTP请求\r\n");
                OLED_ShowString(3, 1, "  Sending");
                OLED_ShowString(4, 1, "  Request");
                
                atk_mb026_uart_rx_restart();
                atk_mb026_uart_printf((char *)request);
                printf("[DEBUG] HTTP请求已发送 (%d字节)\r\n", req_len);
                printf("[DEBUG] 请求内容:\r\n%s\r\n", request);
                OLED_ShowString(3, 1, "  Sent");
                OLED_ShowString(4, 1, "  Request");
                
                printf("[DEBUG] 等待服务器响应...\r\n");
                OLED_ShowString(3, 1, "  Waiting");
                OLED_ShowString(4, 1, "  Response");
                
                wait_timeout = 15000;
                uint8_t got_response = 0;
                uint8_t got_send_ok = 0;
                
                while (wait_timeout > 0) {
                    response = atk_mb026_uart_rx_get_frame();
                    if (response != NULL) {
                        printf("[HTTP] 收到数据: %s\r\n", (char *)response);
                        
                        if (strstr((const char *)response, "SEND OK") != NULL) {
                            printf("[HTTP] 数据发送确认: SEND OK\r\n");
                            got_send_ok = 1;
                        }
                        
                        if (strstr((const char *)response, "HTTP/") != NULL ||
                            strstr((const char *)response, "+IPD") != NULL ||
                            strstr((const char *)response, "\"success\"") != NULL ||
                            strstr((const char *)response, "\"data\"") != NULL ||
                            strstr((const char *)response, "\"total\"") != NULL ||
                            strstr((const char *)response, "temperature") != NULL ||
                            strstr((const char *)response, "传感器") != NULL) {
                            printf("[HTTP] ========== 收到服务器响应 ==========\r\n");
                            printf("%s\r\n", (char *)response);
                            printf("[HTTP] ================================\r\n");
                            
                            if (strstr((const char *)response, "\"success\":true") != NULL ||
                                strstr((const char *)response, "\"success\": true") != NULL) {
                                printf("[HTTP] 服务器响应: 成功 (JSON)\r\n");
                                OLED_ShowString(3, 1, "  Response:");
                                OLED_ShowString(4, 1, "  OK");
                                ret = 1;
                            } else if (strstr((const char *)response, "200") != NULL) {
                                printf("[HTTP] 服务器响应: 200 OK\r\n");
                                OLED_ShowString(3, 1, "  Response:");
                                OLED_ShowString(4, 1, "  200 OK");
                                ret = 1;
                            } else if (strstr((const char *)response, "temperature") != NULL ||
                                       strstr((const char *)response, "传感器") != NULL) {
                                printf("[HTTP] 服务器响应: 收到传感器数据\r\n");
                                OLED_ShowString(3, 1, "  Response:");
                                OLED_ShowString(4, 1, "  Data OK");
                                ret = 1;
                            } else if (strstr((const char *)response, "400") != NULL) {
                                printf("[HTTP] 服务器响应: 400 Bad Request\r\n");
                                OLED_ShowString(3, 1, "  Response:");
                                OLED_ShowString(4, 1, "  400");
                                ret = 1;
                            } else if (strstr((const char *)response, "404") != NULL) {
                                printf("[HTTP] 服务器响应: 404 Not Found\r\n");
                                OLED_ShowString(3, 1, "  Response:");
                                OLED_ShowString(4, 1, "  404");
                                ret = 1;
                            } else {
                                printf("[HTTP] 服务器响应: 其他状态\r\n");
                                OLED_ShowString(3, 1, "  Response:");
                                OLED_ShowString(4, 1, "  OK");
                                ret = 1;
                            }
                            got_response = 1;
                        }
                        else if (strstr((const char *)response, "ERROR") != NULL ||
                                 strstr((const char *)response, "FAIL") != NULL) {
                            printf("[HTTP] 发送失败\r\n");
                            break;
                        }
                        else if (strstr((const char *)response, "CLOSED") != NULL) {
                            printf("[HTTP] 连接已关闭\r\n");
                            if (got_send_ok && !got_response) {
                                printf("[HTTP] 数据已发送但未收到响应\r\n");
                            }
                            break;
                        }
                        
                        atk_mb026_uart_rx_restart();
                    }
                    wait_timeout--;
                    delay_ms(1);
                }
                
                if (!got_response && ret == 0) {
                    printf("[HTTP] 等待超时，未收到响应\r\n");
                    OLED_ShowString(3, 1, "  Timeout");
                    OLED_ShowString(4, 1, "  No Resp");
                }
            } else {
                printf("[HTTP] 发送AT+CIPSEND命令失败\r\n");
                OLED_ShowString(3, 1, "  Cmd:");
                OLED_ShowString(4, 1, "  Fail");
            }
            
            printf("[DEBUG] 关闭TCP连接\r\n");
            atk_mb026_send_at_cmd("AT+CIPCLOSE", "OK", 2000);
            g_server_connected = 0;
            delay_ms(500);
            
            if (ret) {
                break;
            }
        } else {
            printf("[HTTP] 连接服务器失败\r\n");
            OLED_ShowString(3, 1, "  Connect");
            OLED_ShowString(4, 1, "  Fail");
        }
        
        retry++;
        if (retry < MAX_SERVER_RETRY) {
            printf("[DEBUG] %d秒后重试...\r\n", retry);
            delay_ms(retry * 1000);
        }
    }
    
    return ret;
}
*/

/* ==================== 测试功能 ==================== */

/**
 * @brief   测试百度连接
 * @details 通过Ping命令测试与百度的网络连通性
 * @note    仅在WiFi已连接时执行测试
 */
void test_baidu_connectivity(void)
{
    // 添加WiFi状态检查
    if (!g_wifi_connected) {
        printf("======================================\r\n");
        printf("[Baidu Test] WiFi未连接，跳过测试\r\n");
        printf("======================================\r\n");
        return;
    }
    
    printf("======================================\r\n");
    printf("[Network Test] 测试网络连通性...\r\n");
    printf("======================================\r\n");
    
    OLED_ShowString(1, 1, "  Network Test");
    OLED_ShowString(2, 1, "  Pinging...");
    
    // 首先测试服务器IP连通性
    printf("\r\n[Network Test] ===== 测试服务器IP连通性 =====\r\n");
    printf("[Network Test] 目标IP: %s\r\n", SERVER_IP);
    uint8_t server_ping_result = atk_mb026_ping((char *)SERVER_IP);
    if (server_ping_result == ATK_MB026_EOK) {
        printf("[Network Test] 服务器IP Ping: 成功\r\n");
        OLED_ShowString(2, 1, "  Server: OK");
    } else {
        printf("[Network Test] 服务器IP Ping: 失败 (错误码: %d)\r\n", server_ping_result);
        OLED_ShowString(2, 1, "  Server: FAIL");
        printf("[Network Test] 可能原因:\r\n");
        printf("[Network Test]   1. 服务器IP地址不正确\r\n");
        printf("[Network Test]   2. WiFi模块和服务器不在同一网段\r\n");
        printf("[Network Test]   3. 服务器防火墙阻止了ICMP\r\n");
    }
    
    delay_ms(2000);
    
    // 然后测试百度连通性
    printf("\r\n[Network Test] ===== 测试百度连通性 =====\r\n");
    printf("[Network Test] 测试地址: www.baidu.com\r\n");
    OLED_ShowString(1, 1, "  Baidu Test");
    OLED_ShowString(2, 1, "  Pinging...");
    
    uint32_t ping_time = ping_server("www.baidu.com");
    if (ping_time > 0) {
        printf("[Network Test] Ping百度: 成功 - 响应时间 %lu ms\r\n", ping_time);
        OLED_ShowString(2, 1, "  Baidu: OK");
        char ping_str[20];
        sprintf(ping_str, "  %lu ms", ping_time);
        OLED_ShowString(3, 1, ping_str);
    } else {
        printf("[Network Test] Ping百度: 失败 - 超时或不可达\r\n");
        OLED_ShowString(2, 1, "  Baidu: FAIL");
        OLED_ShowString(3, 1, "  Timeout");
    }
    
    printf("======================================\r\n");
    printf("[Network Test] 测试完成\r\n");
    printf("======================================\r\n");
    
    delay_ms(2000);
}

/**
 * @brief   测试服务器健康状态
 * @details 发送HTTP GET请求测试服务器响应状态
 * @note    测试次数由SERVER_TEST_COUNT定义
 */
void test_server_health(void)
{
    printf("======================================\r\n");
    printf("[Server Test] 测试服务器健康状态...\r\n");
    printf("[Server Test] 测试地址: http://%s:%s%s\r\n", SERVER_URL, SERVER_PORT, SERVER_PATH);
    printf("[Server Test] 测试次数: %d次\r\n", SERVER_TEST_COUNT);
    printf("======================================\r\n");
    
    char request[300];
    sprintf(request, "GET %s HTTP/1.1\r\n" 
                   "Host: %s:%s\r\n" 
                   "Connection: close\r\n" 
                   "User-Agent: STM32-Client/1.0\r\n" 
                   "\r\n",
                   SERVER_PATH, SERVER_URL, SERVER_PORT);
    
    int success_count = 0;
    int failure_count = 0;
    
    // 执行服务器测试
    for (int i = 1; i <= SERVER_TEST_COUNT; i++) {
        printf("\r\n======================================\r\n");
        printf("[Server Test] 测试 #%d/%d\r\n", i, SERVER_TEST_COUNT);
        printf("======================================\r\n");
        
        // 更新OLED显示
        char test_str[20];
        sprintf(test_str, "Test %02d/%d", i, SERVER_TEST_COUNT);
        OLED_ShowString(1, 1, "  Server Test");
        OLED_ShowString(2, 1, test_str);
        
        // 显示发送请求内容
        printf("[Server Test] 发送请求内容: \r\n");
        printf("%s\r\n", request);
        
        // 发送HTTP请求
        OLED_ShowString(3, 1, "  Sending");
        OLED_ShowString(4, 1, "  Request");
        // uint8_t result = send_http_request((char *)SERVER_URL, (char *)SERVER_PORT, request);
        uint8_t result = 0; // 暂时返回0，因为send_http_request已被注释
        
        // 显示状态返回值
        printf("[Server Test] 状态返回值: %d\r\n", result);
        
        if (result) {
            success_count++;
            printf("[Server Test] 测试结果: 成功\r\n");
            OLED_ShowString(3, 1, "  Result:");
            OLED_ShowString(4, 1, "  OK");
        } else {
            failure_count++;
            printf("[Server Test] 测试结果: 失败\r\n");
            OLED_ShowString(3, 1, "  Result:");
            OLED_ShowString(4, 1, "  Fail");
        }
        
        // 测试间隔
        printf("[DEBUG] 等待3秒进行下一次测试...\r\n");
        delay_ms(3000);
    }
    
    // 测试完成
    printf("\r\n======================================\r\n");
    printf("[Server Test] 测试完成\r\n");
    printf("[Server Test] 成功次数: %d/%d\r\n", success_count, SERVER_TEST_COUNT);
    printf("[Server Test] 失败次数: %d/%d\r\n", failure_count, SERVER_TEST_COUNT);
    printf("======================================\r\n");
    
    OLED_ShowString(1, 1, "  Test Done");
    char result_str[20];
    sprintf(result_str, "  %d/%d OK", success_count, SERVER_TEST_COUNT);
    OLED_ShowString(2, 1, result_str);
}

/* ==================== 主程序 ==================== */

/**
 * @brief   主函数
 * @details 系统初始化、WiFi连接、服务器通信、传感器数据采集和设备控制的主循环
 * @return  程序退出码（通常不返回）
 */
int main(void)
{
	// 初始化系统
	delay_init(72);              // 初始化延时函数
	usart_init(115200);          // 初始化串口
	LED_Init();                  // 初始化LED
	OLED_Init();                 // 初始化OLED
	RELAY_Init();                // 初始化继电器
	DHT11_Init();                // 初始化温湿度传感器
	LightSensor_Init();          // 初始化光照传感器
//	TOUCH_KEY_Init();            // TODO: 初始化触摸按键（暂时禁用）
//	TOUCH_KEY_EXTI_Init();       // TODO: 初始化触摸按键外部中断（暂时禁用）
	RS485_Init();                // 初始化RS485通信（包含USART3初始化，波特率4800）
	
	// 初始化WiFi模块的串口
	atk_mb026_uart_init(115200);
	printf("[System] WiFi模块串口初始化成功\r\n");
	
	// 配置TCP长连接模式
	printf("[System] 配置TCP长连接模式...\r\n");
	atk_mb026_send_at_cmd("AT+CIPMUX=0", "OK", 2000);  // 单连接模式
	atk_mb026_send_at_cmd("AT+CIPMODE=0", "OK", 2000); // 正常传输模式
	printf("[System] TCP长连接模式配置完成\r\n");
	
	// 初始化服务器通信模块
	ServerComm_Init();
	
	// 清屏
	OLED_Clear();
	OLED_ShowString(1, 1, "  System Init");
	
	// 初始化WiFi模块
	OLED_ShowString(1, 3, "  WiFi Init...");
	if (init_wifi_module()) {
		OLED_ShowString(1, 3, "  WiFi Init OK");
		// 连接WiFi
		OLED_ShowString(1, 5, "  Connecting...");
		if (connect_wifi()) {
			printf("[System] WiFi连接成功，开始上传传感器数据...\r\n");
			OLED_ShowString(1, 5, "  Connected");
			delay_ms(500);
			
			// 建立TCP长连接
			printf("[System] 建立TCP长连接...\r\n");
			OLED_ShowString(3, 1, "  TCP Connect");
			if (ServerComm_Connect() == 0) {
				printf("[System] TCP长连接建立成功\r\n");
				OLED_ShowString(3, 1, "  TCP: OK");
			} else {
				printf("[System] TCP长连接建立失败\r\n");
				OLED_ShowString(3, 1, "  TCP: FAIL");
			}
			delay_ms(500);
			
			// 显示运行状态
			OLED_Clear();
			OLED_ShowString(1, 1, "  Running...");
			OLED_ShowString(2, 1, "  WiFi: OK");
			OLED_ShowString(3, 1, "  TCP: OK");
			OLED_ShowString(4, 1, "  KeepAlive");
		} else {
			OLED_ShowString(1, 5, "  Connect Fail");
		}
	} else {
		OLED_ShowString(1, 3, "  WiFi Init Fail");
	}
	
	// 主循环
	while (1)
	{
		timecount++;
		
		// 检测触摸按键
		uint8_t key = TOUCH_KEY_Scan();
		if (key == 3) {
			RELAY_2(1);
			printf("[Key] 触摸按键C按下，打开继电器2（水泵）\r\n");
			// 上传执行器状态
			if (g_wifi_connected && ServerComm_IsConnected()) {
				ServerComm_UploadActuatorStatus(ACTUATOR_ID_PUMP, 1, 1);
			}
		} else if (key == 4) {
			RELAY_2(0);
			printf("[Key] 触摸按键D按下，关闭继电器2（水泵）\r\n");
			// 上传执行器状态
			if (g_wifi_connected && ServerComm_IsConnected()) {
				ServerComm_UploadActuatorStatus(ACTUATOR_ID_PUMP, 0, 1);
			}
		}
		
		// 每10秒上传一次传感器数据（使用队列方式）
		if (timecount % UPLOAD_INTERVAL_MS == 0) {
			if (g_wifi_connected) {
				// 将所有传感器数据添加到队列
				ServerComm_UploadAllSensors();
			}
		}
		
		// 实时处理队列中的请求（只要队列有数据就处理）
		if (g_wifi_connected) {
			// 检查队列是否有数据
			// 这里简化处理，直接调用处理函数
			ServerComm_ProcessBatch(5);
		}
		
		delay_ms(1);
	}
}
