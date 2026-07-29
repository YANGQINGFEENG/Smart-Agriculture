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
#include "atk_mb026_uart.h"
#include "demo.h"
#include "../Hardware/RELAY/relay.h"
#include "../Hardware/TOUCH_KEY/touch_key.h"
#include "../Hardware/OLED.h"
#include "../Hardware/OLED_Display.h"
#include "../Hardware/dht11.h"
#include "../Hardware/LightSensor.h"
#include "../Hardware/RS485.h"
#include "../Hardware/SoilSensor.h"
#include "../Hardware/ServerComm.h"
#include "../Hardware/PrintManager.h"
#include "../Hardware/atk_d43.h"
#include <stdio.h>

/* ==================== 全局变量定义 ==================== */

uint32_t timecount = 0;                  // 系统运行时间计数器（ms）
uint8_t g_4g_connected = 0;              // 4G连接状态标志（0: 未连接, 1: 已连接）
uint8_t g_server_connected = 0;          // 服务器连接状态标志（0: 未连接, 1: 已连接）

/* ==================== 配置参数定义 ==================== */

#define MAX_4G_RETRY 5                  // 4G连接最大重试次数
#define MAX_SERVER_RETRY 3               // 服务器连接最大重试次数
#define _4G_CHECK_INTERVAL 50000        // 4G状态检查间隔（ms）
#define SERVER_TEST_COUNT 3              // 服务器测试次数
#define BAIDU_PING_INTERVAL 30000        // 百度Ping测试间隔（ms）

// 服务器信息 - 已移至ServerComm.h中定义

/* ==================== 4G连接功能 ==================== */

/**
 * @brief   初始化4G模块
 * @details 初始化ATK-D4X 4G模块，设置工作模式和采集模式
 * @return  初始化结果
 * @retval  1: 初始化成功
 * @retval  0: 初始化失败
 * @note    使用MQTT工作模式，关闭采集功能
 */
uint8_t init_4g_module(void)
{
    uint8_t ret = 0;
    
    printf("[System] 初始化4G模块...\r\n");
    OLED_ShowString(1, 1, "  System Init");
    OLED_ShowString(2, 1, "  4G Module");
    
    // 初始化4G模块，使用MQTT工作模式，关闭采集功能
    int result = dtu_config_init(DTU_WORKMODE_MQTT, DTU_COLLECT_OFF);
    if (result == 0) {
        printf("[System] 4G模块初始化成功\r\n");
        OLED_ShowString(2, 1, "  Init: OK");
        ret = 1;
    } else {
        printf("[System] 4G模块初始化失败，错误码: %d\r\n", result);
        OLED_ShowString(2, 1, "  Init: Failed");
        ret = 0;
    }
    
    return ret;
}

/* ==================== 服务器通信功能 ==================== */

/**
 * @brief   发送数据到服务器（4G版本）
 * @details 通过4G模块发送数据到服务器
 * @param   data 要发送的数据
 * @param   len 数据长度
 * @return  发送结果
 * @retval  1: 发送成功
 * @retval  0: 发送失败
 * @note    4G模块在MQTT模式下自动透传数据
 */
uint8_t send_data_to_server(char *data, uint16_t len)
{
    uint8_t ret = 0;
    
    if (g_4g_connected) {
        send_data_to_dtu((uint8_t *)data, len);
        ret = 1;
        printf("[Server] 通过4G模块发送数据 (%d字节)\r\n", len);
    } else {
        printf("[Server] 4G未连接，发送失败\r\n");
    }
    
    return ret;
}

/**
 * @brief   Ping服务器功能（4G版本）
 * @details 使用4G模块的基站定位功能测试网络连通性
 * @param   server_address 服务器地址（保留参数，未使用）
 * @return  网络连通性测试结果
 * @retval  1: 网络连接正常
 * @retval  0: 网络连接失败
 * @note    4G模块使用基站定位功能验证网络连接
 */
uint32_t ping_server(const char *server_address)
{
    uint8_t location_buf[256] = {0};
    int location_result = dtu_base_station_location_info(location_buf, sizeof(location_buf));
    
    if (location_result == 0) {
        printf("[DEBUG] 4G网络连接正常\r\n");
        printf("[DEBUG] 基站定位信息: %s\r\n", location_buf);
        return 1; // 返回1表示网络连接正常
    } else {
        printf("[DEBUG] 4G网络连接失败，错误码: %d\r\n", location_result);
        return 0; // 返回0表示网络连接失败
    }
}

/* ==================== 测试功能 ==================== */

/**
 * @brief   测试百度连接
 * @details 通过Ping命令测试与百度的网络连通性
 * @note    仅在WiFi已连接时执行测试
 */
void test_4g_connectivity(void)
{
    // 添加4G状态检查
    if (!g_4g_connected) {
        printf("======================================\r\n");
        printf("[4G Test] 4G未连接，跳过测试\r\n");
        printf("======================================\r\n");
        return;
    }
    
    printf("======================================\r\n");
    printf("[Network Test] 测试4G网络连通性...\r\n");
    printf("======================================\r\n");
    
    OLED_ShowString(1, 1, "  Network Test");
    OLED_ShowString(2, 1, "  Testing 4G...");
    
    // 测试4G模块的基站定位功能，验证网络连接
    uint8_t location_buf[256] = {0};
    int location_result = dtu_base_station_location_info(location_buf, sizeof(location_buf));
    if (location_result == 0) {
        printf("[Network Test] 4G基站定位: 成功\r\n");
        printf("[Network Test] 定位信息: %s\r\n", location_buf);
        OLED_ShowString(2, 1, "  4G: OK");
    } else {
        printf("[Network Test] 4G基站定位: 失败 (错误码: %d)\r\n", location_result);
        OLED_ShowString(2, 1, "  4G: FAIL");
        printf("[Network Test] 可能原因:\r\n");
        printf("[Network Test]   1. SIM卡未正确安装\r\n");
        printf("[Network Test]   2. 4G信号弱\r\n");
        printf("[Network Test]   3. 网络服务不可用\r\n");
    }
    
    delay_ms(2000);
    
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
	
	// 初始化4G模块的串口（使用USART2，PA2/PA3）
	atk_mb026_uart_init(115200);
	printf("[System] 4G模块串口初始化成功\r\n");
	
	// 4G模块默认已配置为透传模式，无需额外配置TCP参数
	printf("[System] 4G模块串口配置完成\r\n");
	
	// 初始化打印管理器
	PrintManager_Init();
	
	// 配置打印管理器：只打印服务器和4G模块的信息
	PrintManager_SetLevel(PRINT_LEVEL_INFO);  // 设置打印级别为INFO，不打印DEBUG信息
	PrintManager_SetModule(PRINT_MODULE_ALL, 0);  // 先禁用所有模块
	PrintManager_SetModule(PRINT_MODULE_SERVER, 1);  // 启用服务器通信模块
	PrintManager_SetModule(PRINT_MODULE_ACTUATOR, 1);  // 启用执行器模块
	
	// 初始化服务器通信模块
	ServerComm_Init();
	
	// 初始化OLED显示管理
	OLED_Display_Init();
	
	// 清屏
	OLED_Clear();
	OLED_ShowString(1, 1, "  System Init");
	
	// 初始化4G模块
	OLED_ShowString(1, 3, "  4G Init...");
	if (init_4g_module()) {
		OLED_ShowString(1, 3, "  4G Init OK");
		// 4G模块初始化成功后自动连接网络
		OLED_ShowString(1, 5, "  Connected");
		printf("[System] 4G模块初始化成功，开始上传传感器数据...\r\n");
		delay_ms(500);
		
		// 4G模块已在初始化时配置为MQTT模式，自动连接服务器
		printf("[System] 4G模块已配置为MQTT模式\r\n");
		OLED_ShowString(3, 1, "  MQTT: OK");
		delay_ms(500);
		
		// 显示运行状态
		OLED_Clear();
		OLED_ShowString(1, 1, "  Running...");
		OLED_ShowString(2, 1, "  4G: OK");
		OLED_ShowString(3, 1, "  MQTT: OK");
		OLED_ShowString(4, 1, "  KeepAlive");
		g_4g_connected = 1;
	} else {
		OLED_ShowString(1, 3, "  4G Init Fail");
		g_4g_connected = 0;
	}
	
	// 主循环
	// 双保险机制：
	// 1. 主动推送：定期查询服务器待执行指令（每5秒）
	// 2. 被动同步：上传状态时触发强制同步
	while (1)
	{
		timecount++;
		
		// 检测触摸按键
	uint8_t key = TOUCH_KEY_Scan();
	if (key == 1) {
		// 触摸按键A：切换显示模式
		OLED_Display_CycleMode();
	} else if (key == 3) {
		// 触摸按键C：已禁用直接控制
		// 所有执行器控制完全由服务器指令通过WiFi驱动
		//printf("[Main] 触摸按键C按下（水泵控制已禁用，请使用网页端控制）\r\n");
	} else if (key == 4) {
		// 触摸按键D：已禁用直接控制
		// 所有执行器控制完全由服务器指令通过WiFi驱动
		//printf("[Main] 触摸按键D按下（水泵控制已禁用，请使用网页端控制）\r\n");
	}
	
	// 处理4G模块接收到的数据
	if (g_4g_connected) {
		// 这里可以添加4G模块数据处理代码
		// ServerComm_Process4GData();
	}
	
	// 更新OLED显示
	OLED_Display_Update();
	
	// 每10秒上传一次传感器数据（使用队列方式）
	if (timecount % UPLOAD_INTERVAL_MS == 0) {
		if (g_4g_connected) {
			// 将所有传感器数据添加到队列
			ServerComm_UploadAllSensors();
		}
	}
	
	// 每5秒主动查询一次待执行的控制指令（主动推送机制）
	// 这确保即使硬件端不上传状态，也能及时接收服务器的控制指令
	if (timecount % 500 == 0) {
		if (g_4g_connected) {
			printf("[Main] 定期查询待执行指令...\r\n");
			
			// 查询风扇指令
			int fan_command_id = 0;
			char fan_command[16] = {0};
			uint8_t fan_result = ServerComm_CheckAndExecuteCommand(
				ACTUATOR_ID_FAN, &fan_command_id, fan_command);
			
			if (fan_result == 1) {
				// 有待执行的指令，已自动执行并确认
				printf("[Main] 风扇指令已执行: ID=%d, 指令=%s\r\n", 
					   fan_command_id, fan_command);
			}
			
			// 查询水泵指令
			int pump_command_id = 0;
			char pump_command[16] = {0};
			uint8_t pump_result = ServerComm_CheckAndExecuteCommand(
				ACTUATOR_ID_PUMP, &pump_command_id, pump_command);
			
			if (pump_result == 1) {
				// 有待执行的指令，已自动执行并确认
				printf("[Main] 水泵指令已执行: ID=%d, 指令=%s\r\n", 
					   pump_command_id, pump_command);
			}
		}
	}
	
	// 实时处理队列中的请求（只要队列有数据就处理）
	if (g_4g_connected) {
		// 检查队列是否有数据
		// 这里简化处理，直接调用处理函数
		ServerComm_ProcessBatch(5);
		
		// 处理指令队列中的指令
		ServerComm_ProcessCommandQueue();
	}
	
	delay_ms(1);
	}
}
