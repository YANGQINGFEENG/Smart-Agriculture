/**
 * @file    LED.c
 * @brief   LED驱动实现文件
 * @details 实现LED初始化和控制功能
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    LED使用GPIOB的PB12和PB13引脚
 */

#include "stm32f10x.h"
#include "LED.h"

/* ==================== 函数实现 ==================== */

/**
 * @brief   LED初始化
 * @details 初始化LED1(PB12)和LED2(PB13)，默认关闭
 */
void LED_Init(void)
{
    // 使能 GPIOB 时钟
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOB, ENABLE);

    GPIO_InitTypeDef GPIO_InitStructure;

    // 初始化 LED1 (PB12)
    GPIO_InitStructure.GPIO_Pin = GPIO_Pin_12;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_Out_PP;    // 推挽输出
    GPIO_InitStructure.GPIO_Speed = GPIO_Speed_50MHz;
    GPIO_Init(GPIOB, &GPIO_InitStructure);

    // 初始化 LED2 (PB13)
    GPIO_InitStructure.GPIO_Pin = GPIO_Pin_13;
    GPIO_Init(GPIOB, &GPIO_InitStructure);

    // 默认关闭 LED
    GPIO_SetBits(GPIOB, GPIO_Pin_12 | GPIO_Pin_13);
}

/**
 * @brief   LED1开启
 */
void LED1_ON(void)
{
    GPIO_ResetBits(GPIOB, GPIO_Pin_12);
}

/**
 * @brief   LED1关闭
 */
void LED1_OFF(void)
{
    GPIO_SetBits(GPIOB, GPIO_Pin_12);
}

/**
 * @brief   LED1翻转
 */
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

/**
 * @brief   LED2开启
 */
void LED2_ON(void)
{
    GPIO_ResetBits(GPIOB, GPIO_Pin_13);
}

/**
 * @brief   LED2关闭
 */
void LED2_OFF(void)
{
    GPIO_SetBits(GPIOB, GPIO_Pin_13);
}

/**
 * @brief   LED2翻转
 */
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
