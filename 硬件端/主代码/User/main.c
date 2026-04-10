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

// 服务器信息 - 已移至ServerComm.h中定义

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
 * @brief 初始化WiFi模块
 * @return 1: 成功, 0: 失败
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
 * @brief 连接WiFi网络
 * @return 1: 成功, 0: 失败
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

/**
 * @brief 发送数据到服务器
 * @param data 要发送的数据
 * @param len 数据长度
 * @return 1: 成功, 0: 失败
 */
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
    // 添加WiFi状态检查
    if (!g_wifi_connected) {
        printf("======================================\r\n");
        printf("[Baidu Test] WiFi未连接，跳过测试\r\n");
        printf("======================================\r\n");
        return;
    }
    
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
 * @brief 主函数
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
//	TOUCH_KEY_Init();            // 初始化触摸按键
//	TOUCH_KEY_EXTI_Init();       // 初始化触摸按键外部中断
	RS485_Init();                // 初始化RS485通信（包含USART3初始化，波特率4800）
	
	// 初始化WiFi模块的串口
	atk_mb026_uart_init(115200);
	printf("[System] WiFi模块串口初始化成功\r\n");
	
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
			// 连接完成，准备进行下一步计划
			printf("[System] WiFi连接完成，准备进行下一步计划\r\n");
			OLED_ShowString(1, 5, "  Connected");
			delay_ms(1000);
			
			// 测试百度连接
			test_baidu_connectivity();
			
			// 测试服务器健康状态
			test_server_health();
			
			// 显示初始状态
			OLED_Clear();
			OLED_ShowString(1, 1, "  System Ready");
			OLED_ShowString(2, 1, "  WiFi: OK");
			OLED_ShowString(3, 1, "  Touch Key: ON");
			OLED_ShowString(4, 1, "  Relay: OFF");
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
		if (key == 3) { // 触摸按键C
			// 打开继电器2（水泵供电）
			RELAY_2(1);
			printf("[System] 触摸按键C按下，打开继电器2（水泵供电）\r\n");
		} else if (key == 4) { // 触摸按键D
			// 关闭继电器2（停止水泵供电）
			RELAY_2(0);
			printf("[System] 触摸按键D按下，关闭继电器2（停止水泵供电）\r\n");
		} else if (key == 1) { // 触摸按键A
			// 发送测试数据到服务器
			if (g_wifi_connected) {
				char test_data[128];
				sprintf(test_data, "{\"type\":\"test\",\"message\":\"Hello from STM32\",\"timestamp\":%lu}", timecount);
				uint16_t len = strlen(test_data);
				printf("[System] 触摸按键A按下，发送测试数据到服务器\r\n");
				send_data_to_server(test_data, len);
			} else {
				printf("[System] WiFi未连接，无法发送数据\r\n");
			}
		}
		
		// 处理串口数据
		if (g_usart_rx_sta & 0x8000) {
			// 有数据从串口1接收
			printf("[System] 收到串口数据: %s\r\n", g_usart_rx_buf);
			
			// 清空接收缓冲区
			g_usart_rx_sta = 0;
		}
		
		// 每10秒检查一次WiFi连接状态
		if (timecount % WIFI_CHECK_INTERVAL == 0) {
			uint8_t status = check_wifi_status();
			if (status && !g_wifi_connected) {
				// WiFi重新连接
				printf("[WiFi] WiFi重新连接\r\n");
				g_wifi_connected = 1;
				OLED_ShowString(1, 5, "  Connected");
			} else if (!status && g_wifi_connected) {
				// WiFi连接断开
				printf("[WiFi] WiFi连接断开\r\n");
				g_wifi_connected = 0;
				OLED_ShowString(1, 5, "  Disconnected");
				
				// 尝试重新连接WiFi
				printf("[WiFi] 尝试重新连接...\r\n");
				OLED_ShowString(1, 5, "  Reconnecting");
				if (connect_wifi()) {
					printf("[WiFi] 重新连接成功\r\n");
					OLED_ShowString(1, 5, "  Connected");
				} else {
					OLED_ShowString(1, 5, "  Reconnect Fail");
				}
			} else if (status && g_wifi_connected) {
				// WiFi连接正常
				printf("[WiFi] WiFi连接正常\r\n");
				OLED_ShowString(1, 5, "  Connected");
			}
		}
		
		// 定期测试百度连接
		if (timecount % BAIDU_PING_INTERVAL == 0) {
			test_baidu_connectivity();
		}
		
		// 每2分钟读取一次传感器数据并发送到服务器
		if (timecount % 120000 == 0) {
			// 读取温湿度数据
			if (DHT11_ReadData() == 0) {
				uint8_t temp = DHT11_GetTemperature();
				uint8_t humi = DHT11_GetHumidity();
				// 读取光照数据
				uint16_t light_raw = LightSensor_Read();
				uint8_t light_percent = LightSensor_GetPercentage();
				// 读取土壤传感器数据
				float soil_moisture = 0;
				float soil_temp = 0;
				uint16_t soil_ec = 0;
				float soil_ph = 0;
				uint8_t soil_status = SoilSensor_ReadData(&soil_moisture, &soil_temp, &soil_ec, &soil_ph);
				
				// 在串口助手上显示数据
				if (soil_status == 0) {
					printf("[Sensor] 温度: %d°C, 湿度: %d%%, 光照: %d (%.1f%%), 土壤湿度: %.1f%%, 土壤温度: %.1f°C, 电导率: %dμS/cm, PH值: %.1f\r\n", 
						temp, humi, light_raw, (float)light_percent, soil_moisture, soil_temp, soil_ec, soil_ph);
				} else {
					printf("[Sensor] 温度: %d°C, 湿度: %d%%, 光照: %d (%.1f%%), 土壤数据: N/A\r\n", 
						temp, humi, light_raw, (float)light_percent);
				}
				
				// 发送数据到服务器
				if (g_wifi_connected) {
					// 发送空气温度数据
					ServerComm_SendSensorData(SENSOR_ID_TEMPERATURE, temp);
					delay_ms(500);
					
					// 发送空气湿度数据
					ServerComm_SendSensorData(SENSOR_ID_HUMIDITY, humi);
					delay_ms(500);
					
					// 发送光照数据
					ServerComm_SendSensorData(SENSOR_ID_LIGHT, light_percent);
					delay_ms(500);
					
					// 发送土壤数据
					if (soil_status == 0) {
						// 发送土壤湿度数据
						ServerComm_SendSensorData(SENSOR_ID_SOIL_MOISTURE, soil_moisture);
						delay_ms(500);
						
						// 发送土壤温度数据
						ServerComm_SendSensorData(SENSOR_ID_SOIL_TEMPERATURE, soil_temp);
						delay_ms(500);
					}
				}
				
				// 在OLED上显示数据
				OLED_Clear();
				OLED_ShowString(1, 1, "  Sensor Data");
				char buf[20];
				sprintf(buf, "  Temp: %d", temp);
				OLED_ShowString(2, 1, buf);
				sprintf(buf, "  Humi: %d%%", humi);
				OLED_ShowString(3, 1, buf);
				if (soil_status == 0) {
					sprintf(buf, "  Soil: %.1f%%", soil_moisture);
					OLED_ShowString(4, 1, buf);
				} else {
					sprintf(buf, "  Light: %d%%", light_percent);
					OLED_ShowString(4, 1, buf);
				}
			} else {
				printf("[Sensor] 温湿度传感器读取失败\r\n");
			}
		}
		
		delay_ms(1);
	}
}
