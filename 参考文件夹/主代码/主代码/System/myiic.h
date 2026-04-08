#ifndef __MYIIC_H
#define __MYIIC_H

#include "sys.h"
#include "stm32f10x.h"

/* 引脚定义 */
#define IIC_SCL_GPIO_PORT        GPIOA
#define IIC_SCL_GPIO_PIN         GPIO_Pin_2
#define IIC_SCL_GPIO_CLK         RCC_APB2Periph_GPIOA

#define IIC_SDA_GPIO_PORT        GPIOA
#define IIC_SDA_GPIO_PIN         GPIO_Pin_3
#define IIC_SDA_GPIO_CLK         RCC_APB2Periph_GPIOA

/* IO操作 */
#define IIC_SCL(x)   GPIO_WriteBit(IIC_SCL_GPIO_PORT, IIC_SCL_GPIO_PIN, (x) ? Bit_SET : Bit_RESET)
#define IIC_SDA(x)   GPIO_WriteBit(IIC_SDA_GPIO_PORT, IIC_SDA_GPIO_PIN, (x) ? Bit_SET : Bit_RESET)
#define IIC_READ_SDA GPIO_ReadInputDataBit(IIC_SDA_GPIO_PORT, IIC_SDA_GPIO_PIN)

/* 函数声明 */
void iic_init(void);
void iic_start(void);
void iic_stop(void);
void iic_ack(void);
void iic_nack(void);
uint8_t iic_wait_ack(void);
void iic_send_byte(uint8_t txd);
uint8_t iic_read_byte(uint8_t ack);

#endif

