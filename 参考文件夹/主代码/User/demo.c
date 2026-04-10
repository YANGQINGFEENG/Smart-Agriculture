/**
 ****************************************************************************************************
 * @file        demo.c
 * @author      �֡짦���-�٧ԧ�������(ALIENTEK)
 * @version     V1.0
 * @date        2024-11-28
 * @brief       ATK-MB026��?����TCP������?�����ҧ�
 * @license     Copyright (c) 2020-2032, ����اߧ��ѧѧ��ӧ罹��٧ԧ��������ԧѧ��৫?����
 ****************************************************************************************************
 * @attention
 *
 * �����ҧ맸����?:�֡짦���-�٧� M48Z-M3�٧�ѧ�������������STM32F103����
 * �էܧ��᧼�ԧ���:www.yuanzige.com
 * ������?���ݧ���:www.openedv.com
 * ��?������?�ا�:www.alientek.com
 * ������?���ڧا�:openedv.taobao.com
 *
 ****************************************************************************************************
 */

#include "demo.h"
#include "delay.h"
#include "atk_mb026.h"
#include "Key.h"
#include "atk_mb026_receiver.h"
#include "LED.h"
#include <string.h>

// 全局变量定义
uint8_t g_is_unvarnished = 0; // 透传模式状态标志

extern uint32_t timecount; // 外部时间计数变量

// 定义缺失的传感器变量
u8 Temp_buffer[3] = {0, 25, 0};           // 温度数据缓冲区，默认25℃
u8 humidata = 50;        // 湿度数据，默认50%
extern vu16 ADC_ConvertedValue[4]; // ADC转换值，已在AD.c中定义
uint8_t temperature = 25; // 温度值，默认25℃
uint8_t servo = 0; // 舵机状态
uint8_t motor = 0; // 电机状态
uint8_t tempdata = 25; // 温度数据

#define DEMO_TCP_SERVER_IP      ""
#define DEMO_TCP_SERVER_PORT    ""


//#define DEMO_WIFI_SSID          "Redmi Note 11 5G"
//#define DEMO_WIFI_PWD           "244466666"
//#define DEMO_TCP_SERVER_IP      "192.168.90.58"
//#define DEMO_TCP_SERVER_PORT    "5000"

uint8_t test = 0;
uint8_t mode = 0;

extern uint8_t temperature;
extern vu16 ADC_ConvertedValue[4]; //ADC����ا����觩������٧�
extern u8 Temp_buffer[3];           //���������������᧾��ا�
extern u8 humidata;        //��?�����������᧾��ا�
extern uint8_t servo;
extern uint8_t motor;        //���觭???���駭?�����٧���?����ا�����			
extern uint8_t tempdata;

/* ���ӿ������������ */
//static void handle_control_command(const char* data, uint16_t len)
//{
//    // ����LED������
//    if (strstr(data, "LED_ON") != NULL) {
//        printf("Turning LED on\r\n");
//        LED1_ON();  // ��LED
//    } 
//    else if (strstr(data, "LED_OFF") != NULL) {
//        printf("Turning LED off\r\n");
//        LED1_OFF();  // �ر�LED
//    }
//    // ���Ӹ�������߼�...
//    else if (strstr(data, "MOTOR_ON") != NULL) {
//        printf("Turning motor on\r\n");
//        // Motor_On();
//    }
//    else if (strstr(data, "MOTOR_OFF") != NULL) {
//        printf("Turning motor off\r\n");
//        // Motor_Off();
//    }
//}

void demo_show_ip(char *buf) {
    printf("IP: %s\r\n", buf);
}

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
        // ʹ�ñ�׼����ⷢ������
        atk_mb026_uart_printf("This ATK-MB026 TCP Connect Test.\r\n");
    }
}

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

void demo_upload_data(uint8_t is_unvarnished) {
    uint8_t *buf;
    
    if (is_unvarnished == 1)
    {
        /* ��������ATK-MB026 UART��һ֡���� */
        buf = atk_mb026_uart_rx_get_frame();
        if (buf != NULL)
        {
            printf("%s", buf);
            /* ���¿�ʼ��������ATK-MB026 UART������ */
            atk_mb026_uart_rx_restart();
        }
    }
}

void demo_run(void) {
    uint8_t ret;
    char ip_buf[16];
    uint8_t key;
    static uint8_t is_unvarnished = 0; // 改为静态变量，保持状态

////	// ���ûص�����
////	atk_mb026_receiver_set_callback(handle_control_command);

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
                Delay_ms(5000);        //防止数据发送过快
            }
            break;
    }

    // �������յ�������
    atk_mb026_receiver_process();
    
    demo_upload_data(is_unvarnished);
    delay_ms(10);
}


