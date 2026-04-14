/**
 ****************************************************************************************************
 * @file        sys_config.h
 * @author      Embedded System Team
 * @version     V2.0.0
 * @date        2026-04-13
 * @brief       系统配置文件 - 硬件参数、协议参数、功能配置
 ****************************************************************************************************
 */

#ifndef __SYS_CONFIG_H
#define __SYS_CONFIG_H

#ifdef __cplusplus
extern "C" {
#endif

/* ==================================== 系统时钟配置 ==================================== */
#define SYS_CLOCK_FREQ              72000000UL      /* 系统时钟频率 72MHz */
#define SYSTICK_FREQ                1000UL           /* SysTick中断频率 1kHz */

/* ==================================== 串口通信配置 ==================================== */
/* 调试串口配置 */
#define DEBUG_USART                 USART1
#define DEBUG_USART_BAUDRATE        115200
#define DEBUG_USART_IRQn            USART1_IRQn
#define DEBUG_USART_IRQHandler      USART1_IRQHandler

/* WiFi模块串口配置 */
#define WIFI_USART                  USART3
#define WIFI_USART_BAUDRATE         115200
#define WIFI_USART_IRQn             USART3_IRQn
#define WIFI_USART_IRQHandler       USART3_IRQHandler
#define WIFI_UART_DMA_CHANNEL       DMA1_Channel2
#define WIFI_UART_DMA_IRQn          DMA1_Channel2_IRQn

/* 串口缓冲区大小 */
#define UART_RX_BUF_SIZE            512
#define UART_TX_BUF_SIZE            512
#define DMA_BUFFER_SIZE             256

/* ==================================== WiFi/TCP配置 ==================================== */
#define WIFI_SSID                    "YourWiFiSSID"
#define WIFI_PASSWORD                "YourWiFiPassword"
#define SERVER_IP                    "192.168.1.100"
#define SERVER_PORT                  "8888"

#define WIFI_CONNECT_TIMEOUT         15000     /* WiFi连接超时(ms) */
#define TCP_CONNECT_TIMEOUT          10000     /* TCP连接超时(ms) */
#define TCP_KEEP_ALIVE_INTERVAL      30000     /* TCP心跳间隔(ms) */
#define MAX_WIFI_RETRY               5          /* WiFi最大重试次数 */
#define MAX_TCP_RETRY                3          /* TCP最大重试次数 */

/* ==================================== 数据传输配置 ==================================== */
#define DATA_SEND_INTERVAL           5000       /* 数据发送间隔(ms) */
#define SENSOR_DATA_BUF_SIZE         128

/* 数据帧定义 */
#define FRAME_HEADER                 0xAA
#define FRAME_FOOTER                 0x55
#define DEVICE_ID                    "TGHY001"

/* ==================================== 传感器配置 ==================================== */
#define ADC_SAMPLE_INTERVAL          100        /* ADC采样间隔(ms) */

/* ==================================== 看门狗配置 ==================================== */
#define IWDG_PRESCALER               IWDG_Prescaler_256
#define IWDG_RELOAD_VALUE            0x0FFF     /* 约4秒超时 */
#define WDT_FEED_INTERVAL            1000       /* 喂狗间隔(ms) */

/* ==================================== 日志配置 ==================================== */
#define LOG_LEVEL_DEBUG              0
#define LOG_LEVEL_INFO               1
#define LOG_LEVEL_WARN               2
#define LOG_LEVEL_ERROR              3
#define CURRENT_LOG_LEVEL            LOG_LEVEL_DEBUG

#define LOG_ENABLED                  1

/* ==================================== 功能开关 ==================================== */
#define USE_DMA_TRANSMIT             1
#define USE_LONG_TCP_CONNECTION      1
#define USE_BINARY_PROTOCOL          1
#define USE_WATCHDOG                 1
#define USE_SENSOR_DATA_CACHE        1

#ifdef __cplusplus
}
#endif

#endif
