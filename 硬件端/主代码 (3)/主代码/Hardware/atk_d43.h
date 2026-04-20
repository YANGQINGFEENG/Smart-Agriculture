#ifndef __ATK_D43_H
#define __ATK_D43_H

#include "sys.h"

/**
 * ****************************************************************************
 * @file            atk_d43.h
 * @author          正点原子团队(ALIENTEK)
 * @version         V1.0
 * @data            2026-04-18
 * @brief           DTU通信模块
 * @copyright       Copyright (c) 2020-2032, 广州市星翼电子科技有限公司
 * ****************************************************************************
 * @attention       
 * 
 * 实现平台: 正点原子STM32F103系列开发板    +   正点原子ATK-D4X系列4G Cat1 DTU模块
 * 视频教程:www.yuanzige.com
 * 论坛:www.openedv.com
 * 公司网址:www.alientek.com
 * 淘宝店铺:openedv.taobao.com
 * 
 * 修改记录
 * V1.0 20260418
 * 第一次修改
 * ****************************************************************************
*/

#define DTU_RX_CMD_BUF_SIZE (512)

typedef enum
{
    DTU_WORKMODE_NET = 0,          /*网络透传模式*/
    DTU_WORKMODE_HTTP,             /*http透传模式*/
    DTU_WORKMODE_MQTT,             /*mqtt透传模式*/
    DTU_WORKMODE_ALIYUN,           /*阿里云透传模式*/
    DTU_WORKMODE_ONENET,           /*OneNET透传模式*/
    DTU_WORKMODE_YUANZIYUN,        /*原子云透传模式*/
} _dtu_work_mode_eu;

typedef enum
{
    DTU_COLLECT_OFF = 0,        /* 关闭采集功能 */
    DTU_COLLECT_TRANS,            /* 自动透传采集功能 */
    DTU_COLLECT_MODBUS_USER,    /* Modbus自动采集 */
    DTU_COLLECT_MODBUS_ALI,        /* Modbus阿里云采集功能(模板) */
    DTU_COLLECT_MODBUS_ONENET,    /* Modbus OneNET采集功能(模板) */
} _dtu_collect_mode_eu;

typedef struct
{
    uint32_t timeout; /*命令等待超时时间，单位：100ms*/
    char *read_cmd;   /*查询配置命令      参考DTU AT用户手册填写*/
    char *write_cmd;  /*设置配置命令      参考DTU AT用户手册填写*/
} _dtu_atcmd_st;

void dtu_get_urc_info(uint8_t ch);

void send_data_to_dtu(uint8_t *data, uint32_t size);

int dtu_config_init(_dtu_work_mode_eu work_mode, _dtu_collect_mode_eu collect_mode);

int dtu_power_reset(void);

int dtu_base_station_location_info(uint8_t *data_buffer, uint32_t buffer_size);

int dtu_device_state_work_info(uint8_t *data_buffer, uint32_t buffer_size);

#endif
