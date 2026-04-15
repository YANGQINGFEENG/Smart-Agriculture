/**
 * @file    myiic.c
 * @brief   软件模拟I2C驱动实现文件
 * @details 实现软件模拟I2C接口的初始化和通信功能
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    使用GPIO模拟I2C时序
 */

#include "myiic.h"
#include "Delay.h"

/* ==================== 内部函数 ==================== */

/**
 * @brief   I2C延时函数
 * @note    用于产生I2C时序延时
 */
static void iic_delay(void)
{
    delay_us(2);
}

/* ==================== 函数实现 ==================== */

/**
 * @brief   初始化I2C接口
 */
void iic_init(void)
{
    GPIO_InitTypeDef GPIO_InitStructure;
    
    /* 使能GPIO时钟 */
    RCC_APB2PeriphClockCmd(IIC_SCL_GPIO_CLK | IIC_SDA_GPIO_CLK, ENABLE);
    
    /* 配置SCL为推挽输出 */
    GPIO_InitStructure.GPIO_Pin = IIC_SCL_GPIO_PIN;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_Out_PP;
    GPIO_InitStructure.GPIO_Speed = GPIO_Speed_50MHz;
    GPIO_Init(IIC_SCL_GPIO_PORT, &GPIO_InitStructure);
    
    /* 配置SDA为开漏输出 */
    GPIO_InitStructure.GPIO_Pin = IIC_SDA_GPIO_PIN;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_Out_OD;
    GPIO_Init(IIC_SDA_GPIO_PORT, &GPIO_InitStructure);
    
    /* 初始状态 */
    IIC_SCL(1);
    IIC_SDA(1);
}

/**
 * @brief   产生I2C起始信号
 */
void iic_start(void)
{
    IIC_SDA(1);
    IIC_SCL(1);
    iic_delay();
    IIC_SDA(0);
    iic_delay();
    IIC_SCL(0);
    iic_delay();
}

/**
 * @brief   产生I2C停止信号
 */
void iic_stop(void)
{
    IIC_SDA(0);
    iic_delay();
    IIC_SCL(1);
    iic_delay();
    IIC_SDA(1);
    iic_delay();
}

/**
 * @brief   等待应答信号
 * @return  应答结果
 * @retval  0: 接收到ACK
 * @retval  1: 未接收到ACK
 */
uint8_t iic_wait_ack(void)
{
    uint8_t waittime = 0;
    uint8_t rack = 0;

    IIC_SDA(1);
    iic_delay();
    IIC_SCL(1);
    iic_delay();

    while(GPIO_ReadInputDataBit(IIC_SDA_GPIO_PORT, IIC_SDA_GPIO_PIN))
    {
        waittime++;
        if(waittime > 250)
        {
            iic_stop();
            rack = 1;
            break;
        }
    }

    IIC_SCL(0);
    iic_delay();
    return rack;
}

/**
 * @brief   产生ACK应答
 */
void iic_ack(void)
{
    IIC_SDA(0);
    iic_delay();
    IIC_SCL(1);
    iic_delay();
    IIC_SCL(0);
    iic_delay();
    IIC_SDA(1);
    iic_delay();
}

/**
 * @brief   产生NACK应答
 */
void iic_nack(void)
{
    IIC_SDA(1);
    iic_delay();
    IIC_SCL(1);
    iic_delay();
    IIC_SCL(0);
    iic_delay();
}

/**
 * @brief   I2C发送一个字节
 * @param   txd 要发送的数据
 */
void iic_send_byte(uint8_t txd)
{
    uint8_t t;
    
    for(t = 0; t < 8; t++)
    {
        IIC_SDA((txd & 0x80) >> 7);
        txd <<= 1;
        iic_delay();
        IIC_SCL(1);
        iic_delay();
        IIC_SCL(0);
    }
    
    IIC_SDA(1);
}

/**
 * @brief   I2C读取一个字节
 * @param   ack 是否发送ACK（1: 发送ACK, 0: 发送NACK）
 * @return  读取到的数据
 */
uint8_t iic_read_byte(uint8_t ack)
{
    uint8_t i, receive = 0;

    for(i = 0; i < 8; i++)
    {
        receive <<= 1;
        IIC_SCL(1);
        iic_delay();
        
        if(GPIO_ReadInputDataBit(IIC_SDA_GPIO_PORT, IIC_SDA_GPIO_PIN))
        {
            receive++;
        }
        
        IIC_SCL(0);
        iic_delay();
    }

    if(ack)
    {
        iic_ack();
    }
    else
    {
        iic_nack();
    }

    return receive;
}
