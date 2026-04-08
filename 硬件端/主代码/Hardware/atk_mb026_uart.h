/**
 ****************************************************************************************************
 * @file        atk_mb026_uart.h
 * @author      ����ԭ���Ŷ�(ALIENTEK)
 * @version     V1.0
 * @date        2024-11-28
 * @brief       ATK-MB026ģ��UART�ӿ���������
 * @license     Copyright (c) 2020-2032, �������������ӿƼ����޹�˾
 ****************************************************************************************************
 * @attention
 *
 * ʵ��ƽ̨:����ԭ�� M48Z-M3��Сϵͳ��STM32F103��
 * ������Ƶ:www.yuanzige.com
 * ������̳:www.openedv.com
 * ��˾��ַ:www.alientek.com
 * �����ַ:openedv.taobao.com
 *
 ****************************************************************************************************
 */

#ifndef __ATK_MB026_UART_H
#define __ATK_MB026_UART_H

#include "stm32f10x.h"
#include "delay.h"

/* ���Ŷ��� */
#define ATK_MB026_UART_TX_GPIO_PORT           GPIOA
#define ATK_MB026_UART_TX_GPIO_PIN            GPIO_Pin_2
#define ATK_MB026_UART_TX_GPIO_CLK            RCC_APB2Periph_GPIOA

#define ATK_MB026_UART_RX_GPIO_PORT           GPIOA
#define ATK_MB026_UART_RX_GPIO_PIN            GPIO_Pin_3
#define ATK_MB026_UART_RX_GPIO_CLK            RCC_APB2Periph_GPIOA

#define ATK_MB026_TIM_INTERFACE               TIM3
#define ATK_MB026_TIM_IRQn                    TIM3_IRQn
#define ATK_MB026_TIM_IRQHandler              TIM3_IRQHandler
#define ATK_MB026_TIM_CLK_ENABLE()            RCC_APB1PeriphClockCmd(RCC_APB1Periph_TIM3, ENABLE)
#define ATK_MB026_TIM_PRESCALER               60000

#define ATK_MB026_UART_INTERFACE              USART2
#define ATK_MB026_UART_IRQn                   USART2_IRQn
#define ATK_MB026_UART_IRQHandler             USART2_IRQHandler
#define ATK_MB026_UART_CLK_ENABLE()           RCC_APB1PeriphClockCmd(RCC_APB1Periph_USART2, ENABLE)

/* UART�շ������С */
#define ATK_MB026_UART_RX_BUF_SIZE            256
#define ATK_MB026_UART_TX_BUF_SIZE            256

/* �������� */
void atk_mb026_uart_printf(char *fmt, ...);       /* ATK-MB026 UART printf */
void atk_mb026_uart_rx_restart(void);             /* ATK-MB026 UART���¿�ʼ�������� */
uint8_t *atk_mb026_uart_rx_get_frame(void);       /* ��ȡATK-MB026 UART���յ���һ֡���� */
uint16_t atk_mb026_uart_rx_get_frame_len(void);   /* ��ȡATK-MB026 UART���յ���һ֡���ݵĳ��� */
void atk_mb026_uart_init(uint32_t baudrate);      /* ATK-MB026 UART��ʼ�� */
void usart2_send_data(const uint8_t *data, uint16_t len); /* USART2发送数据 */

#endif


