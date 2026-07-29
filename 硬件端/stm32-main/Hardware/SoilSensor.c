/**
 * @file    SoilSensor.c
 * @brief   土壤传感器驱动
 * @details 基于RS485和Modbus协议的土壤传感器驱动，支持读取土壤湿度、温度、电导率和PH值
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    使用USART3进行RS485通信，波特率4800
 */

#include "stm32f10x.h"
#include "RS485.h"
#include "SoilSensor.h"
#include "../System/Delay.h"

/* ==================== 宏定义 ==================== */

#define SOIL_SENSOR_ADDR 0x01             // 土壤传感器地址

/* ==================== 外部变量声明 ==================== */

extern uint8_t USART3_RX_BUF[USART3_REC_LEN];  // USART3接收缓冲区
extern uint16_t USART3_RX_STA;                  // USART3接收状态

/* ==================== 函数实现 ==================== */

/**
 * @brief   计算Modbus CRC16校验和
 * @details 根据Modbus协议计算CRC16校验和
 * @param   data 数据数组
 * @param   length 数据长度
 * @return  CRC16校验和
 */
uint16_t SoilSensor_CalculateCRC16(uint8_t *data, uint8_t length)
{
	uint16_t crc = 0xFFFF;
	for (uint8_t i = 0; i < length; i++)
	{
		crc ^= data[i];
		for (uint8_t j = 0; j < 8; j++)
		{
			if (crc & 0x0001)
			{
				crc = (crc >> 1) ^ 0xA001;
			}
			else
			{
				crc >>= 1;
			}
		}
	}
	return crc;
}

/**
 * @brief   验证CRC16校验和
 * @details 验证接收数据的CRC16校验和是否正确
 * @param   data 数据数组（包含CRC）
 * @param   length 数据长度（包含CRC）
 * @return  验证结果
 * @retval  0: 校验成功
 * @retval  1: 校验失败
 */
uint8_t SoilSensor_VerifyCRC16(uint8_t *data, uint8_t length)
{
	if (length < 3)
		return 1;
	
	uint16_t received_crc = data[length - 2] | (data[length - 1] << 8);
	uint16_t calculated_crc = SoilSensor_CalculateCRC16(data, length - 2);
	
	return (received_crc == calculated_crc) ? 0 : 1;
}

/**
 * @brief   打印接收到的数据
 * @details 在串口调试助手上显示接收到的HEX数据
 * @note    用于调试目的
 */
void SoilSensor_PrintReceivedData(void)
{
	// 实现打印接收到的数据的功能
	printf("[Soil Sensor] 接收到的数据：");
	for (uint16_t i = 0; i < (USART3_RX_STA & 0x3FFF); i++)
	{
		printf("%02X ", USART3_RX_BUF[i]);
	}
	printf("\r\n");
}

/**
 * @brief   读取土壤传感器数据
 * @details 通过Modbus协议读取土壤传感器的湿度、温度、电导率和PH值
 * @param   moisture 含水率指针（%）
 * @param   temperature 温度值指针（℃）
 * @param   ec 电导率指针（μS/cm）
 * @param   ph PH值指针
 * @return  读取结果
 * @retval  0: 成功
 * @retval  1: 超时
 * @retval  2: 响应错误
 * @retval  3: CRC校验失败
 * @note    使用Modbus功能码0x03读取4个寄存器
 */
uint8_t SoilSensor_ReadData(float *moisture, float *temperature, uint16_t *ec, float *ph)
{
	// 根据传感器手册，正确的请求指令：01 03 00 00 00 04 44 09
	uint8_t sendBuf[8] = {0};
	sendBuf[0] = SOIL_SENSOR_ADDR; // 地址：0x01
	sendBuf[1] = 0x03;             // 功能码：读取多个寄存器
	sendBuf[2] = 0x00;             // 起始寄存器高字节：0x00
	sendBuf[3] = 0x00;             // 起始寄存器低字节：0x00
	sendBuf[4] = 0x00;             // 读取寄存器数量高字节：0x00
	sendBuf[5] = 0x04;             // 读取寄存器数量低字节：0x04（读取4个寄存器）
	
	// 计算CRC16校验和
	uint16_t crc = SoilSensor_CalculateCRC16(sendBuf, 6);
	sendBuf[6] = crc & 0xFF;        // CRC低字节
	sendBuf[7] = (crc >> 8) & 0xFF; // CRC高字节
	
	// 清除接收状态和缓冲区
	USART3_RX_STA = 0;
	for (uint16_t i = 0; i < USART3_REC_LEN; i++)
	{
		USART3_RX_BUF[i] = 0;
	}
	
	// 发送读取命令 - 使用RS485_SendHex发送HEX数据
	RS485_SendHex(sendBuf, 8);
	
	// 等待响应（最多等待1000ms）
	uint32_t timeout = 0;
	uint16_t rx_len = 0;
	
	while (timeout < 1000)
	{
		timeout++;
		delay_ms(1);
		
		// 检查当前接收到的数据长度
		rx_len = USART3_RX_STA & 0x3FFF;
		
		// 如果收到了足够的数据（13字节），立即停止等待
		if (rx_len >= 13)
		{
			break;
		}
	}
	
	// 检查是否收到了足够的数据
	if (rx_len < 13)
	{
		return 1; // 超时
	}
	
	// 验证数据格式
	if (USART3_RX_BUF[0] != SOIL_SENSOR_ADDR || USART3_RX_BUF[1] != 0x03)
	{
		return 2; // 响应错误
	}
	
	// 验证CRC16校验和
	if (SoilSensor_VerifyCRC16(USART3_RX_BUF, 13) != 0)
	{
		return 3; // CRC校验失败
	}
	
	// 解析数据（根据传感器手册）
	// 数据格式：01 03 08 [含水率2字节] [温度2字节] [电导率2字节] [PH值2字节] [CRC2字节]
	uint8_t offset = 3; // 跳过地址、功能码、数据长度
	
	// 1. 含水率（地址0x0000）
	uint16_t moisture_raw = (USART3_RX_BUF[offset] << 8) | USART3_RX_BUF[offset + 1];
	*moisture = moisture_raw / 10.0f;
	
	// 2. 温度值（地址0x0001），使用int16_t处理负数
	int16_t temperature_raw = (int16_t)((USART3_RX_BUF[offset + 2] << 8) | USART3_RX_BUF[offset + 3]);
	*temperature = temperature_raw / 10.0f;
	
	// 3. 电导率（地址0x0002）
	uint16_t ec_raw = (USART3_RX_BUF[offset + 4] << 8) | USART3_RX_BUF[offset + 5];
	*ec = ec_raw;
	
	// 4. PH值（地址0x0003）
	uint16_t ph_raw = (USART3_RX_BUF[offset + 6] << 8) | USART3_RX_BUF[offset + 7];
	*ph = ph_raw / 10.0f;
	
	// 清除接收状态
	USART3_RX_STA = 0;
	
	return 0; // 成功
}
