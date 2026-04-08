/**
 ****************************************************************************************************
 * @file        demo.h
 * @author      ����ԭ���Ŷ�(ALIENTEK)
 * @version     V1.0
 * @date        2024-11-28
 * @brief       ATK-MB026ģ��TCP͸��ʵ��
 * @license     Copyright (c) 2020-2032, �������������ӿƼ����޹�˾
 ****************************************************************************************************
 * @attention
 *
 * ʵ��ƽ̨:����ԭ�� M48Z-M3��Сϵͳ��STM32F103��
 * ������Ƶ:www.yuanzige.com
 * ������̳:www.openedv.com
 * ��˾��ַ:www.alientek.com
 * �����ַ:openedv.taobao.com
 *
 ****************************************************************************************************
 */

#ifndef __DEMO_H
#define __DEMO_H

#include "stm32f10x.h"

// WiFi配置参数
#define DEMO_WIFI_SSID          "vivoS18"
#define DEMO_WIFI_PWD           "12345678"

// 全局变量声明
extern uint8_t g_is_unvarnished; // 透传模式状态标志

void demo_run(void);
void demo_show_ip(char *buf);
void demo_key0_fun(uint8_t is_unvarnished);
void demo_keywkup_fun(uint8_t *is_unvarnished);
void demo_upload_data(uint8_t is_unvarnished);

#endif

