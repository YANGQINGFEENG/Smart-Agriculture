/**
 * @file    LightSensor.c
 * @brief   光照传感器驱动
 * @details 基于ADC的光照传感器驱动，实现光照强度的读取和转换
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    使用ADC1通道5（PA5）读取光照传感器模拟值
 */

#include "stm32f10x.h"

/* ==================== 宏定义 ==================== */

#define LIGHT_SENSOR_PORT GPIOA            // 光照传感器端口
#define LIGHT_SENSOR_PIN GPIO_Pin_5        // 光照传感器引脚（PA5）

/* ==================== 函数实现 ==================== */

/**
 * @brief   ADC初始化
 * @details 配置ADC1通道5为模拟输入模式，并进行ADC校准
 * @note    ADC配置为独立模式、单次转换、右对齐
 */
void LightSensor_Init(void)
{
    GPIO_InitTypeDef GPIO_InitStructure;
    ADC_InitTypeDef ADC_InitStructure;
    
    // 使能GPIOA和ADC1时钟
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA | RCC_APB2Periph_ADC1, ENABLE);
    
    // 配置PA5为模拟输入
    GPIO_InitStructure.GPIO_Pin = LIGHT_SENSOR_PIN;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_AIN;
    GPIO_Init(LIGHT_SENSOR_PORT, &GPIO_InitStructure);
    
    // ADC配置
    ADC_InitStructure.ADC_Mode = ADC_Mode_Independent;
    ADC_InitStructure.ADC_ScanConvMode = DISABLE;
    ADC_InitStructure.ADC_ContinuousConvMode = DISABLE;
    ADC_InitStructure.ADC_ExternalTrigConv = ADC_ExternalTrigConv_None;
    ADC_InitStructure.ADC_DataAlign = ADC_DataAlign_Right;
    ADC_InitStructure.ADC_NbrOfChannel = 1;
    ADC_Init(ADC1, &ADC_InitStructure);
    
    // 使能ADC1
    ADC_Cmd(ADC1, ENABLE);
    
    // 校准ADC
    ADC_ResetCalibration(ADC1);
    while (ADC_GetResetCalibrationStatus(ADC1));
    ADC_StartCalibration(ADC1);
    while (ADC_GetCalibrationStatus(ADC1));
}

/**
 * @brief   读取光照传感器值
 * @details 启动ADC转换并等待转换完成
 * @return  光照值（0-4095）
 * @note    ADC分辨率为12位，采样时间为55.5周期
 */
uint16_t LightSensor_Read(void)
{
    // 设置通道5为第一个转换通道，采样时间为55.5周期
    ADC_RegularChannelConfig(ADC1, ADC_Channel_5, 1, ADC_SampleTime_55Cycles5);
    
    // 开始转换
    ADC_SoftwareStartConvCmd(ADC1, ENABLE);
    
    // 等待转换完成
    while (!ADC_GetFlagStatus(ADC1, ADC_FLAG_EOC));
    
    // 返回转换结果
    return ADC_GetConversionValue(ADC1);
}

/**
 * @brief   获取光照强度百分比
 * @details 将ADC值（0-4095）映射到百分比（0-100%）
 * @return  光照强度（0-100%）
 * @note    已弃用，建议使用 LightSensor_GetLux() 获取勒克斯值
 */
uint8_t LightSensor_GetPercentage(void)
{
    uint16_t adc_value = LightSensor_Read();
    return (uint8_t)((adc_value * 100) / 4095);
}

/**
 * @brief   获取光照强度（勒克斯）
 * @details 将ADC值转换为勒克斯单位
 * @return  光照强度（0-10000 Lux）
 * @note    典型光照范围：黑暗<10 Lux，室内100-500 Lux，阴天1000 Lux，晴天10000+ Lux
 *          ADC值越高表示光照越强（光敏电阻分压原理）
 */
uint16_t LightSensor_GetLux(void)
{
    uint16_t adc_value = LightSensor_Read();
    
    uint16_t lux = (uint16_t)((adc_value * 10000UL) / 4095);
    
    return lux;
}
