#include "stm32f10x.h"                  // Device header
#include "Delay.h"
#include "OLED.h"
#include "LED.h"
#include "string.h"
#include "atk_mb026.h"
#include "atk_mb026_uart.h"
#include "usart.h"
#include "demo.h"
#include <stdio.h>

// 全局变量
uint32_t timecount = 0;
uint8_t g_wifi_connected = 0; // WiFi连接状态标志
uint8_t g_server_connected = 0; // 服务器连接状态标志

// 配置参数
#define MAX_WIFI_RETRY 5        // WiFi连接最大重试次数
#define MAX_SERVER_RETRY 3      // 服务器连接最大重试次数
#define WIFI_CHECK_INTERVAL 10000 // WiFi状态检查间隔(ms)
#define SERVER_TEST_COUNT 3     // 服务器测试次数
#define BAIDU_PING_INTERVAL 30000 // 百度Ping测试间隔(ms)

// 服务器信息
#define SERVER_URL "subfastigiated-avis-unreplevinable.ngrok-free.dev"
#define SERVER_PORT "80"
#define SERVER_PATH "/api/monitor/health"

/**
 * @brief 检查WiFi连接状态
 * @return 1: WiFi已连接, 0: WiFi未连接
 */
uint8_t check_wifi_status(void)
{
    uint8_t *ret = NULL;
    if (atk_mb026_send_at_cmd("AT+CWSTATUS", "OK", 1000) == ATK_MB026_EOK) {
        ret = atk_mb026_uart_rx_get_frame();
        if (ret != NULL) {
            if (strstr((const char *)ret, "+CWSTATUS:2") != NULL) {
                return 1; // WiFi已连接
            }
        }
    }
    return 0; // WiFi未连接
}

/**
 * @brief Ping服务器功能
 * @param server_address 服务器地址
 * @return Ping响应时间(ms)，0表示失败或超时
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
                    if (sscanf((const char *)ret, "+PING:%u", &ping_time) == 1) {
                        printf("[DEBUG] Ping响应时间: %lu ms\r\n", ping_time);
                        return ping_time;
                    } else if (sscanf((const char *)ret, "%*[^0-9]%u", &ping_time) == 1) {
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

/**
 * @brief 发送HTTP请求到服务器
 * @param server_url 服务器地址
 * @param server_port 服务器端口
 * @param request HTTP请求内容
 * @return 1: 成功, 0: 失败
 */
uint8_t send_http_request(char *server_url, char *server_port, char *request)
{
    uint8_t ret = 0;
    uint8_t retry = 0;
    
    while (retry < MAX_SERVER_RETRY) {
        // 连接到服务器
        printf("[DEBUG] 尝试连接服务器: %s:%s (尝试 %d/%d)\r\n", server_url, server_port, retry + 1, MAX_SERVER_RETRY);
        OLED_ShowString(3, 1, "  Connecting");
        OLED_ShowString(4, 1, "  Server");
        
        // 重置接收缓冲区
        atk_mb026_uart_rx_restart();
        
        // 强制设置单连接模式
        printf("[DEBUG] 强制设置单连接模式...\r\n");
        atk_mb026_send_at_cmd("AT+CIPMUX=0", "OK", 1000);
        
        if (atk_mb026_connect_tcp_server(server_url, server_port) == ATK_MB026_EOK) {
            printf("[DEBUG] 连接服务器成功\r\n");
            OLED_ShowString(3, 1, "  Connected");
            OLED_ShowString(4, 1, "  Server");
            g_server_connected = 1;
            
            // 清空接收缓冲区
            atk_mb026_uart_rx_restart();
            
            // 使用AT+CIPSEND命令发送数据
            char cmd[32];
            int req_len = strlen(request);
            sprintf(cmd, "AT+CIPSEND=%d", req_len);
            printf("[DEBUG] 发送AT命令: %s\r\n", cmd);
            
            // 发送AT+CIPSEND命令
            if (atk_mb026_send_at_cmd(cmd, ">", 2000) == ATK_MB026_EOK) {
                printf("[DEBUG] 收到'>'提示符，发送HTTP请求\r\n");
                OLED_ShowString(3, 1, "  Sending");
                OLED_ShowString(4, 1, "  Request");
                
                // 清空接收缓冲区
                atk_mb026_uart_rx_restart();
                
                // 发送HTTP请求数据
                atk_mb026_uart_printf((char *)request);
                printf("[DEBUG] HTTP请求已发送\r\n");
                OLED_ShowString(3, 1, "  Sent");
                OLED_ShowString(4, 1, "  Request");
                
                // 等待响应
                printf("[DEBUG] 等待服务器响应...\r\n");
                OLED_ShowString(3, 1, "  Waiting");
                OLED_ShowString(4, 1, "  Response");
                delay_ms(8000); // 增加等待时间
                
                // 处理响应
                uint8_t *response = atk_mb026_uart_rx_get_frame();
                if (response != NULL) {
                    printf("[DEBUG] 收到服务器响应\r\n");
                    // 显示完整的响应内容
                    printf("[Server Test] 收到服务器响应: \r\n");
                    printf("%s\r\n", response);
                    
                    // 检查响应状态
                    if (strstr((const char *)response, "200 OK") != NULL) {
                        printf("[Server Test] 服务器响应正常\r\n");
                        OLED_ShowString(3, 1, "  Server:");
                        OLED_ShowString(4, 1, "  OK");
                        ret = 1;
                    } else if (strstr((const char *)response, "AT+CIPSEND") != NULL) {
                        // 收到AT命令回显，可能是模块状态异常
                        printf("[Server Test] 收到AT命令回显，模块状态异常\r\n");
                        OLED_ShowString(3, 1, "  Module:");
                        OLED_ShowString(4, 1, "  Error");
                        ret = 0;
                    } else {
                        printf("[Server Test] 服务器响应异常\r\n");
                        OLED_ShowString(3, 1, "  Server:");
                        OLED_ShowString(4, 1, "  Error");
                        ret = 1; // 虽然响应异常，但通信成功
                    }
                } else {
                    printf("[Server Test] 未收到服务器响应\r\n");
                    OLED_ShowString(3, 1, "  No");
                    OLED_ShowString(4, 1, "  Response");
                }
            } else {
                printf("[Server Test] 发送AT命令失败\r\n");
                OLED_ShowString(3, 1, "  Cmd:");
                OLED_ShowString(4, 1, "  Fail");
            }
            
            // 关闭TCP连接
            printf("[DEBUG] 关闭TCP连接\r\n");
            atk_mb026_send_at_cmd("AT+CIPCLOSE", "OK", 2000);
            g_server_connected = 0;
            
            // 短暂延迟，确保连接完全关闭
            delay_ms(1000);
            
            if (ret) {
                break; // 成功，退出重试
            }
        } else {
            printf("[Server Test] 连接服务器失败\r\n");
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

/**
 * @brief 测试百度连接
 */
void test_baidu_connectivity(void)
{
    printf("======================================\r\n");
    printf("[Baidu Test] 测试百度连接...\r\n");
    printf("[Baidu Test] 测试地址: www.baidu.com\r\n");
    printf("======================================\r\n");
    
    OLED_ShowString(1, 1, "  Baidu Test");
    OLED_ShowString(2, 1, "  Pinging...");
    
    uint32_t ping_time = ping_server("www.baidu.com");
    if (ping_time > 0) {
        printf("[Baidu Test] Ping百度: 成功 - 响应时间 %lu ms\r\n", ping_time);
        OLED_ShowString(2, 1, "  Success");
        char ping_str[20];
        sprintf(ping_str, "  %lu ms", ping_time);
        OLED_ShowString(3, 1, ping_str);
    } else {
        printf("[Baidu Test] Ping百度: 失败 - 超时或不可达\r\n");
        OLED_ShowString(2, 1, "  Failed");
        OLED_ShowString(3, 1, "  Timeout");
    }
    
    printf("======================================\r\n");
    printf("[Baidu Test] 测试完成\r\n");
    printf("======================================\r\n");
    
    delay_ms(2000);
}

/**
 * @brief 测试服务器健康状态
 */
void test_server_health(void)
{
    printf("======================================\r\n");
    printf("[Server Test] 测试服务器健康状态...\r\n");
    printf("[Server Test] 测试地址: http://%s%s\r\n", SERVER_URL, SERVER_PATH);
    printf("[Server Test] 测试次数: %d次\r\n", SERVER_TEST_COUNT);
    printf("======================================\r\n");
    
    // 准备HTTP请求
    char request[256];
    sprintf(request, "GET %s HTTP/1.1\r\n" 
                   "Host: %s\r\n" 
                   "Connection: close\r\n" 
                   "ngrok-skip-browser-warning: 1\r\n" 
                   "User-Agent: STM32-Client/1.0\r\n" 
                   "Device-ID: %s\r\n" 
                   "\r\n",
                   SERVER_PATH, SERVER_URL, DEMO_WIFI_SSID);
    
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
        uint8_t result = send_http_request((char *)SERVER_URL, (char *)SERVER_PORT, request);
        
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

/**
 * @brief 初始化WiFi模块
 * @return 1: 成功, 0: 失败
 */
uint8_t init_wifi_module(void)
{
    uint8_t ret = 0;
    
    printf("[System] 初始化WiFi模块...\r\n");
    OLED_ShowString(1, 1, "  System Init");
    OLED_ShowString(2, 1, "  WiFi Module");
    
    if (atk_mb026_init(115200) == ATK_MB026_EOK) {
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
 * @brief 连接WiFi网络
 * @return 1: 成功, 0: 失败
 */
uint8_t connect_wifi(void)
{
    uint8_t retry = 0;
    uint8_t ret = 0;
    
    while (retry < MAX_WIFI_RETRY) {
        printf("[WiFi] 连接到WiFi: %s (尝试 %d/%d)\r\n", DEMO_WIFI_SSID, retry + 1, MAX_WIFI_RETRY);
        OLED_ShowString(1, 1, "  WiFi Connect");
        OLED_ShowString(2, 1, "  Connecting");
        
        if (atk_mb026_join_ap(DEMO_WIFI_SSID, DEMO_WIFI_PWD) == ATK_MB026_EOK) {
            printf("[WiFi] WiFi连接成功\r\n");
            OLED_ShowString(2, 1, "  Connected");
            
            // 获取IP地址
            char ip_buf[20] = {0};
            if (atk_mb026_get_ip(ip_buf) == ATK_MB026_EOK) {
                printf("[WiFi] 获取IP地址: %s\r\n", ip_buf);
                OLED_ShowString(3, 1, "  IP:");
                OLED_ShowString(4, 1, ip_buf);
            }
            
            g_wifi_connected = 1;
            ret = 1;
            break;
        } else {
            printf("[WiFi] WiFi连接失败，%d秒后重试\r\n", (retry + 1) * 2);
            OLED_ShowString(2, 1, "  Retry...");
            retry++;
            delay_ms((retry + 1) * 2000); // 递增重试间隔
        }
    }
    
    if (retry >= MAX_WIFI_RETRY) {
        printf("[WiFi] WiFi连接失败，已达到最大重试次数\r\n");
        OLED_ShowString(2, 1, "  Failed");
        ret = 0;
    }
    
    return ret;
}

/**
 * @brief 主函数
 */
int main(void)
{
	// 初始化系统
	delay_init(72);              // 初始化延时函数
	usart_init(115200);          // 初始化串口
	OLED_Init();                 // 初始化OLED
	LED_Init();                  // 初始化LED
	
	// 初始化WiFi模块
	if (init_wifi_module()) {
		// 连接WiFi
		if (connect_wifi()) {
			// 连接完成，准备进行下一步计划
			printf("[System] WiFi连接完成，准备进行下一步计划\r\n");
			OLED_ShowString(1, 1, "  System Ready");
			OLED_ShowString(2, 1, "  Next Step");
			delay_ms(1000);
			
			// 测试服务器健康状态
			test_server_health();
		}
	}
	
	// 主循环
	while (1)
	{
		timecount++;
		
		// 每10秒检查一次WiFi连接状态
		if (timecount % WIFI_CHECK_INTERVAL == 0) {
			uint8_t status = check_wifi_status();
			if (status && !g_wifi_connected) {
				// WiFi重新连接
				printf("[WiFi] WiFi重新连接\r\n");
				OLED_ShowString(1, 1, "  WiFi Status");
				OLED_ShowString(2, 1, "  Reconnected");
				g_wifi_connected = 1;
			} else if (!status && g_wifi_connected) {
				// WiFi连接断开
				printf("[WiFi] WiFi连接断开\r\n");
				OLED_ShowString(1, 1, "  WiFi Status");
				OLED_ShowString(2, 1, "  Disconnected");
				g_wifi_connected = 0;
				
				// 尝试重新连接WiFi
				printf("[WiFi] 尝试重新连接...\r\n");
				if (connect_wifi()) {
					printf("[WiFi] 重新连接成功\r\n");
				}
			} else if (status && g_wifi_connected) {
				// WiFi连接正常
				printf("[WiFi] WiFi连接正常\r\n");
				OLED_ShowString(1, 1, "  WiFi Status");
				OLED_ShowString(2, 1, "  OK");
			}
		}
		
		// 每30秒测试一次百度连接
		if (timecount % BAIDU_PING_INTERVAL == 0 && g_wifi_connected) {
			test_baidu_connectivity();
		}
		
		delay_ms(1);
	}
}
