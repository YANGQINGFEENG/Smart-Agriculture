#ifndef __ATK_MB026_RECEIVER_H
#define __ATK_MB026_RECEIVER_H

#include "stm32f10x.h"
#include <string.h>

// ���ݽ��ջص��������Ͷ���
typedef void (*atk_mb026_data_callback_t)(const char* data, uint16_t len);

// ��������
void atk_mb026_receiver_init(void);
void atk_mb026_receiver_set_callback(atk_mb026_data_callback_t callback);
void atk_mb026_receiver_process(void);
void atk_mb026_receive_handler(const char* data, uint16_t len);

// JSON�ֶ���ȡ��������
uint8_t extract_json_fields(const char* data, char* type, char* device_type, char* command, char* param1_name, char* param1_value);

#endif /* __ATK_MB026_RECEIVER_H */



