#include "led.h"
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




#define LED_Max_NUM        2

static _gpio_st LED_GPIO[LED_Max_NUM] =
{
    [LED_DS0] = {GPIOB, GPIO_Pin_12},
    [LED_DS1] = {GPIOB, GPIO_Pin_13},
};


//��ʼ��PB12��PB13Ϊ�����.��ʹ���������ڵ�ʱ��
//LED IO��ʼ��
void LED_Init(void)
{

    GPIO_InitTypeDef  GPIO_InitStructure;

    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOB, ENABLE);     //ʹ��PB�˿�ʱ��

    GPIO_InitStructure.GPIO_Pin = GPIO_Pin_12;                 //LED0-->PB.12 �˿�����
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_Out_PP;          //�������
    GPIO_InitStructure.GPIO_Speed = GPIO_Speed_50MHz;         //IO���ٶ�Ϊ50MHz
    GPIO_Init(GPIOB, &GPIO_InitStructure);                     //�����趨������ʼ��GPIOB.12
    GPIO_SetBits(GPIOB, GPIO_Pin_12);                         //PB.12 �����

    GPIO_InitStructure.GPIO_Pin = GPIO_Pin_13;                 //LED1-->PB.13 �˿�����, �������
    GPIO_Init(GPIOB, &GPIO_InitStructure);                       //������� ��IO���ٶ�Ϊ50MHz
    GPIO_SetBits(GPIOB, GPIO_Pin_13);                          //PB.13 �����

}

//����LED�Ƶ�״̬��ת
void Set_LED_Toggle(_led_eu led)
{
    if( GPIO_ReadOutputDataBit(LED_GPIO[led].GPIO, LED_GPIO[led].Pin) == Bit_SET )
    {
        GPIO_ResetBits(LED_GPIO[led].GPIO, LED_GPIO[led].Pin);
    }
    else
    {
        GPIO_SetBits(LED_GPIO[led].GPIO, LED_GPIO[led].Pin);
    }
}

/*
    ����LED��״̬
        Bit0: DS0�Ƶ�״̬
        Bit1: DS1�Ƶ�״̬
        ����λδ��
    ����:0��ʾ����1��ʾ����
*/
//��LED�Ƶ�ǰ״̬
//���أ���ǰLED��״̬
u8 Read_LED_State(void)
{
    u8 sta = 0 ;

    for(u8 i = 0; i < LED_Max_NUM; i++)
    {
        if(GPIO_ReadOutputDataBit(LED_GPIO[i].GPIO, LED_GPIO[i].Pin))
        {
            sta &= ~(1 << i);
        }

        else
        {
            sta |= 1 << i;
        }
    }

    return sta;
}



