#ifndef __KEY_H
#define __KEY_H

#include "stm32f10x.h"

/******************************************************************************************/
/* 引脚 定义 */

#define KEY0_GPIO_PORT                  GPIOC
#define KEY0_GPIO_PIN                   GPIO_Pin_13
#define KEY0_GPIO_CLK_ENABLE()          RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOC, ENABLE)

#define WKUP_GPIO_PORT                  GPIOA
#define WKUP_GPIO_PIN                   GPIO_Pin_0
#define WKUP_GPIO_CLK_ENABLE()          RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE)

/******************************************************************************************/

#define KEY0        GPIO_ReadInputDataBit(KEY0_GPIO_PORT, KEY0_GPIO_PIN)     /* 读取KEY0引脚 */
#define WK_UP       GPIO_ReadInputDataBit(WKUP_GPIO_PORT, WKUP_GPIO_PIN)     /* 读取WKUP引脚 */

#define KEY0_PRES    1              /* KEY0按下 */
#define WKUP_PRES    2              /* KEY_UP按下(即WK_UP) */

void key_init(void);                /* 按键初始化函数 */
uint8_t key_scan(uint8_t mode);     /* 按键扫描函数 */

#endif /* __KEY_H */


