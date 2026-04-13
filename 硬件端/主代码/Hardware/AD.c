/**
 * @file    AD.c
 * @brief   ADC模数转换驱动实现文件
 * @details 实现ADC初始化、DMA配置和数据采集功能
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    基于STM32F103微控制器，使用ADC1和DMA1
 *          支持多通道ADC采集，使用DMA自动传输
 */

#include "AD.h"

/* ==================== 全局变量定义 ==================== */

vu16 ADC_ConvertedValue[4];             // ADC转换值数组

/* ==================== 函数实现 ==================== */

/**
 * @brief   ADC DMA初始化
 * @details 配置DMA通道1，用于ADC数据自动传输到内存
 * @note    使用循环模式，自动更新ADC_ConvertedValue数组
 */
void ADC_DMA_Init(void)
{
    DMA_InitTypeDef DMA_InitStructure;
    
    DMA_DeInit(DMA1_Channel1);
    
    DMA_InitStructure.DMA_PeripheralBaseAddr = ADC1_DR_Address;         // DMA外设基地址
    DMA_InitStructure.DMA_MemoryBaseAddr = (u32)&ADC_ConvertedValue;    // DMA内存基地址
    DMA_InitStructure.DMA_DIR = DMA_DIR_PeripheralSRC;                  // 外设为源地址
    DMA_InitStructure.DMA_BufferSize = 4;                               // DMA缓存大小
    DMA_InitStructure.DMA_PeripheralInc = DMA_PeripheralInc_Disable;    // 外设地址不递增
    DMA_InitStructure.DMA_MemoryInc = DMA_MemoryInc_Enable;             // 内存地址递增
    DMA_InitStructure.DMA_PeripheralDataSize = DMA_PeripheralDataSize_HalfWord;  // 外设数据宽度16位
    DMA_InitStructure.DMA_MemoryDataSize = DMA_MemoryDataSize_HalfWord;          // 内存数据宽度16位
    DMA_InitStructure.DMA_Mode = DMA_Mode_Circular;                     // 循环模式
    DMA_InitStructure.DMA_Priority = DMA_Priority_High;                 // 高优先级
    DMA_InitStructure.DMA_M2M = DMA_M2M_Disable;                        // 禁止内存到内存传输
    
    DMA_Init(DMA1_Channel1, &DMA_InitStructure);
    DMA_Cmd(DMA1_Channel1, ENABLE);
}

/**
 * @brief   ADC GPIO初始化
 * @details 配置ADC引脚为模拟输入模式
 * @note    配置PA4-PA7为模拟输入，并使能DMA和ADC时钟
 */
void ADC_GPIO_Init(void)
{
    GPIO_InitTypeDef GPIO_InitStructure;
    
    GPIO_InitStructure.GPIO_Pin = ADC_CH4 | ADC_CH5 | ADC_CH6 | ADC_CH7;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_AIN;                       // 模拟输入
    GPIO_Init(ADCPORT, &GPIO_InitStructure);
    
    RCC_AHBPeriphClockCmd(RCC_AHBPeriph_DMA1, ENABLE);                 // 使能DMA时钟
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_ADC1, ENABLE);               // 使能ADC1时钟
}

/**
 * @brief   ADC配置初始化
 * @details 完整的ADC初始化流程，包括GPIO、DMA和ADC配置
 * @note    配置ADC为连续扫描模式，使用DMA自动传输数据
 *          通道顺序：CH4, CH5, CH6, CH7
 */
void ADC_Configuration(void)
{
    ADC_InitTypeDef ADC_InitStructure;
    
    ADC_GPIO_Init();
    ADC_DMA_Init();
    
    ADC_InitStructure.ADC_Mode = ADC_Mode_Independent;                  // 独立模式
    ADC_InitStructure.ADC_ScanConvMode = ENABLE;                        // 扫描模式
    ADC_InitStructure.ADC_ContinuousConvMode = ENABLE;                  // 连续转换模式
    ADC_InitStructure.ADC_ExternalTrigConv = ADC_ExternalTrigConv_None; // 软件触发
    ADC_InitStructure.ADC_DataAlign = ADC_DataAlign_Right;              // 右对齐
    ADC_InitStructure.ADC_NbrOfChannel = 4;                             // 4个通道
    ADC_Init(ADC1, &ADC_InitStructure);
    
    ADC_RegularChannelConfig(ADC1, ADC_Channel_4, 1, ADC_SampleTime_28Cycles5);
    ADC_RegularChannelConfig(ADC1, ADC_Channel_5, 2, ADC_SampleTime_28Cycles5);
    ADC_RegularChannelConfig(ADC1, ADC_Channel_6, 3, ADC_SampleTime_28Cycles5);
    ADC_RegularChannelConfig(ADC1, ADC_Channel_7, 4, ADC_SampleTime_28Cycles5);
    
    ADC_DMACmd(ADC1, ENABLE);
    ADC_Cmd(ADC1, ENABLE);
    
    ADC_ResetCalibration(ADC1);
    while(ADC_GetResetCalibrationStatus(ADC1));
    ADC_StartCalibration(ADC1);
    while(ADC_GetCalibrationStatus(ADC1));
    
    ADC_SoftwareStartConvCmd(ADC1, ENABLE);
}
