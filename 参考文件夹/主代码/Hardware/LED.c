#include "stm32f10x.h"
#include "LED.h"

void LED_Init(void)
{
    // 使能 GPIOB 时钟
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOB, ENABLE);

    GPIO_InitTypeDef GPIO_InitStructure;

    // 初始化 LED1 (PB12)
    GPIO_InitStructure.GPIO_Pin = GPIO_Pin_12;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_Out_PP; // 推挽输出
    GPIO_InitStructure.GPIO_Speed = GPIO_Speed_50MHz;
    GPIO_Init(GPIOB, &GPIO_InitStructure);

    // 初始化 LED2 (PB13)
    GPIO_InitStructure.GPIO_Pin = GPIO_Pin_13;
    GPIO_Init(GPIOB, &GPIO_InitStructure);

    // 默认关闭 LED
    GPIO_SetBits(GPIOB, GPIO_Pin_12 | GPIO_Pin_13);
}

void LED1_ON(void)
{
    GPIO_ResetBits(GPIOB, GPIO_Pin_12);
}

void LED1_OFF(void)
{
    GPIO_SetBits(GPIOB, GPIO_Pin_12);
}

void LED1_Turn(void)
{
    if (GPIO_ReadOutputDataBit(GPIOB, GPIO_Pin_12) == 0)
    {
        GPIO_SetBits(GPIOB, GPIO_Pin_12);
    }
    else
    {
        GPIO_ResetBits(GPIOB, GPIO_Pin_12);
    }
}

void LED2_ON(void)
{
    GPIO_ResetBits(GPIOB, GPIO_Pin_13);
}

void LED2_OFF(void)
{
    GPIO_SetBits(GPIOB, GPIO_Pin_13);
}

void LED2_Turn(void)
{
    if (GPIO_ReadOutputDataBit(GPIOB, GPIO_Pin_13) == 0)
    {
        GPIO_SetBits(GPIOB, GPIO_Pin_13);
    }
    else
    {
        GPIO_ResetBits(GPIOB, GPIO_Pin_13);
    }
}

