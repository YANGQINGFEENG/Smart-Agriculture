/**
 * @file    i2c.c
 * @brief   硬件I2C驱动实现文件
 * @details 实现硬件I2C接口的初始化和通信功能
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    使用STM32硬件I2C接口
 */

#include "i2c.h"

/* ==================== 内部函数 ==================== */

/**
 * @brief   I2C GPIO初始化
 * @details 配置I2C引脚为复用开漏输出模式
 */
void I2C_GPIO_Init(void)
{
    GPIO_InitTypeDef  GPIO_InitStructure;
    GPIO_InitStructure.GPIO_Pin = I2C_SCL | I2C_SDA;        // 选择端口号
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_AF_OD;         // 选择IO接口工作模式
    GPIO_InitStructure.GPIO_Speed = GPIO_Speed_50MHz;       // 设置IO接口速度
    GPIO_Init(I2CPORT, &GPIO_InitStructure);
}

/* ==================== 函数实现 ==================== */

/**
 * @brief   I2C配置初始化
 */
void I2C_Configuration(void)
{
    I2C_InitTypeDef  I2C_InitStructure;
    RCC_APB1PeriphClockCmd(RCC_APB1Periph_I2C1, ENABLE);    // RCC开启I2C1时钟
    I2C_GPIO_Init();                                        // 设置GPIO接口的状态
    I2C_InitStructure.I2C_Mode = I2C_Mode_I2C;              // 设置为I2C模式
    I2C_InitStructure.I2C_DutyCycle = I2C_DutyCycle_2;
    I2C_InitStructure.I2C_OwnAddress1 = HostAddress;        // 主机地址（从机模式使用此地址）
    I2C_InitStructure.I2C_Ack = I2C_Ack_Enable;             // 使能应答
    I2C_InitStructure.I2C_AcknowledgedAddress = I2C_AcknowledgedAddress_7bit; // 7位地址模式
    I2C_InitStructure.I2C_ClockSpeed = BusSpeed;            // 总线速度设置
    I2C_Init(I2C1, &I2C_InitStructure);
    I2C_Cmd(I2C1, ENABLE);                                  // 使能I2C
}

/**
 * @brief   I2C发送数据缓冲区
 * @param   SlaveAddr 从机地址
 * @param   WriteAddr 写入地址
 * @param   pBuffer 数据缓冲区指针
 * @param   NumByteToWrite 要写入的字节数
 */
void I2C_SAND_BUFFER(u8 SlaveAddr, u8 WriteAddr, u8* pBuffer, u16 NumByteToWrite)
{
    while(I2C_GetFlagStatus(I2C1, I2C_FLAG_BUSY));          // 等待总线空闲
    I2C_GenerateSTART(I2C1, ENABLE);                       // 产生起始位
    while(!I2C_CheckEvent(I2C1, I2C_EVENT_MASTER_MODE_SELECT)); // 等待EV5
    I2C_Send7bitAddress(I2C1, SlaveAddr, I2C_Direction_Transmitter); // 发送从机地址
    while(!I2C_CheckEvent(I2C1, I2C_EVENT_MASTER_TRANSMITTER_MODE_SELECTED)); // 等待EV6
    I2C_SendData(I2C1, WriteAddr);                         // 发送内部寄存器地址
    while(!I2C_CheckEvent(I2C1, I2C_EVENT_MASTER_BYTE_TRANSMITTED)); // 等待EV8
    while(NumByteToWrite--)
    {
        I2C_SendData(I2C1, *pBuffer);                      // 发送数据
        pBuffer++;                                         // 数据指针移位
        while(!I2C_CheckEvent(I2C1, I2C_EVENT_MASTER_BYTE_TRANSMITTED)); // 等待EV8
    }
    I2C_GenerateSTOP(I2C1, ENABLE);                        // 产生停止信号
}

/**
 * @brief   I2C发送一个字节
 * @param   SlaveAddr 从机地址
 * @param   writeAddr 写入地址
 * @param   pBuffer 要发送的数据
 */
void I2C_SAND_BYTE(u8 SlaveAddr, u8 writeAddr, u8 pBuffer)
{
    I2C_GenerateSTART(I2C1, ENABLE);                       // 发送开始信号
    while(!I2C_CheckEvent(I2C1, I2C_EVENT_MASTER_MODE_SELECT)); // 等待完成
    I2C_Send7bitAddress(I2C1, SlaveAddr, I2C_Direction_Transmitter); // 发送从机地址（写状态）
    while(!I2C_CheckEvent(I2C1, I2C_EVENT_MASTER_TRANSMITTER_MODE_SELECTED)); // 等待完成
    I2C_SendData(I2C1, writeAddr);                         // 发送从机内部寄存器地址
    while(!I2C_CheckEvent(I2C1, I2C_EVENT_MASTER_BYTE_TRANSMITTED)); // 等待完成
    I2C_SendData(I2C1, pBuffer);                           // 发送要写入的数据
    while(!I2C_CheckEvent(I2C1, I2C_EVENT_MASTER_BYTE_TRANSMITTED)); // 等待完成
    I2C_GenerateSTOP(I2C1, ENABLE);                        // 发送结束信号
}

/**
 * @brief   I2C读取数据缓冲区
 * @param   SlaveAddr 从机地址
 * @param   readAddr 读取地址
 * @param   pBuffer 数据缓冲区指针
 * @param   NumByteToRead 要读取的字节数
 */
void I2C_READ_BUFFER(u8 SlaveAddr, u8 readAddr, u8* pBuffer, u16 NumByteToRead)
{
    while(I2C_GetFlagStatus(I2C1, I2C_FLAG_BUSY));
    I2C_GenerateSTART(I2C1, ENABLE);                       // 产生信号
    while(!I2C_CheckEvent(I2C1, I2C_EVENT_MASTER_MODE_SELECT)); // 等待 EV5
    I2C_Send7bitAddress(I2C1, SlaveAddr, I2C_Direction_Transmitter); // 写入从机地址
    while(!I2C_CheckEvent(I2C1, I2C_EVENT_MASTER_TRANSMITTER_MODE_SELECTED)); // 等待 EV6
    I2C_Cmd(I2C1, ENABLE);
    I2C_SendData(I2C1, readAddr);                          // 发送读的地址
    while(!I2C_CheckEvent(I2C1, I2C_EVENT_MASTER_BYTE_TRANSMITTED)); // 等待 EV8
    I2C_GenerateSTART(I2C1, ENABLE);                       // 产生信号
    while(!I2C_CheckEvent(I2C1, I2C_EVENT_MASTER_MODE_SELECT)); // 等待 EV5
    I2C_Send7bitAddress(I2C1, SlaveAddr, I2C_Direction_Receiver); // 发送从机地址，读写位为读
    while(!I2C_CheckEvent(I2C1, I2C_EVENT_MASTER_RECEIVER_MODE_SELECTED)); // 等待EV6
    while(NumByteToRead)
    {
        if(NumByteToRead == 1)                             // 只剩下一个字节时进入if语句
        {
            I2C_AcknowledgeConfig(I2C1, DISABLE);          // 读最后一个字节时关闭应答位
            I2C_GenerateSTOP(I2C1, ENABLE);                // 读最后一个字节时使能停止位
        }
        if(I2C_CheckEvent(I2C1, I2C_EVENT_MASTER_BYTE_RECEIVED)) // 读取数据
        {
            *pBuffer = I2C_ReceiveData(I2C1);              // 调用库函数将读取到的数据存入pBuffer
            pBuffer++;                                     // 指针移位
            NumByteToRead--;                               // 字节数减1
        }
    }
    I2C_AcknowledgeConfig(I2C1, ENABLE);
}

/**
 * @brief   I2C读取一个字节
 * @param   SlaveAddr 从机地址
 * @param   readAddr 读取地址
 * @return  读取到的数据
 */
u8 I2C_READ_BYTE(u8 SlaveAddr, u8 readAddr)
{
    u8 a;
    while(I2C_GetFlagStatus(I2C1, I2C_FLAG_BUSY));
    I2C_GenerateSTART(I2C1, ENABLE);
    while(!I2C_CheckEvent(I2C1, I2C_EVENT_MASTER_MODE_SELECT));
    I2C_Send7bitAddress(I2C1, SlaveAddr, I2C_Direction_Transmitter);
    while(!I2C_CheckEvent(I2C1, I2C_EVENT_MASTER_TRANSMITTER_MODE_SELECTED));
    I2C_Cmd(I2C1, ENABLE);
    I2C_SendData(I2C1, readAddr);
    while(!I2C_CheckEvent(I2C1, I2C_EVENT_MASTER_BYTE_TRANSMITTED));
    I2C_GenerateSTART(I2C1, ENABLE);
    while(!I2C_CheckEvent(I2C1, I2C_EVENT_MASTER_MODE_SELECT));
    I2C_Send7bitAddress(I2C1, SlaveAddr, I2C_Direction_Receiver);
    while(!I2C_CheckEvent(I2C1, I2C_EVENT_MASTER_RECEIVER_MODE_SELECTED));
    I2C_AcknowledgeConfig(I2C1, DISABLE);                  // 读最后一个字节时关闭应答位
    I2C_GenerateSTOP(I2C1, ENABLE);                        // 读最后一个字节时使能停止位
    a = I2C_ReceiveData(I2C1);
    return a;
}
