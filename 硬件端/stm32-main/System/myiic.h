/**
 * @file    myiic.h
 * @brief   软件模拟I2C驱动头文件
 * @details 定义软件模拟I2C接口的初始化和通信函数
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    使用GPIO模拟I2C时序
 */

#ifndef __MYIIC_H
#define __MYIIC_H

#include "sys.h"
#include "stm32f10x.h"

/* ==================== 引脚定义 ==================== */

#define IIC_SCL_GPIO_PORT        GPIOA
#define IIC_SCL_GPIO_PIN         GPIO_Pin_2
#define IIC_SCL_GPIO_CLK         RCC_APB2Periph_GPIOA

#define IIC_SDA_GPIO_PORT        GPIOA
#define IIC_SDA_GPIO_PIN         GPIO_Pin_3
#define IIC_SDA_GPIO_CLK         RCC_APB2Periph_GPIOA

/* ==================== IO操作宏定义 ==================== */

#define IIC_SCL(x)   GPIO_WriteBit(IIC_SCL_GPIO_PORT, IIC_SCL_GPIO_PIN, (x) ? Bit_SET : Bit_RESET)
#define IIC_SDA(x)   GPIO_WriteBit(IIC_SDA_GPIO_PORT, IIC_SDA_GPIO_PIN, (x) ? Bit_SET : Bit_RESET)
#define IIC_READ_SDA GPIO_ReadInputDataBit(IIC_SDA_GPIO_PORT, IIC_SDA_GPIO_PIN)

/* ==================== 函数声明 ==================== */

/**
 * @brief   初始化I2C接口
 */
void iic_init(void);

/**
 * @brief   产生I2C起始信号
 */
void iic_start(void);

/**
 * @brief   产生I2C停止信号
 */
void iic_stop(void);

/**
 * @brief   等待应答信号
 * @return  应答结果
 * @retval  0: 接收到ACK
 * @retval  1: 未接收到ACK
 */
uint8_t iic_wait_ack(void);

/**
 * @brief   产生ACK应答
 */
void iic_ack(void);

/**
 * @brief   产生NACK应答
 */
void iic_nack(void);

/**
 * @brief   I2C发送一个字节
 * @param   txd 要发送的数据
 */
void iic_send_byte(uint8_t txd);

/**
 * @brief   I2C读取一个字节
 * @param   ack 是否发送ACK（1: 发送ACK, 0: 发送NACK）
 * @return  读取到的数据
 */
uint8_t iic_read_byte(uint8_t ack);

#endif
