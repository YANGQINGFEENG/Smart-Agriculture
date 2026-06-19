#include "stm32f10x.h"                  // Device header
#include <stdio.h>
#include <stdarg.h>
#include "atk_mb026_uart.h"

char Serial2_RxPacket[100];
uint8_t Serial2_RxFlag;

/**
 * @brief 初始化串口2（复用WiFi模块的USART2，仅用于发送）
 * @param 无
 * @retval 无
 * @note 注意：此函数不再调用atk_mb026_uart_init，避免覆盖WiFi模块的波特率配置
 */
void Serial2_Init(void)
{
	/* WiFi模块已通过atk_mb026_uart_init(115200)初始化了USART2
	 * 此处不需要重复初始化，只需确保使用正确的波特率即可
	 * 如果需要独立的RS485通信，应使用USART3(PB10/PB11)
	 */
}

/**
 * @brief 发送一个字节数据
 * @param Byte 要发送的字节
 * @retval 无
 */
void Serial2_SendByte(uint8_t Byte)
{
	// 使用现有的USART2发送函数
	uint8_t data = Byte;
	usart2_send_data(&data, 1);
}

/**
 * @brief 发送数组数据
 * @param Array 数组地址
 * @param Length 数组长度
 * @retval 无
 */
void Serial2_SendArray(uint8_t *Array, uint16_t Length)
{
	// 使用现有的USART2发送函数
	usart2_send_data(Array, Length);
}

/**
 * @brief 发送字符串
 * @param String 字符串地址
 * @retval 无
 */
void Serial2_SendString(char *String)
{
	uint8_t i;
	for (i = 0; String[i] != '\0'; i ++)
	{
		Serial2_SendByte(String[i]);
	}
}

/**
 * @brief 计算幂
 * @param X 底数
 * @param Y 指数
 * @retval 计算结果
 */
uint32_t Serial2_Pow(uint32_t X, uint32_t Y)
{
	uint32_t Result = 1;
	while (Y --)
	{
		Result *= X;
	}
	return Result;
}

/**
 * @brief 发送数字
 * @param Number 数字
 * @param Length 数字长度
 * @retval 无
 */
void Serial2_SendNumber(uint32_t Number, uint8_t Length)
{
	uint8_t i;
	for (i = 0; i < Length; i ++)
	{
		Serial2_SendByte(Number / Serial2_Pow(10, Length - i - 1) % 10 + '0');
	}
}

/**
 * @brief 处理485串口数据
 * @param 无
 * @retval 无
 */
void Serial2_ProcessResponse(void)
{
	uint8_t *rx_frame = atk_mb026_uart_rx_get_frame();
	uint16_t rx_len = atk_mb026_uart_rx_get_frame_len();
	
	if (rx_frame && rx_len > 0)
	{
		// 打印接收到的485数据
		printf("[RS485] Received: ");
		for (uint16_t i = 0; i < rx_len; i++)
		{
			// printf("%02X ", rx_frame[i]);
		}
		printf("\r\n");
		
		// 重置接收状态
		atk_mb026_uart_rx_restart();
	}
}
