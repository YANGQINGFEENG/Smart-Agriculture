#ifndef __DHT11_H
#define __DHT11_H

#include "stm32f10x.h"

void DHT11_Init(void);
uint8_t DHT11_ReadData(void);
uint8_t DHT11_GetTemperature(void);
uint8_t DHT11_GetHumidity(void);

#endif