/**
 * @file    usart.h
 * @brief   串口驱动头文件
 * @details 定义USART1串口的初始化、中断处理和数据接收功能
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    默认使用USART1，可通过修改宏定义支持其他串口
 */

#ifndef __USART_H
#define __USART_H

#include "stm32f10x.h"
#include "stdio.h"

/* ==================== 串口配置宏定义 ==================== */

/* 默认使用USART1 */
/* 注意: 通过修改以下宏定义,可以支持USART1~UART5中的任意一个串口 */

#define USART_TX_GPIO_PORT                  GPIOA
#define USART_TX_GPIO_PIN                   GPIO_Pin_9
#define USART_TX_GPIO_CLK_ENABLE()          RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE)

#define USART_RX_GPIO_PORT                  GPIOA
#define USART_RX_GPIO_PIN                   GPIO_Pin_10
#define USART_RX_GPIO_CLK_ENABLE()          RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE)

#define USART_UX                            USART1
#define USART_UX_IRQn                       USART1_IRQn
#define USART_UX_IRQHandler                 USART1_IRQHandler
#define USART_UX_CLK_ENABLE()               RCC_APB2PeriphClockCmd(RCC_APB2Periph_USART1, ENABLE)

/* ==================== 接收缓冲区配置 ==================== */

#define USART_REC_LEN               200         /* 接收缓冲区最大字节数 200 */
#define USART_EN_RX                 1           /* 使能（1）/禁止（0）串口接收 */
#define RXBUFFERSIZE                1           /* 接收缓冲区大小 */

/* ==================== 外部变量声明 ==================== */

extern uint8_t g_usart_rx_buf[USART_REC_LEN];  /* 接收缓冲区,最大USART_REC_LEN个字节,末字节为换行符 */
extern uint16_t g_usart_rx_sta;                 /* 接收状态标记 */
extern uint8_t g_rx_buffer[RXBUFFERSIZE];       /* HAL库USART接收Buffer */

/* ==================== 函数声明 ==================== */

/**
 * @brief   串口初始化函数
 * @param   bound 波特率
 * @note    注意: 必须正确设置时钟源,否则串口波特率就会显示异常
 *          对于USART的时钟源在sys_stm32_clock_init()函数中已经设置过了
 */
void usart_init(uint32_t bound);

#endif
