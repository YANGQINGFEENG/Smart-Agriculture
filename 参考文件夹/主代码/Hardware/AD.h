//#ifndef __AD_H
//#define __AD_H

//void AD_Init(void);
//uint16_t AD_GetValue(uint8_t ADC_Channel);

//#endif


#ifndef __ADC_H
#define __ADC_H 			   
#include "sys.h"


#define ADC1_DR_Address    ((uint32_t)0x4001244C) 

#define ADCPORT		GPIOA	//定义ADC接口
#define ADC_CH4		GPIO_Pin_4	//定义ADC接口 电压电位器
#define ADC_CH5		GPIO_Pin_5	//定义ADC接口 光敏电阻
#define ADC_CH6		GPIO_Pin_6	//定义ADC接口 摇杆X轴
#define ADC_CH7		GPIO_Pin_7	//定义ADC接口 摇杆Y轴


void ADC_DMA_Init(void);
void ADC_GPIO_Init(void);
void ADC_Configuration(void);

#endif


