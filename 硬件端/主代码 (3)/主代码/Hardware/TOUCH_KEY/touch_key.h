#ifndef __TOUCH_KEY_H
#define __TOUCH_KEY_H	 
#include "sys.h"

#define TOUCH_KEYPORT	GPIOA	//触摸按键IO端口
#define TOUCH_KEY_A	GPIO_Pin_0	//触摸按键A
#define TOUCH_KEY_B	GPIO_Pin_1	//触摸按键B
#define TOUCH_KEY_C	GPIO_Pin_2	//触摸按键C
#define TOUCH_KEY_D	GPIO_Pin_3	//触摸按键D

void TOUCH_KEY_Init(void);//初始化
void TOUCH_KEY_EXTI_Init(void);//外部中断初始化
uint8_t TOUCH_KEY_Scan(void);//检测触摸按键状态

				    
#endif
