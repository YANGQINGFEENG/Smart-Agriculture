#ifndef __ATK_M750_H
#define __ATK_M750_H

#include "sys.h"

/**
 * ****************************************************************************
 * @file            dtu.c
 * @author          正点原子团队（ALIENTEK）
 * @version         V1.0
 * @data            2020-04-14
 * @brief           DTU驱动代码
 * @copyright       Copyright (c) 2020-2032, 广州市星翼电子科技有限公司
 * ****************************************************************************
 * @attention       
 * 
 * 实验平台：正点原子STM32F103开发板    +   正点原子ATK-IDM750C/ATK-IDM751C（4G Cat1 DTU产品）
 * 在线视频:www.yuanzige.com
 * 技术论坛:www.openedv.com
 * 公司网址:www.alientek.com
 * 购买地址:openedv.taobao.com
 * 
 * 修改说明
 * V1.0 20200414
 * 第一次发布
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
    DTU_COLLECT_TRANS,            /* 自定义透传采集功能 */
    DTU_COLLECT_MODBUS_USER,    /* Modbus自定义采集 */
    DTU_COLLECT_MODBUS_ALI,        /* Modbus阿里云采集（物模型） */
    DTU_COLLECT_MODBUS_ONENET,    /* Modbus OneNET采集（物模型） */
} _dtu_collect_mode_eu;

typedef struct
{
    uint32_t timeout; /*指令等待超时时间，单位：100ms*/
    char *read_cmd;   /*查询参数指令      请参考DTU AT用户手册说明进行填写*/
    char *write_cmd;  /*配置参数指令      请参考DTU AT用户手册说明进行填写*/
} _dtu_atcmd_st;

void dtu_get_urc_info(uint8_t ch);

void send_data_to_dtu(uint8_t *data, uint32_t size);

int dtu_config_init(_dtu_work_mode_eu work_mode, _dtu_collect_mode_eu collect_mode);

int dtu_power_reset(void);

int dtu_base_station_location_info(uint8_t *data_buffer, uint32_t buffer_size);

int dtu_device_state_work_info(uint8_t *data_buffer, uint32_t buffer_size);

#endif
