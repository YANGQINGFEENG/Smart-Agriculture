/**
 * @file    atk_mb026_receiver.h
 * @brief   ATK-MB026 WiFi模块数据接收处理头文件
 * @details 定义ATK-MB026 WiFi模块的数据接收和处理函数
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    基于STM32F103微控制器
 */

#ifndef __ATK_MB026_RECEIVER_H
#define __ATK_MB026_RECEIVER_H

#include "stm32f10x.h"
#include <string.h>

/* ==================== 类型定义 ==================== */

/**
 * @brief   数据接收回调函数类型定义
 * @param   data 接收到的数据
 * @param   len 数据长度
 */
typedef void (*atk_mb026_data_callback_t)(const char* data, uint16_t len);

/* ==================== 函数声明 ==================== */

/**
 * @brief   ATK-MB026接收器初始化
 */
void atk_mb026_receiver_init(void);

/**
 * @brief   设置ATK-MB026数据接收回调函数
 * @param   callback 回调函数指针
 */
void atk_mb026_receiver_set_callback(atk_mb026_data_callback_t callback);

/**
 * @brief   ATK-MB026接收器处理函数
 * @details 在主循环中调用，用于处理接收到的数据
 */
void atk_mb026_receiver_process(void);

/**
 * @brief   ATK-MB026数据接收处理函数
 * @param   data 接收到的数据
 * @param   len 数据长度
 */
void atk_mb026_receive_handler(const char* data, uint16_t len);

/**
 * @brief   JSON字段提取辅助函数
 * @param   data JSON数据
 * @param   type 类型字段缓冲区
 * @param   device_type 设备类型字段缓冲区
 * @param   command 命令字段缓冲区
 * @param   param1_name 参数1名称缓冲区
 * @param   param1_value 参数1值缓冲区
 * @return  0: 成功
 *          1: 失败
 */
uint8_t extract_json_fields(const char* data, char* type, char* device_type, char* command, char* param1_name, char* param1_value);

#endif
