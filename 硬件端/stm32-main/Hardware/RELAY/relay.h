#ifndef __RELAY_H
#define __RELAY_H	 
#include "sys.h"

#define RELAYPORT	GPIOA	//继电器IO端口
#define RELAY1	GPIO_Pin_14	//继电器1
#define RELAY2	GPIO_Pin_13	//继电器2

void RELAY_Init(void);//继电器初始化
void RELAY_1(u8 c);//继电器1控制
void RELAY_2(u8 c);//继电器2控制
				    
#endif
