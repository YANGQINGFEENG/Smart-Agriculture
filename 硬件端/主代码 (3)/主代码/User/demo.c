/**
 * @file    demo.c
 * @brief   ATK-MB026 WiFi模块TCP透传演示
 * @details 实现WiFi模块初始化、TCP连接、数据传输等功能
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    基于ATK-MB026 WiFi模块和STM32F103微控制器开发
 */

#include "demo.h"
#include "delay.h"
#include "atk_mb026.h"
#include "Key.h"
#include "atk_mb026_receiver.h"
#include "LED.h"
#include <string.h>

/* ==================== 全局变量定义 ==================== */

uint8_t g_is_unvarnished = 0;                       // 透传模式状态标志（0: 普通模式, 1: 透传模式）

extern uint32_t timecount;                          // 外部时间计数变量（ms）

/* ==================== 传感器变量定义 ==================== */

u8 Temp_buffer[3] = {0, 25, 0};                     // 温度数据缓冲区，默认25℃
u8 humidata = 50;                                   // 湿度数据，默认50%
extern vu16 ADC_ConvertedValue[4];                  // ADC转换值，已在AD.c中定义
uint8_t temperature = 25;                           // 温度值，默认25℃
uint8_t servo = 0;                                  // 舵机状态
uint8_t motor = 0;                                  // 电机状态
uint8_t tempdata = 25;                              // 温度数据

/* ==================== 配置参数定义 ==================== */

#define DEMO_TCP_SERVER_IP      ""                  // TCP服务器IP地址
#define DEMO_TCP_SERVER_PORT    ""                  // TCP服务器端口

/* ==================== 其他变量 ==================== */

uint8_t test = 0;                                   // 测试标志
uint8_t mode = 0;                                   // 运行模式

/* ==================== 外部变量声明 ==================== */

extern uint8_t temperature;
extern vu16 ADC_ConvertedValue[4];                  // ADC转换值
extern u8 Temp_buffer[3];                           // 温度数据缓冲区
extern u8 humidata;                                 // 湿度数据
extern uint8_t servo;                               // 舵机状态
extern uint8_t motor;                               // 电机状态
extern uint8_t tempdata;                            // 温度数据

/* ==================== 函数实现 ==================== */

/**
 * @brief   显示IP地址
 * @param   buf IP地址字符串
 */
void demo_show_ip(char *buf) {
    printf("IP: %s\r\n", buf);
}

/**
 * @brief   KEY0按键功能
 * @param   is_unvarnished 透传模式状态
 * @details 在普通模式下执行AT测试，在透传模式下发送测试数据
 */
void demo_key0_fun(uint8_t is_unvarnished) {
    uint8_t ret;
    if (is_unvarnished == 0) {
        ret = atk_mb026_at_test();
        if (ret == 0) {
            printf("AT test success!\r\n");
        } else {
            printf("AT test failed!\r\n");
        }
    } else {
        // 使用标准库发送测试数据
        atk_mb026_uart_printf("This ATK-MB026 TCP Connect Test.\r\n");
    }
}

/**
 * @brief   WKUP按键功能
 * @param   is_unvarnished 透传模式状态指针
 * @details 切换透传模式和普通传输模式
 */
void demo_keywkup_fun(uint8_t *is_unvarnished) {
    uint8_t ret;
    if (*is_unvarnished == 0) {
        /* 等待TCP连接稳定 */
        printf("[DEBUG] 等待TCP连接稳定...\r\n");
        delay_ms(2000);  /* 等待2秒确保连接稳定 */
        
        /* 检查连接状态 */
        printf("[DEBUG] 检查TCP连接状态...\r\n");
        ret = atk_mb026_at_test();  /* 使用AT测试检查模块状态 */
        if (ret != 0)
        {
            printf("[ERROR] 模块状态异常! 错误码: %d\r\n", ret);
        }
        else
        {
            printf("[SUCCESS] 模块状态正常\r\n");
            
            /* 尝试进入透传模式 */
            printf("[DEBUG] 尝试进入透传模式...\r\n");
            ret = atk_mb026_enter_unvarnished();
            if (ret != 0)
            {
                printf("[ERROR] 进入透传模式失败! 错误码: %d\r\n", ret);
                printf("[DEBUG] 可能原因: TCP连接未建立或AT指令响应超时\r\n");
                printf("[INFO] 将使用普通传输模式作为备用方案\r\n");
                
                /* 设置为普通传输模式 */
                ret = atk_mb026_send_at_cmd("AT+CIPMODE=0", "OK", 1000);
                if (ret == 0) {
                    printf("[SUCCESS] 已切换到普通传输模式\r\n");
                    *is_unvarnished = 0;  /* 标记为非透传模式 */
                    g_is_unvarnished = 0;
                } else {
                    printf("[ERROR] 切换到普通传输模式失败\r\n");
                }
            }
            else
            {
                *is_unvarnished = 1;
                g_is_unvarnished = 1; // 更新全局状态
                printf("[SUCCESS] 进入透传模式成功!\r\n");
            }
        }
    } else {
        test = 0;
        atk_mb026_exit_unvarnished();
        *is_unvarnished = 0;
        g_is_unvarnished = 0; // 更新全局状态
        printf("Exit unvarnished!\r\n");
    }
}

/**
 * @brief   上传数据
 * @param   is_unvarnished 透传模式状态
 * @details 在透传模式下接收并显示服务器数据
 */
void demo_upload_data(uint8_t is_unvarnished) {
    uint8_t *buf;
    
    if (is_unvarnished == 1)
    {
        /* 接收来自ATK-MB026 UART的一帧数据 */
        buf = atk_mb026_uart_rx_get_frame();
        if (buf != NULL)
        {
            printf("%s", buf);
            /* 重新开始接收来自ATK-MB026 UART的数据 */
            atk_mb026_uart_rx_restart();
        }
    }
}

/**
 * @brief   运行演示程序
 * @details 初始化WiFi模块，连接AP，建立TCP连接并处理数据传输
 */
void demo_run(void) {
    uint8_t ret;
    char ip_buf[16];
    uint8_t key;
    static uint8_t is_unvarnished = 0; // 改为静态变量，保持状态

    if(mode == 0)
    {
        ret = atk_mb026_init(115200);
        if (ret != 0) {
            printf("ATK-MB026 init failed!\r\n");
        }

        printf("Joining to AP...\r\n");
        ret = atk_mb026_restore();
        delay_ms(1000);
        ret += atk_mb026_at_test();
        ret += atk_mb026_set_mode(1);
        ret += atk_mb026_sw_reset();
        delay_ms(500);
        ret += atk_mb026_ate_config(0);
        ret += atk_mb026_join_ap(DEMO_WIFI_SSID, DEMO_WIFI_PWD);
        ret += atk_mb026_get_ip(ip_buf);
        if (ret != 0) {
            printf("Error to join ap!\r\n");
        }
        demo_show_ip(ip_buf);

        printf("[DEBUG] 尝试连接TCP服务器: %s:%s\r\n", DEMO_TCP_SERVER_IP, DEMO_TCP_SERVER_PORT);
        ret = atk_mb026_connect_tcp_server(DEMO_TCP_SERVER_IP, DEMO_TCP_SERVER_PORT);
        if (ret != 0) {
            printf("[ERROR] TCP服务器连接失败! 错误码: %d\r\n", ret);
            printf("[DEBUG] 请检查服务器IP和端口是否正确\r\n");
        } else {
            printf("[SUCCESS] TCP服务器连接成功!\r\n");
            // 发送连接协议消息
            delay_ms(1000); // 等待连接稳定
            
            char connect_msg[128];
            sprintf(connect_msg, "{\"type\":\"connect\",\"id\":\"TGHY_001\",\"timestamp\":%lu}", 
                (unsigned long)(1750617600000 + (timecount / 1000)));
            
            if (g_is_unvarnished == 1) {
                // 透传模式：直接发送
                atk_mb026_uart_printf("%s", connect_msg);
            } else {
                // 普通传输模式：使用AT+CIPSEND命令
                char cmd[32];
                sprintf(cmd, "AT+CIPSEND=%d", strlen(connect_msg));
                
                uint8_t ret = atk_mb026_send_at_cmd(cmd, ">", 1000);
                if (ret == 0) {
                    atk_mb026_uart_printf("%s", connect_msg);
                    delay_ms(100);
                }
            }
            printf("[DEBUG] 连接协议消息已发送\r\n");
        }
        mode = 1;
        demo_keywkup_fun(&is_unvarnished);
    }

    key = key_scan(1);

    switch (key) {
        case KEY0_PRES:
            demo_key0_fun(is_unvarnished);
            break;
        case WKUP_PRES:
            test = 1;
            break;
        default:
            if (test == 1) 
            {
                // 根据当前模式发送传感器数据
                char json_data[256];
                // 使用LM75A传感器的温度数据，而不是DHT11的tempdata
                float temperature_float = Temp_buffer[1] + (float)Temp_buffer[2] / 10.0;
                sprintf(json_data, "{\"type\":\"sensor_data\",\"temperature\":%.1f,\"humidity\":%.1f,\"light\":%.1f,\"soil_moisture\":70.0,\"timestamp\":%lu}",
                    temperature_float, (float)humidata, (float)((4096 - ADC_ConvertedValue[1])*20000 / 4096), (unsigned long)(1750617600000 + (timecount / 1000)));
                
                if (g_is_unvarnished == 1) {
                    // 透传模式：直接发送数据
                    printf("[DEBUG] 透传模式发送数据\r\n");
                    atk_mb026_uart_printf("%s", json_data);
                } else {
                    // 普通传输模式：使用AT+CIPSEND命令
                    printf("[DEBUG] 普通传输模式发送数据\r\n");
                    char cmd[32];
                    sprintf(cmd, "AT+CIPSEND=%d", strlen(json_data));
                    
                    uint8_t ret = atk_mb026_send_at_cmd(cmd, ">", 1000);
                    if (ret == 0) {
                        atk_mb026_uart_printf("%s", json_data);
                        delay_ms(100); // 等待数据发送完成
                    } else {
                        printf("[ERROR] 普通传输模式发送失败\r\n");
                    }
                }
                Delay_ms(5000);        // 防止数据发送过快
            }
            break;
    }

    // 处理接收到的数据
    atk_mb026_receiver_process();
    
    demo_upload_data(is_unvarnished);
    delay_ms(10);
}
