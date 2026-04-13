#ifndef __TOUCH_KEY_H
#define __TOUCH_KEY_H	 
#include "sys.h"
#include "stm32f10x_exti.h"
#include "stm32f10x_gpio.h"
#include "misc.h"

#define TOUCH_KEYPORT	GPIOA	//����IO�ӿ���
#define TOUCH_KEY_A		GPIO_Pin_0	//����IO�ӿ�
#define TOUCH_KEY_B		GPIO_Pin_1	//����IO�ӿ�
#define TOUCH_KEY_C		GPIO_Pin_2	//����IO�ӿ�
#define TOUCH_KEY_D		GPIO_Pin_3	//����IO�ӿ�

void TOUCH_KEY_Init(void);//��ʼ��

				    
#endif
