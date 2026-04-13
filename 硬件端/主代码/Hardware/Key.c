/**
 * @file    Key.c
 * @brief   按键驱动实现文件
 * @details 实现按键初始化和扫描功能
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    基于STM32F103微控制器
 *          KEY0: PC13 (上拉输入，按下为低电平)
 *          WK_UP: PA0 (上拉输入，按下为低电平)
 */

#include "key.h"
#include "delay.h"

/* ==================== 函数实现 ==================== */

/**
 * @brief   按键初始化函数
 * @details 配置KEY0和WK_UP引脚为上拉输入模式
 */
void key_init(void)
{
    GPIO_InitTypeDef GPIO_InitStructure;

    KEY0_GPIO_CLK_ENABLE();                                             // KEY0时钟使能
    WKUP_GPIO_CLK_ENABLE();                                             // WKUP时钟使能

    GPIO_InitStructure.GPIO_Pin = KEY0_GPIO_PIN;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_IPU;                       // 上拉输入
    GPIO_Init(KEY0_GPIO_PORT, &GPIO_InitStructure);

    GPIO_InitStructure.GPIO_Pin = WKUP_GPIO_PIN;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_IPU;                       // 上拉输入
    GPIO_Init(WKUP_GPIO_PORT, &GPIO_InitStructure);
}

/**
 * @brief   按键扫描函数
 * @details 扫描按键状态并返回键值
 * @note    该函数具有响应优先级(同时按下时): WK_UP > KEY0
 * @param   mode: 0/1, 具体含义如下:
 *          @arg 0: 不支持连续按(当按键按下不松开时，只有第一次调用会返回键值，
 *                  必须松开以后，再次按下才会返回键值)
 *          @arg 1: 支持连续按(当按键按下不松开时，每次调用该函数都会返回键值)
 * @return  键值，定义如下:
 *          KEY0_PRES: 1, KEY0按下
 *          WKUP_PRES: 2, WK_UP按下
 */
uint8_t key_scan(uint8_t mode)
{
    static uint8_t key_up = 1;                                          // 按键松开标志
    uint8_t key_val = 0;

    if (mode == 1)                                                      // 支持连按
    {
        key_up = 1;
    }

    if ((key_up == 1) && ((KEY0 == 1) || (WK_UP == 0)))                 // 按键松开标志为1且有按键按下
    {
        key_up = 0;
        delay_ms(10);                                                   // 去抖动
        if (KEY0 == 0)
        {
            key_val = KEY0_PRES;
        }
        if (WK_UP == 0)
        {
            while (WK_UP == 0);                                         // 等待按键释放
            key_val = WKUP_PRES;
        }
    }
    else if ((KEY0 == 0) && (WK_UP == 1))                               // 没有按键按下，当前按键松开
    {
        key_up = 1;
    }

    return key_val;                                                     // 返回键值
}
