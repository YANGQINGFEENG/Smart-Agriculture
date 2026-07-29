/**
 * @file    atk_mb026_uart.h
 * @brief   ATK-MB026 WiFi模块UART接口驱动头文件
 * @details 定义ATK-MB026 WiFi模块的UART接口初始化和通信函数
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    基于STM32F103微控制器，使用USART2
 */

#ifndef __ATK_MB026_UART_H
#define __ATK_MB026_UART_H

#include "stm32f10x.h"
#include "delay.h"

/* ==================== 引脚定义 - 使用PA2/PA3 (USART2) ==================== */

#define ATK_MB026_UART_TX_GPIO_PORT           GPIOA
#define ATK_MB026_UART_TX_GPIO_PIN            GPIO_Pin_2          // PA2
#define ATK_MB026_UART_TX_GPIO_CLK            RCC_APB2Periph_GPIOA | RCC_APB2Periph_AFIO

#define ATK_MB026_UART_RX_GPIO_PORT           GPIOA
#define ATK_MB026_UART_RX_GPIO_PIN            GPIO_Pin_3          // PA3
#define ATK_MB026_UART_RX_GPIO_CLK            RCC_APB2Periph_GPIOA | RCC_APB2Periph_AFIO

/* ==================== 定时器定义 ==================== */

#define ATK_MB026_TIM_INTERFACE               TIM2
#define ATK_MB026_TIM_IRQn                    TIM2_IRQn
#define ATK_MB026_TIM_IRQHandler              TIM2_IRQHandler
#define ATK_MB026_TIM_CLK_ENABLE()            RCC_APB1PeriphClockCmd(RCC_APB1Periph_TIM2, ENABLE)
#define ATK_MB026_TIM_PRESCALER               60000

/* ==================== UART接口定义 ==================== */

#define ATK_MB026_UART_INTERFACE              USART2
#define ATK_MB026_UART_IRQn                   USART2_IRQn
#define ATK_MB026_UART_IRQHandler             USART2_IRQHandler
#define ATK_MB026_UART_CLK_ENABLE()           RCC_APB1PeriphClockCmd(RCC_APB1Periph_USART2, ENABLE)

/* ==================== 缓冲区大小定义 ==================== */

#define ATK_MB026_UART_RX_BUF_SIZE            1024                // 接收缓冲区大小（增大以容纳HTTP响应）
#define ATK_MB026_UART_TX_BUF_SIZE            512                 // 发送缓冲区大小

/* ==================== 函数声明 ==================== */

/**
 * @brief   ATK-MB026 UART printf函数
 * @param   fmt 格式化字符串
 */
void atk_mb026_uart_printf(char *fmt, ...);

/**
 * @brief   ATK-MB026 UART printf函数（阻塞方式）
 * @param   fmt 格式化字符串
 */
void atk_mb026_uart_printf_blocking(char *fmt, ...);

/**
 * @brief   等待发送完成
 */
void atk_mb026_uart_wait_tx_done(void);

/**
 * @brief   通过USART2发送数据（阻塞方式）
 * @param   data 要发送的数据
 * @param   len 数据长度
 */
void usart2_send_data_blocking(const uint8_t *data, uint16_t len);

/**
 * @brief   ATK-MB026 UART重新开始接收数据
 */
void atk_mb026_uart_rx_restart(void);

/**
 * @brief   获取ATK-MB026 UART接收到的一帧数据
 * @return  NULL: 未接收到完整帧
 *          其他: 指向接收数据缓冲区的指针
 */
uint8_t *atk_mb026_uart_rx_get_frame(void);

/**
 * @brief   获取ATK-MB026 UART接收到的一帧数据的长度
 * @return  接收到的一帧数据的长度
 */
uint16_t atk_mb026_uart_rx_get_frame_len(void);

/**
 * @brief   ATK-MB026 UART初始化
 * @param   baudrate UART波特率
 */
void atk_mb026_uart_init(uint32_t baudrate);

/**
 * @brief   通过USART2发送数据（非阻塞方式）
 * @param   data 要发送的数据
 * @param   len 数据长度
 */
void usart2_send_data(const uint8_t *data, uint16_t len);

#endif
