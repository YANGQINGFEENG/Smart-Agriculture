#ifndef __SOIL_SENSOR_H
#define __SOIL_SENSOR_H

#include "stm32f10x.h"

// CRC16计算和验证
uint16_t SoilSensor_CalculateCRC16(uint8_t *data, uint8_t length);
uint8_t SoilSensor_VerifyCRC16(uint8_t *data, uint8_t length);

// 数据解析和打印
void SoilSensor_PrintReceivedData(void);

// 读取土壤传感器数据（读取所有参数：含水率、温度、电导率、PH值）
uint8_t SoilSensor_ReadData(float *moisture, float *temperature, uint16_t *ec, float *ph);

#endif
