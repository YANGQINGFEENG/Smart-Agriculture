#ifndef __LIGHT_SENSOR_H
#define __LIGHT_SENSOR_H

#include "stm32f10x.h"

void LightSensor_Init(void);
uint16_t LightSensor_Read(void);
uint8_t LightSensor_GetPercentage(void);
uint16_t LightSensor_GetLux(void);

#endif
