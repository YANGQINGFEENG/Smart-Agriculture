/**
 * @file    atk_mb026.h
 * @brief   ATK-MB026 WiFi模块驱动头文件
 * @details 定义ATK-MB026 WiFi模块的初始化和控制函数
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    基于STM32F103微控制器
 */

#ifndef __ATK_MB026_H
#define __ATK_MB026_H

#include "stm32f10x.h"
#include "atk_mb026_uart.h"
#include <stdio.h>
#include <string.h>

/* ==================== 引脚定义 ==================== */

#define ATK_MB026_RST_GPIO_PORT           GPIOA
#define ATK_MB026_RST_GPIO_PIN            GPIO_Pin_4
#define ATK_MB026_RST_GPIO_CLK            RCC_APB2Periph_GPIOA

/* ==================== IO操作 ==================== */

#define ATK_MB026_RST(x)                  GPIO_WriteBit(ATK_MB026_RST_GPIO_PORT, ATK_MB026_RST_GPIO_PIN, (x) ? Bit_SET : Bit_RESET)

/* ==================== 连接状态枚举 ==================== */

typedef enum {
    ATK_MB026_CONNECTED = 0x00,             // 已连接
    ATK_MB026_DISCONNECTED,                 // 未连接
    ATK_MB026_DATA,                         // 透传模式下接收到数据的状态
} atk_mb026_conn_sta_t;

/* ==================== 错误码定义 ==================== */

#define ATK_MB026_EOK         0             // 没有错误
#define ATK_MB026_ERROR       1             // 通用错误
#define ATK_MB026_ETIMEOUT    2             // 超时错误
#define ATK_MB026_EINVAL      3             // 参数错误

/* ==================== 函数声明 ==================== */

/**
 * @brief   ATK-MB026硬件复位
 */
void atk_mb026_hw_reset(void);

/**
 * @brief   ATK-MB026发送AT指令
 * @param   cmd AT指令
 * @param   ack 期望的应答
 * @param   timeout 超时时间（毫秒）
 * @return  ATK_MB026_EOK: 成功
 *          ATK_MB026_ETIMEOUT: 超时
 */
uint8_t atk_mb026_send_at_cmd(char *cmd, char *ack, uint32_t timeout);

/**
 * @brief   ATK-MB026初始化
 * @param   baudrate UART波特率
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_init(uint32_t baudrate);

/**
 * @brief   ATK-MB026恢复出厂设置
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_restore(void);

/**
 * @brief   ATK-MB026 AT指令测试
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_at_test(void);

/**
 * @brief   ATK-MB026设置系统提示信息
 * @param   mode 模式（0: 关闭，1: 开启）
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_at_sysmsg(uint8_t mode);

/**
 * @brief   ATK-MB026蓝牙初始化
 * @param   mode 模式（0: 关闭，1: 开启）
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_ble_init(uint8_t mode);

/**
 * @brief   ATK-MB026 GATTS服务配置
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_ble_gatts(void);

/**
 * @brief   ATK-MB026 GATTS服务全部开启
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_ble_gattssrvstart(void);

/**
 * @brief   ATK-MB026获取本机设备地址
 * @param   buf 存储地址的缓冲区
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_get_addr(char *buf);

/**
 * @brief   ATK-MB026设置本机设备地址类型
 * @param   mode 地址类型（0: 公共地址，1: 随机地址）
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_set_addr(uint8_t mode);

/**
 * @brief   ATK-MB026获取本机设备广播参数
 * @param   buf 存储广播参数的缓冲区
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_get_advparam(char *buf);

/**
 * @brief   ATK-MB026设置广播参数
 * @param   adv_int_min 广播间隔最小值
 * @param   adv_int_max 广播间隔最大值
 * @param   adv_type 广播类型
 * @param   own_addr_type 本机地址类型
 * @param   channel_map 广播信道映射
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_set_advparam(char *adv_int_min, char *adv_int_max, char *adv_type, char *own_addr_type, char *channel_map);

/**
 * @brief   ATK-MB026设置广播数据
 * @param   adv_data 广播数据
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_set_advdata(char *adv_data);

/**
 * @brief   ATK-MB026自定义设置广播数据
 * @param   dev_name 设备名称
 * @param   uuid UUID
 * @param   manufacturer_data 制造商数据
 * @param   include_power 是否包含发射功率
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_set_advdataex(char *dev_name, char *uuid, char *manufacturer_data, uint16_t include_power);

/**
 * @brief   ATK-MB026开始Bluetooth LE广播
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_advstart(void);

/**
 * @brief   ATK-MB026设置Bluetooth LE SPP配置
 * @param   cfg_enable 配置使能
 * @param   tx_service_index 发送服务索引
 * @param   tx_char_index 发送特征索引
 * @param   rx_service_index 接收服务索引
 * @param   rx_char_index 接收特征索引
 * @param   auto_conn 自动连接
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_set_sppcfg(uint16_t cfg_enable, uint16_t tx_service_index, uint16_t tx_char_index, uint16_t rx_service_index, uint16_t rx_char_index, uint16_t auto_conn);

/**
 * @brief   ATK-MB026进入Bluetooth LE SPP模式
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_lespp(void);

/**
 * @brief   获取ATK-MB026连接状态
 * @return  连接状态
 */
atk_mb026_conn_sta_t atk_mb026_get_conn_sta(void);

/**
 * @brief   设置ATK-MB026工作模式
 * @param   mode 模式（0: 正常模式，1: 透传模式）
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_set_mode(uint8_t mode);

/**
 * @brief   ATK-MB026软件复位
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_sw_reset(void);

/**
 * @brief   ATK-MB026设置回显模式
 * @param   cfg 配置（0: 关闭，1: 开启）
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_ate_config(uint8_t cfg);

/**
 * @brief   ATK-MB026连接WIFI
 * @param   ssid WIFI名称
 * @param   pwd WIFI密码
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_join_ap(char *ssid, char *pwd);

/**
 * @brief   ATK-MB026获取IP地址
 * @param   buf 存储IP地址的缓冲区
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_get_ip(char *buf);

/**
 * @brief   ATK-MB026连接TCP服务器
 * @param   server_ip 服务器IP地址
 * @param   server_port 服务器端口
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_connect_tcp_server(char *server_ip, char *server_port);

/**
 * @brief   ATK-MB026进入透传模式
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_enter_unvarnished(void);

/**
 * @brief   ATK-MB026退出透传模式
 */
void atk_mb026_exit_unvarnished(void);

/**
 * @brief   ATK-MB026连接原子云服务器
 * @param   id 设备ID
 * @param   pwd 设备密码
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_connect_atkcld(char *id, char *pwd);

/**
 * @brief   ATK-MB026连接新版原子云服务器
 * @param   id 设备ID
 * @param   pwd 设备密码
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_connect_atknewcld(char *id, char *pwd);

/**
 * @brief   ATK-MB026断开原子云服务器连接
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_disconnect_atkcld(void);

/**
 * @brief   ATK-MB026 Ping测试
 * @param   ip 目标IP地址
 * @return  ATK_MB026_EOK: Ping成功
 *          ATK_MB026_ETIMEOUT: Ping超时
 *          ATK_MB026_ERROR: Ping失败
 * @note    用于测试网络连通性，结果会打印到串口
 */
uint8_t atk_mb026_ping(char *ip);

#endif
