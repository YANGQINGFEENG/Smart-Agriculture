/**
 * @file    Motor.c
 * @brief   电机驱动实现文件
 * @details 实现电机初始化和速度控制功能
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    基于STM32F103微控制器
 *          电机驱动引脚：PA4(方向控制1), PA5(方向控制2)
 *          PWM输出：PB0(TIM3_CH3)
 */

#include "stm32f10x.h"
#include "PWM.h"
#include "Delay.h"

/* ==================== 函数实现 ==================== */

/**
 * @brief   电机初始化
 * @details 初始化电机方向控制引脚和PWM输出
 * @note    方向控制引脚：PA4, PA5
 *          PWM输出：TIM3_CH3 (PB0)
 */
void Motor_Init(void)
{
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE);
    
    GPIO_InitTypeDef GPIO_InitStructure;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_Out_PP;                    // 推挽输出
    GPIO_InitStructure.GPIO_Pin = GPIO_Pin_4 | GPIO_Pin_5;
    GPIO_InitStructure.GPIO_Speed = GPIO_Speed_50MHz;
    GPIO_Init(GPIOA, &GPIO_InitStructure);
    
    PWM2_Init();                                                        // 初始化PWM输出
}

/**
 * @brief   设置电机速度
 * @param   Speed 速度值，范围：-100 ~ 100
 *          正值：正转，速度越大转速越快
 *          负值：反转，绝对值越大转速越快
 *          0：停止
 */
void Motor_SetSpeed(int8_t Speed)
{
    if (Speed >= 0)
    {
        GPIO_SetBits(GPIOA, GPIO_Pin_4);                                // 正转方向
        GPIO_ResetBits(GPIOA, GPIO_Pin_5);
        PWM_SetCompare3(Speed);
    }
    else
    {
        GPIO_ResetBits(GPIOA, GPIO_Pin_4);                              // 反转方向
        GPIO_SetBits(GPIOA, GPIO_Pin_5);
        PWM_SetCompare3(-Speed);
    }
}

/**
 * @brief   GPIO配置函数
 * @details 配置PC13为推挽输出，用于LED指示灯控制
 */
void GPIO_Configuration(void)
{
    GPIO_InitTypeDef GPIO_InitStructure;
    
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOB | RCC_APB2Periph_GPIOC, ENABLE);
    
    GPIO_InitStructure.GPIO_Pin = GPIO_Pin_13;
    GPIO_InitStructure.GPIO_Speed = GPIO_Speed_50MHz;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_Out_PP;                    // 推挽输出
    GPIO_Init(GPIOC, &GPIO_InitStructure);
    
    GPIO_ResetBits(GPIOC, GPIO_Pin_13);                                 // 初始状态熄灭指示灯
}

/**
 * @brief   IO控制测试函数
 * @details 测试PC13引脚的开关控制功能
 */
void IO_control(void)
{
    GPIO_SetBits(GPIOC, GPIO_Pin_13);                                   // 点亮
    Delay_ms(5000);
    GPIO_ResetBits(GPIOC, GPIO_Pin_13);                                 // 熄灭
    Delay_ms(5000);
}
