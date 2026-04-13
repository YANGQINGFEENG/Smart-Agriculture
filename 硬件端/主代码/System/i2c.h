/**
 * @file    i2c.h
 * @brief   硬件I2C驱动头文件
 * @details 定义硬件I2C接口的初始化和通信函数
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    使用STM32硬件I2C接口
 */

#ifndef __I2C_H
#define __I2C_H

#include "sys.h"

/* ==================== 引脚定义 ==================== */

#define I2CPORT     GPIOB               // I2C IO接口
#define I2C_SCL     GPIO_Pin_6          // I2C时钟引脚
#define I2C_SDA     GPIO_Pin_7          // I2C数据引脚

#define HostAddress 0xc0                // 主机地址（从机模式地址）
#define BusSpeed    100000              // 总线速度（最高400000）

/* ==================== 函数声明 ==================== */

/**
 * @brief   I2C配置初始化
 */
void I2C_Configuration(void);

/**
 * @brief   I2C发送数据缓冲区
 * @param   SlaveAddr 从机地址
 * @param   WriteAddr 写入地址
 * @param   pBuffer 数据缓冲区指针
 * @param   NumByteToWrite 要写入的字节数
 */
void I2C_SAND_BUFFER(u8 SlaveAddr, u8 WriteAddr, u8* pBuffer, u16 NumByteToWrite);

/**
 * @brief   I2C发送一个字节
 * @param   SlaveAddr 从机地址
 * @param   writeAddr 写入地址
 * @param   pBuffer 要发送的数据
 */
void I2C_SAND_BYTE(u8 SlaveAddr, u8 writeAddr, u8 pBuffer);

/**
 * @brief   I2C读取数据缓冲区
 * @param   SlaveAddr 从机地址
 * @param   readAddr 读取地址
 * @param   pBuffer 数据缓冲区指针
 * @param   NumByteToRead 要读取的字节数
 */
void I2C_READ_BUFFER(u8 SlaveAddr, u8 readAddr, u8* pBuffer, u16 NumByteToRead);

/**
 * @brief   I2C读取一个字节
 * @param   SlaveAddr 从机地址
 * @param   readAddr 读取地址
 * @return  读取到的数据
 */
u8 I2C_READ_BYTE(u8 SlaveAddr, u8 readAddr);

#endif
