#ifndef __MOTOR_H
#define __MOTOR_H
#include "stm32f10x.h"                  // Device header


void Motor_Init(void);
void Motor_SetSpeed(int8_t Speed);
void GPIO_Configuration(void);
#endif
