#ifndef __RS485_H
#define __RS485_H

#include "stm32f10x.h"
#include <stdarg.h>
#include <stdio.h>
#include <string.h>

// RS485控制引脚定义 - 使用GPIOA_Pin_8
#define RS485PORT	GPIOA
#define RS485_RE	GPIO_Pin_8

// USART3接收缓冲区大小
#define USART3_REC_LEN		64

// 外部变量声明
extern uint8_t USART3_RX_BUF[USART3_REC_LEN];
extern uint16_t USART3_RX_STA;

void RS485_Init(void);
void RS485_printf(char *fmt, ...);
void RS485_SendHex(uint8_t *data, uint8_t len);
void USART3_Init(uint32_t BaudRate);

#endif
