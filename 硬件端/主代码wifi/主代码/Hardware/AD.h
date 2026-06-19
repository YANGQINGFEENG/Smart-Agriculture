/**
 * @file    AD.h
 * @brief   ADC模数转换驱动头文件
 * @details 定义ADC初始化和DMA配置函数
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    基于STM32F103微控制器，使用ADC1和DMA1
 */

#ifndef __ADC_H
#define __ADC_H 			   
#include "sys.h"

/* ==================== ADC寄存器地址定义 ==================== */

#define ADC1_DR_Address    ((uint32_t)0x4001244C) 

/* ==================== ADC引脚定义 ==================== */

#define ADCPORT		GPIOA			        // 定义ADC接口
#define ADC_CH4		GPIO_Pin_4		        // 定义ADC接口 电压电位器
#define ADC_CH5		GPIO_Pin_5		        // 定义ADC接口 光敏电阻
#define ADC_CH6		GPIO_Pin_6		        // 定义ADC接口 摇杆X轴
#define ADC_CH7		GPIO_Pin_7		        // 定义ADC接口 摇杆Y轴

/* ==================== 函数声明 ==================== */

/**
 * @brief   ADC DMA初始化
 * @details 配置DMA通道1，用于ADC数据传输
 */
void ADC_DMA_Init(void);

/**
 * @brief   ADC GPIO初始化
 * @details 配置ADC引脚为模拟输入模式
 */
void ADC_GPIO_Init(void);

/**
 * @brief   ADC配置初始化
 * @details 完整的ADC初始化流程，包括GPIO、DMA和ADC配置
 */
void ADC_Configuration(void);

#endif
