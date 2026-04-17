/**
 ****************************************************************************************************
 * @file        protocol.h
 * @author      Embedded System Team
 * @version     V2.0.0
 * @date        2026-04-13
 * @brief       高效二进制协议 - 替代JSON，提高传输效率
 ****************************************************************************************************
 */

#ifndef __PROTOCOL_H
#define __PROTOCOL_H

#include "stm32f10x.h"
#include "sys_config.h"

#ifdef __cplusplus
extern "C" {
#endif

/* ==================================== 协议定义 ==================================== */

/* 帧头帧尾 */
#define PROTOCOL_HEADER              0xAA
#define PROTOCOL_FOOTER              0x55

/* 消息类型 */
typedef enum {
    MSG_TYPE_HEARTBEAT = 0x01,
    MSG_TYPE_SENSOR_DATA = 0x02,
    MSG_TYPE_CONTROL_CMD = 0x03,
    MSG_TYPE_ACK = 0x04,
    MSG_TYPE_CONNECT = 0x05
} MessageType;

/* 控制命令类型 */
typedef enum {
    CMD_TYPE_TURN_ON = 0x01,
    CMD_TYPE_TURN_OFF = 0x02
} ControlCommandType;

/* 控制命令帧 */
typedef struct __attribute__((packed)) {
    uint8_t  header;
    uint8_t  msg_type;
    uint8_t  device_id[8];
    uint32_t timestamp;
    uint32_t command_id;
    uint8_t  cmd_type;
    uint8_t  actuator_id[20];
    uint16_t crc16;
    uint8_t  footer;
} ControlCommandFrame;

/* 命令确认帧 */
typedef struct __attribute__((packed)) {
    uint8_t  header;
    uint8_t  msg_type;
    uint8_t  device_id[8];
    uint32_t timestamp;
    uint32_t command_id;
    uint8_t  status; /* 0: 失败, 1: 成功 */
    uint16_t crc16;
    uint8_t  footer;
} CommandAckFrame;

/* 传感器数据结构（紧凑二进制格式） */
typedef struct __attribute__((packed)) {
    uint8_t  header;
    uint8_t  msg_type;
    uint8_t  device_id[8];
    uint32_t timestamp;
    float    temperature;
    float    humidity;
    float    light;
    float    soil_moisture;
    float    soil_temperature;
    float    soil_ec;
    float    soil_ph;
    uint16_t crc16;
    uint8_t  footer;
} SensorDataFrame;

/* 心跳帧 */
typedef struct __attribute__((packed)) {
    uint8_t  header;
    uint8_t  msg_type;
    uint8_t  device_id[8];
    uint32_t timestamp;
    uint16_t crc16;
    uint8_t  footer;
} HeartbeatFrame;

/* ==================================== 函数声明 ==================================== */

/**
 * @brief  初始化协议模块
 * @retval 无
 */
void protocol_init(void);

/**
 * @brief  构建传感器数据帧
 * @param  frame: 输出帧结构
 * @param  temperature: 温度
 * @param  humidity: 湿度
 * @param  light: 光照
 * @param  soil_moisture: 土壤湿度
 * @retval SYS_OK: 成功
 */
sys_error_t protocol_build_sensor_frame(SensorDataFrame *frame,
                                        float temperature,
                                        float humidity,
                                        float light,
                                        float soil_moisture,
                                        float soil_temperature,
                                        float soil_ec,
                                        float soil_ph);

/**
 * @brief  构建心跳帧
 * @param  frame: 输出帧结构
 * @retval SYS_OK: 成功
 */
sys_error_t protocol_build_heartbeat_frame(HeartbeatFrame *frame);

/**
 * @brief  计算CRC16校验
 * @param  data: 数据指针
 * @param  len: 数据长度
 * @retval CRC16值
 */
uint16_t protocol_crc16(const uint8_t *data, uint16_t len);

/**
 * @brief  验证帧的CRC
 * @param  frame: 帧指针
 * @param  frame_size: 帧大小
 * @retval 1: CRC正确, 0: CRC错误
 */
uint8_t protocol_verify_crc(const uint8_t *frame, uint16_t frame_size);

/**
 * @brief  将帧转换为字节数组用于发送
 * @param  frame: 帧指针
 * @param  frame_size: 帧大小
 * @param  out_buf: 输出缓冲区
 * @param  out_buf_size: 输出缓冲区大小
 * @retval 实际输出字节数
 */
uint16_t protocol_frame_to_bytes(const void *frame, uint16_t frame_size,
                                  uint8_t *out_buf, uint16_t out_buf_size);

/**
 * @brief  构建命令确认帧
 * @param  frame: 输出帧结构
 * @param  command_id: 命令ID
 * @param  status: 执行状态 (0: 失败, 1: 成功)
 * @retval SYS_OK: 成功
 */
sys_error_t protocol_build_command_ack_frame(CommandAckFrame *frame, 
                                           uint32_t command_id, 
                                           uint8_t status);

/**
 * @brief  解析控制命令帧
 * @param  data: 数据指针
 * @param  data_len: 数据长度
 * @param  frame: 输出帧结构
 * @retval SYS_OK: 成功
 */
sys_error_t protocol_parse_control_command(const uint8_t *data, 
                                         uint16_t data_len, 
                                         ControlCommandFrame *frame);

#ifdef __cplusplus
}
#endif

#endif
