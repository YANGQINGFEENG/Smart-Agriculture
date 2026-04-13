#include "key.h"
#include "delay.h"

/**
 * @brief       按键初始化函数
 * @param       无
 * @retval      无
 */
void key_init(void)
{
    GPIO_InitTypeDef GPIO_InitStructure;

    KEY0_GPIO_CLK_ENABLE();         /* KEY0时钟使能 */
    WKUP_GPIO_CLK_ENABLE();         /* WKUP时钟使能 */

    GPIO_InitStructure.GPIO_Pin = KEY0_GPIO_PIN;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_IPU; /* 上拉输入 */
    GPIO_Init(KEY0_GPIO_PORT, &GPIO_InitStructure);

    GPIO_InitStructure.GPIO_Pin = WKUP_GPIO_PIN;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_IPU; /* 下拉输入 */
    GPIO_Init(WKUP_GPIO_PORT, &GPIO_InitStructure);
}

/**
 * @brief       按键扫描函数
 * @note        该函数有响应优先级(同时按下多个按键): WK_UP > KEY0
 * @param       mode:0 / 1,具体含义如下:
 *   @arg       0,  不支持连续按(当按键按下不放时, 只有第一次调用会返回键值,
 *                  必须松开以后, 再次按下才会返回其他键值)
 *   @arg       1,  支持连续按(当按键按下不放时, 每次调用该函数都会返回键值)
 * @retval      键值,定义如下:
 *              KEY0_PRES, 1, KEY0按下
 *              WKUP_PRES, 2, WK_UP按下
 */
uint8_t key_scan(uint8_t mode)
{
    static uint8_t key_up = 1;      /* 按键松开标志 */
    uint8_t key_val = 0;

    if (mode == 1)                  /* 支持连按 */
    {
        key_up = 1;
    }

    if ((key_up == 1) && ((KEY0 == 1) || (WK_UP == 0))) /* 按键松开标志为1，且有按键按下 */
    {
        key_up = 0;
        delay_ms(10);               /* 去抖动 */
        if (KEY0 == 0)
        {
            key_val = KEY0_PRES;
        }
        if (WK_UP == 0)
        {
            while (WK_UP == 0);     /* 等待按键释放 */
            key_val = WKUP_PRES;
        }
    }
    else if ((KEY0 == 0) && (WK_UP == 1)) /* 没有按键按下，标记按键松开 */
    {
        key_up = 1;
    }

    return key_val;                 /* 返回键值 */
}



