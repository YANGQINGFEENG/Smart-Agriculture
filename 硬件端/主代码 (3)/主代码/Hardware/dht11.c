/**
 * @file    dht11.c
 * @brief   DHT11温湿度传感器驱动
 * @details 实现DHT11温湿度传感器的初始化和数据读取功能
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    DHT11使用单总线通信协议
 */

#include "stm32f10x.h"
#include "Delay.h"

/* ==================== 宏定义 ==================== */

#define DHT11_PORT GPIOA                 // DHT11数据引脚端口
#define DHT11_PIN GPIO_Pin_4             // DHT11数据引脚

/* ==================== 全局变量 ==================== */

uint8_t dht11_data[5];                   // 存储温湿度数据（湿度整数、湿度小数、温度整数、温度小数、校验和）

/* ==================== 函数实现 ==================== */

/**
 * @brief   DHT11初始化
 * @details 配置DHT11数据引脚为推挽输出模式，并初始化为高电平
 */
void DHT11_Init(void)
{
    GPIO_InitTypeDef GPIO_InitStructure;
    
    // 使能GPIOA时钟
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE);
    
    // 配置DHT11引脚为推挽输出
    GPIO_InitStructure.GPIO_Pin = DHT11_PIN;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_Out_PP;
    GPIO_InitStructure.GPIO_Speed = GPIO_Speed_50MHz;
    GPIO_Init(DHT11_PORT, &GPIO_InitStructure);
    
    // 初始化为高电平
    GPIO_SetBits(DHT11_PORT, DHT11_PIN);
}

/**
 * @brief   读取DHT11引脚状态
 * @return  引脚状态
 * @retval  0: 低电平
 * @retval  1: 高电平
 */
uint8_t DHT11_ReadPin(void)
{
    return GPIO_ReadInputDataBit(DHT11_PORT, DHT11_PIN);
}

/**
 * @brief   设置DHT11引脚为输出模式
 * @details 配置DHT11数据引脚为推挽输出模式
 */
void DHT11_SetOutput(void)
{
    GPIO_InitTypeDef GPIO_InitStructure;
    
    GPIO_InitStructure.GPIO_Pin = DHT11_PIN;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_Out_PP;
    GPIO_InitStructure.GPIO_Speed = GPIO_Speed_50MHz;
    GPIO_Init(DHT11_PORT, &GPIO_InitStructure);
}

/**
 * @brief   设置DHT11引脚为输入模式
 * @details 配置DHT11数据引脚为上拉输入模式
 */
void DHT11_SetInput(void)
{
    GPIO_InitTypeDef GPIO_InitStructure;
    
    GPIO_InitStructure.GPIO_Pin = DHT11_PIN;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_IPU;
    GPIO_Init(DHT11_PORT, &GPIO_InitStructure);
}

/**
 * @brief   读取DHT11传感器数据
 * @details 发送起始信号，读取40位数据并进行校验
 * @return  读取结果
 * @retval  0: 成功
 * @retval  1: 失败
 * @note    数据格式：湿度整数 + 湿度小数 + 温度整数 + 温度小数 + 校验和
 */
uint8_t DHT11_ReadData(void)
{
    uint8_t i, j;
    
    // 发送起始信号
    DHT11_SetOutput();
    GPIO_ResetBits(DHT11_PORT, DHT11_PIN);
    delay_ms(20); // 拉低至少18ms
    GPIO_SetBits(DHT11_PORT, DHT11_PIN);
    delay_us(30); // 拉高20-40us
    
    // 切换到输入模式
    DHT11_SetInput();
    delay_us(40);
    
    // 检查响应信号
    if (DHT11_ReadPin() == 0)
    {
        // 等待响应信号结束
        while (DHT11_ReadPin() == 0);
        // 等待数据传输开始
        while (DHT11_ReadPin() == 1);
        
        // 读取40位数据
        for (i = 0; i < 5; i++)
        {
            for (j = 0; j < 8; j++)
            {
                // 等待低电平结束
                while (DHT11_ReadPin() == 0);
                // 开始计时
                delay_us(30);
                // 判断数据位
                dht11_data[i] <<= 1;
                if (DHT11_ReadPin() == 1)
                {
                    dht11_data[i] |= 1;
                }
                // 等待高电平结束
                while (DHT11_ReadPin() == 1);
            }
        }
        
        // 切换回输出模式
        DHT11_SetOutput();
        GPIO_SetBits(DHT11_PORT, DHT11_PIN);
        
        // 检查校验和
        if (dht11_data[0] + dht11_data[1] + dht11_data[2] + dht11_data[3] == dht11_data[4])
        {
            return 0; // 成功
        }
        else
        {
            return 1; // 校验失败
        }
    }
    else
    {
        // 没有响应
        DHT11_SetOutput();
        GPIO_SetBits(DHT11_PORT, DHT11_PIN);
        return 1;
    }
}

/**
 * @brief   获取温度值
 * @return  温度值（摄氏度）
 * @note    温度值存储在dht11_data[2]中
 */
uint8_t DHT11_GetTemperature(void)
{
    return dht11_data[2];
}

/**
 * @brief   获取湿度值
 * @return  湿度值（百分比）
 * @note    湿度值存储在dht11_data[0]中
 */
uint8_t DHT11_GetHumidity(void)
{
    return dht11_data[0];
}