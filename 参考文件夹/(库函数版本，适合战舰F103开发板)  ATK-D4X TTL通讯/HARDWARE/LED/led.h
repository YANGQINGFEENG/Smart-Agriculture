#ifndef __LED_H
#define __LED_H     
#include "sys.h"
#include "stdbool.h"
//////////////////////////////////////////////////////////////////////////////////     
//������ֻ��ѧϰʹ�ã�δ���������ɣ��������������κ���;
//ALIENTEKս��STM32������
//LED��������       
//����ԭ��@ALIENTEK
//������̳:www.openedv.com
//�޸�����:2012/9/2
//�汾��V1.0
//��Ȩ���У�����ؾ���
//Copyright(C) �������������ӿƼ����޹�˾ 2009-2019
//All rights reserved                                      
////////////////////////////////////////////////////////////////////////////////// 


typedef enum
{
    LED_DS0 = 0,
    LED_DS1,
}_led_eu;

typedef enum
{
    LED_OFF = 0,    
    LED_ON,
}_ctl_led_eu;

typedef struct 
{
    GPIO_TypeDef * GPIO;
    uint16_t Pin;
}_gpio_st;





#define LED0 PBout(12)// PB12
#define LED1 PBout(13)// PB13    




void LED_Init(void);//��ʼ��

void Set_LED_Toggle(_led_eu led);
u8 Read_LED_State(void);

                             
#endif
