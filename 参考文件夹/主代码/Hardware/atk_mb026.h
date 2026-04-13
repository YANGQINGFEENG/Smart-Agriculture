/**
 ****************************************************************************************************
 * @file        atk_mb026.h
 * @author      正点原子团队(ALIENTEK)
 * @version     V1.0
 * @date        2024-11-28
 * @brief       ATK_MB026模块驱动代码
 * @license     Copyright (c) 2020-2032, 广州市星翼电子科技有限公司
 ****************************************************************************************************
 * @attention
 *
 * 实验平台:正点原子 M48Z-M3最小系统板STM32F103版
 * 在线视频:www.yuanzige.com
 * 技术论坛:www.openedv.com
 * 公司网址:www.alientek.com
 * 购买地址:openedv.taobao.com
 *
 ****************************************************************************************************
 */

#ifndef __ATK_MB026_H
#define __ATK_MB026_H

#include "stm32f10x.h"
#include "atk_mb026_uart.h"
#include <stdio.h>
#include <string.h>

/* 引脚定义 */
#define ATK_MB026_RST_GPIO_PORT           GPIOA
#define ATK_MB026_RST_GPIO_PIN            GPIO_Pin_4
#define ATK_MB026_RST_GPIO_CLK            RCC_APB2Periph_GPIOA

/* IO操作 */
#define ATK_MB026_RST(x)                  GPIO_WriteBit(ATK_MB026_RST_GPIO_PORT, ATK_MB026_RST_GPIO_PIN, (x) ? Bit_SET : Bit_RESET)

/* 连接状态枚举 */
typedef enum {
    ATK_MB026_CONNECTED = 0x00,             /* 已连接 */
    ATK_MB026_DISCONNECTED,                 /* 未连接 */
    ATK_MB026_DATA,                         /* 稳定连接可以传输数据的状态 */
} atk_mb026_conn_sta_t;

/* 错误代码 */
#define ATK_MB026_EOK         0             /* 没有错误 */
#define ATK_MB026_ERROR       1             /* 通用错误 */
#define ATK_MB026_ETIMEOUT    2             /* 超时错误 */
#define ATK_MB026_EINVAL      3             /* 参数错误 */

/* 操作函数 */
void atk_mb026_hw_reset(void);                                                                 /* ATK_MB026硬件复位 */
uint8_t atk_mb026_send_at_cmd(char *cmd, char *ack, uint32_t timeout);                          /* ATK_MB026发送AT指令 */
uint8_t atk_mb026_init(uint32_t baudrate);                                                     /* ATK_MB026初始化 */
uint8_t atk_mb026_restore(void);                                                              /* ATK_MB026恢复出厂设置 */
uint8_t atk_mb026_at_test(void);                                                              /* ATK_MB026 AT指令测试 */
uint8_t atk_mb026_at_sysmsg(uint8_t mode);                                                    /* ATK_MB026设置系统提示信息 */
uint8_t atk_mb026_ble_init(uint8_t mode);                                                     /* ATK_MB026蓝牙初始化 */
uint8_t atk_mb026_ble_gatts(void);                                                            /* ATK_MB026 GATTS创建服务 */
uint8_t atk_mb026_ble_gattssrvstart(void);                                                    /* ATK_MB026 GATTS开启全部服务 */
uint8_t atk_mb026_get_addr(char *buf);                                                        /* ATK_MB026获取蓝牙设备地址 */
uint8_t atk_mb026_set_addr(uint8_t mode);                                                     /* ATK_MB026设置蓝牙设备地址类型 */
uint8_t atk_mb026_get_advparam(char *buf);                                                    /* ATK_MB026获取蓝牙设备广播参数 */
uint8_t atk_mb026_set_advparam(char *adv_int_min, char *adv_int_max, char *adv_type, char *own_addr_type, char *channel_map); /* ATK_MB026设置广播参数 */
uint8_t atk_mb026_set_advdata(char *adv_data);                                                /* ATK_MB026设置广播参数 */
uint8_t atk_mb026_set_advdataex(char *dev_name, char *uuid, char *manufacturer_data, uint16_t include_power); /* ATK_MB026自动设置广播数据 */
uint8_t atk_mb026_advstart(void);                                                             /* ATK_MB026开始Bluetooth LE广播 */
uint8_t atk_mb026_set_sppcfg(uint16_t cfg_enable, uint16_t tx_service_index, uint16_t tx_char_index, uint16_t rx_service_index, uint16_t rx_char_index, uint16_t auto_conn); /* ATK_MB026设置Bluetooth LE SPP参数 */
uint8_t atk_mb026_lespp(void);                                                                /* ATK_MB026进入Bluetooth LE SPP模式 */
atk_mb026_conn_sta_t atk_mb026_get_conn_sta(void);                                                                          /* 获取ATK-MB026连接状态 */
uint8_t atk_mb026_set_mode(uint8_t mode);                                                     /* 设置ATK_MB026工作模式 */
uint8_t atk_mb026_sw_reset(void);                                                            /* ATK_MB026软件复位 */
uint8_t atk_mb026_ate_config(uint8_t cfg);                                                   /* ATK_MB026设置回显模式 */
uint8_t atk_mb026_join_ap(char *ssid, char *pwd);                                                                 /* ATK_MB026连接WIFI */
uint8_t atk_mb026_get_ip(char *buf);                                                                                     /* ATK_MB026获取IP地址 */
uint8_t atk_mb026_connect_tcp_server(char *server_ip, char *server_port);                                            /* ATK_MB026连接TCP服务器 */
uint8_t atk_mb026_enter_unvarnished(void);                                                                                 /* ATK_MB026进入透传 */
void atk_mb026_exit_unvarnished(void);                                                                                     /* ATK_MB026退出透传 */
uint8_t atk_mb026_connect_atkcld(char *id, char *pwd);                                                               /* ATK_MB026连接原子云服务器 */
uint8_t atk_mb026_connect_atknewcld(char *id, char *pwd);                                                            /* ATK_MB026连接新版原子云服务器 */
uint8_t atk_mb026_disconnect_atkcld(void);                                                                           /* ATK_MB026断开原子云服务器连接 */
#endif


