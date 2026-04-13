/**
 * @file    demo.h
 * @brief   ATK-MB026 WiFi模块TCP透传演示
 * @details 提供WiFi模块初始化、TCP连接、数据传输等功能
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    基于ATK-MB026 WiFi模块开发
 */

#ifndef __DEMO_H
#define __DEMO_H

#include "stm32f10x.h"

/* ==================== WiFi配置参数 ==================== */

#define DEMO_WIFI_SSID          "vivoS18"           // WiFi SSID
#define DEMO_WIFI_PWD           "12345678"          // WiFi密码

/* ==================== 全局变量声明 ==================== */

extern uint8_t g_is_unvarnished;                    // 透传模式状态标志（0: 普通模式, 1: 透传模式）

/* ==================== 函数声明 ==================== */

/**
 * @brief   运行演示程序
 * @details 初始化WiFi模块，连接AP，建立TCP连接并处理数据传输
 */
void demo_run(void);

/**
 * @brief   显示IP地址
 * @param   buf IP地址字符串
 */
void demo_show_ip(char *buf);

/**
 * @brief   KEY0按键功能
 * @param   is_unvarnished 透传模式状态
 */
void demo_key0_fun(uint8_t is_unvarnished);

/**
 * @brief   WKUP按键功能
 * @param   is_unvarnished 透传模式状态指针
 */
void demo_keywkup_fun(uint8_t *is_unvarnished);

/**
 * @brief   上传数据
 * @param   is_unvarnished 透传模式状态
 */
void demo_upload_data(uint8_t is_unvarnished);

#endif
