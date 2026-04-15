#ifndef __SERIAL2_H
#define __SERIAL2_H

#include <stdio.h>
#include "stm32f10x.h"                  // Device header


extern char Serial2_RxPacket[];
extern uint8_t Serial2_RxFlag;

void Serial2_Init(void);
void Serial2_SendByte(uint8_t Byte);
void Serial2_SendArray(uint8_t *Array, uint16_t Length);
void Serial2_SendString(char *String);
void Serial2_SendNumber(uint32_t Number, uint8_t Length);

#endif
