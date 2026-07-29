/**
 * @file    lm75a.h
 * @brief   LM75A温度传感器驱动头文件
 * @details 定义LM75A温度传感器的接口函数
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    基于I2C接口的LM75A温度传感器
 */

#ifndef __LM75A_H
#define __LM75A_H

#include "sys.h"
#include "i2c.h"

/* ==================== 设备地址定义 ==================== */

#define LM75A_ADD   0x9E    // LM75A设备地址

/* ==================== 函数声明 ==================== */

/**
 * @brief   获取LM75A温度值
 * @param   Tempbuffer 温度数据缓冲区（3字节）
 * @note    温度范围：-55~125℃
 *          Tempbuffer[0]: 温度符号（0为正，1为负）
 *          Tempbuffer[1]: 温度整数部分（0~125）
 *          Tempbuffer[2]: 温度小数部分（0~99）
 */
void LM75A_GetTemp(u8 *Tempbuffer);

/**
 * @brief   LM75A进入掉电模式
 * @note    掉电模式可降低功耗，再次调用LM75A_GetTemp()可唤醒
 */
void LM75A_POWERDOWN(void);

#endif
