#include "atk_mb026_receiver.h"
#include "atk_mb026_uart.h"
#include "usart.h"
#include "demo.h"
#include "oled0561.h"
#include "Motor.h"    // 电机控制头文件
#include "Servo.h"   // 舵机控制头文件

extern uint32_t timecount; // 外部时间计数变量
#include <stdlib.h>  // ���������԰��� atoi ��������
#include <string.h>  // ���ַ�����

// ��̬�ص�����ָ��
static atk_mb026_data_callback_t data_callback = NULL;

/**
 * @brief ��ȡJSON�����еĿ���ֶ�(type, action.device, action.command, action.params)
 * @param data ���յ���JSON�ַ���
 * @param type �洢typeֵ�Ļ�����
 * @param device_type �洢action.deviceֵ�Ļ�����
 * @param command �洢action.commandֵ�Ļ�����
 * @param param1_name �洢��һ��parameter���Ļ�����
 * @param param1_value �洢��һ��parameterֵ�Ļ�����
 * @return uint8_t 1��ʾ�ɹ���ȡ��0��ʾʧ��
 */
uint8_t extract_json_fields(const char* data, char* type, char* device_type, char* command, char* param1_name, char* param1_value) {
    // ��ʼ�������ֶ�Ϊ���ַ���
    type[0] = '\0';
    device_type[0] = '\0';
    command[0] = '\0';
    param1_name[0] = '\0';
    param1_value[0] = '\0';
    
    // 检查数据是否包含完整的JSON结构
    // 检查是否包含必要的字段
    if (strstr(data, "\"type\":") == NULL ||
        strstr(data, "\"action\":") == NULL ||
        strstr(data, "\"device\":") == NULL ||
        strstr(data, "\"command\":") == NULL) {
        // 检查是否是舵机角度命令的简化格式
        if (strstr(data, "\"angle\":") != NULL) {
            // 简化格式：直接提取角度值
            printf("[DEBUG] Detecting simplified angle command: %s\r\n", data);
            
            // 提取角度值
            const char* angle_ptr = strstr(data, "\"angle\":");
            if (angle_ptr != NULL) {
                angle_ptr += 8; // 跳过"angle": 
                while (*angle_ptr == ' ') angle_ptr++; // 跳过空格
                
                // 提取数值
                const char* angle_end = angle_ptr;
                while (*angle_end && (*angle_end >= '0' && *angle_end <= '9' || *angle_end == '.' || *angle_end == '-')) {
                    angle_end++;
                }
                size_t angle_len = angle_end - angle_ptr;
                if (angle_len > 0 && angle_len < 16) {
                    // 构造标准命令格式
                    strcpy(type, "control");
                    strcpy(device_type, "servo");
                    strcpy(command, "set_angle");
                    strcpy(param1_name, "angle");
                    strncpy(param1_value, angle_ptr, angle_len);
                    param1_value[angle_len] = '\0';
                    
                    printf("[DEBUG] Extracted simplified angle: %s\r\n", param1_value);
                    return 1;
                }
            }
        }
        
        // 缺少必要的字段，返回失败
        printf("[ERROR] JSON missing required fields: %s\r\n", data);
        return 0;
    }
    
    // 1. ��ȡtype�ֶ�
    const char* type_ptr = strstr(data, "\"type\":");
    if (type_ptr != NULL) {
        type_ptr += 7; // ����"type": 
        while (*type_ptr == ' ') type_ptr++; // �����ո�
        
        if (*type_ptr == '\"') {
            type_ptr++; // ��������
            const char* type_end = strchr(type_ptr, '\"');
            if (type_end) {
                size_t type_len = type_end - type_ptr;
                if (type_len > 0 && type_len < 16) {
                    strncpy(type, type_ptr, type_len);
                    type[type_len] = '\0';
                }
            }
        }
    }
    
    // 2. ��ȡaction�ֶ�
    const char* action_ptr = strstr(data, "\"action\":");
    if (action_ptr != NULL) {
        // ��ҵ�action����ĵ�ʼλ��
        const char* action_start = strchr(action_ptr, '{');
        if (action_start != NULL) {
            // 3. ��ȡdevice_type�ֶ�
            const char* device_ptr = strstr(action_start, "\"device\":");
            if (device_ptr != NULL) {
                device_ptr += 9; // ����"device": 
                while (*device_ptr == ' ') device_ptr++; // �����ո�
                
                if (*device_ptr == '\"') {
                    device_ptr++; // ��������
                    const char* device_end = strchr(device_ptr, '\"');
                    if (device_end) {
                        size_t device_len = device_end - device_ptr;
                        if (device_len > 0 && device_len < 16) {
                            strncpy(device_type, device_ptr, device_len);
                            device_type[device_len] = '\0';
                        }
                    }
                }
            }
            
            // 4. ��ȡcommand�ֶ�
            const char* cmd_ptr = strstr(action_start, "\"command\":");
            if (cmd_ptr != NULL) {
                cmd_ptr += 11; // ����"command": 
                while (*cmd_ptr == ' ') cmd_ptr++; // �����ո�
                
                if (*cmd_ptr == '\"') {
                    cmd_ptr++; // ��������
                    const char* cmd_end = strchr(cmd_ptr, '\"');
                    if (cmd_end) {
                        size_t cmd_len = cmd_end - cmd_ptr;
                        if (cmd_len > 0 && cmd_len < 16) {
                            strncpy(command, cmd_ptr, cmd_len);
                            command[cmd_len] = '\0';
                        }
                    }
                }
            }
            
            // 5. ��ȡparams�ֶ�
            const char* params_ptr = strstr(action_start, "\"params\":");
            if (params_ptr != NULL) {
                // ��ҵ�params����ĵ�ʼλ��
                const char* params_start = strchr(params_ptr, '{');
                if (params_start != NULL) {
                    // ��ҵ����һ��parameter
                    // ��ֻ֧��һ��parameter���
                    const char* param_start = params_start + 1;
                    while (*param_start == ' ') param_start++; // �����ո�
                    
                    if (*param_start == '\"') {
                        // ��ȡparameter����
                        param_start++;
                        const char* param_name_end = strchr(param_start, '\"');
                        if (param_name_end != NULL) {
                            size_t param_name_len = param_name_end - param_start;
                            if (param_name_len > 0 && param_name_len < 16) {
                                strncpy(param1_name, param_start, param_name_len);
                                param1_name[param_name_len] = '\0';
                            }
                            
                            // ��ȡparameterֵ
                            const char* param_value_ptr = strchr(param_name_end, ':');
                            if (param_value_ptr != NULL) {
                                param_value_ptr++;
                                while (*param_value_ptr == ' ') param_value_ptr++; // �����ո�
                                
                                if (*param_value_ptr == '\"') {
                                    // �ַ���ֵ
                                    param_value_ptr++;
                                    const char* param_value_end = strchr(param_value_ptr, '\"');
                                    if (param_value_end != NULL) {
                                        size_t param_value_len = param_value_end - param_value_ptr;
                                        if (param_value_len > 0 && param_value_len < 16) {
                                            strncpy(param1_value, param_value_ptr, param_value_len);
                                            param1_value[param_value_len] = '\0';
                                        }
                                    }
                                } else {
                                    // ��������ֵ
                                    const char* param_value_end = param_value_ptr;
                                    while (*param_value_end && (*param_value_end >= '0' && *param_value_end <= '9' || *param_value_end == '.')) {
                                        param_value_end++;
                                    }
                                    size_t param_value_len = param_value_end - param_value_ptr;
                                    if (param_value_len > 0 && param_value_len < 16) {
                                        strncpy(param1_value, param_value_ptr, param_value_len);
                                        param1_value[param_value_len] = '\0';
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // ���سɹ���־��������ȡ��type、device_type和command�ֶΣ�
    if (type[0] != '\0' && device_type[0] != '\0' && command[0] != '\0') {
        return 1;
    } else {
        printf("[ERROR] Failed to extract required fields: type=%s, device=%s, command=%s\r\n", 
               type, device_type, command);
        return 0;
    }
}

/**
 * @brief ��ʼ��������
 */
void atk_mb026_receiver_init(void)
{
    // ����UART����
    atk_mb026_uart_rx_restart();
    
    printf("ATK-MB026 receiver initialized\r\n");
}

/**
 * @brief �������ݻص�����
 * @param callback �ص�����ָ��
 */
void atk_mb026_receiver_set_callback(atk_mb026_data_callback_t callback)
{
    data_callback = callback;
}

/**
 * @brief �������յ�������֡
 */
void atk_mb026_receiver_process(void)
{
    uint8_t *frame = atk_mb026_uart_rx_get_frame();
    
    if (frame != NULL)
    {
        uint16_t frame_len = strlen((const char*)frame);
        
        // 打印接收到的所有数据
        printf("[MB026] Received raw data: %.*s\r\n", frame_len, frame);
        
        // ��������ûص���������ʹ�ûص���������
        if (data_callback != NULL)
        {
            data_callback((const char*)frame, frame_len);
        }
        else
        {
            // ����ʹ��Ĭ�ϴ�������
            atk_mb026_receive_handler((const char*)frame, frame_len);
        }
        
        // ���ý���״̬
        atk_mb026_uart_rx_restart();
    }
}

/**
 * @brief 发送执行结果响应
 * @param device_type 设备类型
 * @param status 执行状态
 * @param value 执行结果值
 */
static void send_response(const char* device_type, const char* status, const char* value) {
    atk_mb026_uart_printf("{\"type\":\"execution_result\",\"device_type\":\"%s\",\"status\":\"%s\",\"value\":%s,\"timestamp\":%lu}",
        device_type, status, value, (unsigned long)(1750617600000 + (timecount / 1000)));
}

/**
 * @brief Ĭ�����ݽ��մ����ص�����
 * @param data ���յ�������
 * @param len ���ݳ���
 */
void atk_mb026_receive_handler(const char* data, uint16_t len)
{
    char type[16] = {0};
    char device_type[16] = {0};
    char command[16] = {0};
    char param1_name[16] = {0};
    char param1_value[16] = {0};
    
    if (extract_json_fields(data, type, device_type, command, param1_name, param1_value)) {
        // 只打印执行器命令的JSON格式
        if (strcmp(type, "control") == 0) {
            // 打印执行器命令信息
            printf("[EXECUTOR] Control command: %.*s\r\n", len, data);
            
            // 处理控制命令
            // 处理水泵命令
            if (strcmp(device_type, "pump") == 0 || strcmp(device_type, "water_pump") == 0) {
                if (strcmp(command, "on") == 0) {
                    printf("[EXECUTOR] Pump ON, speed=50\r\n");
                    // 开启水泵，默认速度50
                    Motor_SetSpeed(50);
                    // 发送响应
                    send_response("pump", "success", "1");
                } else if (strcmp(command, "off") == 0) {
                    printf("[EXECUTOR] Pump OFF\r\n");
                    // 关闭水泵
                    Motor_SetSpeed(0);
                    // 发送响应
                    send_response("pump", "success", "0");
                } else if (strcmp(command, "set_flow") == 0 || strcmp(command, "set_speed") == 0) {
                    // 设置水泵速度
                    int speed = atoi(param1_value);
                    printf("[EXECUTOR] Pump speed set to %d\r\n", speed);
                    // 设置水泵速度，范围-100到100
                    Motor_SetSpeed(speed);
                    // 发送响应
                    char value_str[16];
                    sprintf(value_str, "%d", speed);
                    send_response("pump", "success", value_str);
                }
                // 更新OLED显示
                OLED_DISPLAY_8x16_BUFFER(6, "  Pump on: OK  ");
            }
            // 处理风扇命令
            else if (strcmp(device_type, "fan") == 0) {
                if (strcmp(command, "on") == 0) {
                    printf("[EXECUTOR] Fan ON, speed=50\r\n");
                    // 开启风扇，默认速度50
                    // 实际风扇控制代码
                    // 发送响应
                    send_response("fan", "success", "1");
                } else if (strcmp(command, "off") == 0) {
                    printf("[EXECUTOR] Fan OFF\r\n");
                    // 关闭风扇
                    // 实际风扇控制代码
                    // 发送响应
                    send_response("fan", "success", "0");
                } else if (strcmp(command, "set_speed") == 0) {
                    // 设置风扇速度
                    int speed = atoi(param1_value);
                    printf("[EXECUTOR] Fan speed set to %d\r\n", speed);
                    // 实际风扇速度控制代码
                    // 发送响应
                    char value_str[16];
                    sprintf(value_str, "%d", speed);
                    send_response("fan", "success", value_str);
                }
            }
            // 处理舵机命令
            else if (strcmp(device_type, "servo") == 0) {
                if (strcmp(command, "set_angle") == 0 || strcmp(command, "servo") == 0) {
                    // 设置舵机角度
                    float angle = atof(param1_value);
                    printf("[EXECUTOR] Servo angle set to %.1f degrees\r\n", angle);
                    // 设置舵机角度，范围0到180
                    Servo_SetAngle(angle);
                    // 发送响应
                    char value_str[16];
                    sprintf(value_str, "%.1f", angle);
                    send_response("servo", "success", value_str);
                } else if (strcmp(command, "reset") == 0) {
                    printf("[EXECUTOR] Servo reset to 0 degrees\r\n");
                    // 重置舵机到初始位置（0度）
                    Servo_SetAngle(0);
                    // 发送响应
                    send_response("servo", "success", "0");
                }
            }
            // 处理步进电机命令
            else if (strcmp(device_type, "stepper") == 0 || strcmp(device_type, "stepper_motor") == 0) {
                if (strcmp(command, "set_speed") == 0) {
                    // 设置步进电机速度
                    int speed = atoi(param1_value);
                    printf("[EXECUTOR] Stepper speed set to %d\r\n", speed);
                    // 实际步进电机速度控制代码
                    // 发送响应
                    char value_str[16];
                    sprintf(value_str, "%d", speed);
                    send_response("stepper", "success", value_str);
                }
            }
        }
    }
    
    // 直接处理简化格式的舵机命令（兼容旧格式）
    if (strstr(data, "\"angle\":") != NULL) {
        // 提取角度值
        const char* angle_ptr = strstr(data, "\"angle\":");
        if (angle_ptr != NULL) {
            angle_ptr += 8; // 跳过"angle": 
            while (*angle_ptr == ' ') angle_ptr++; // 跳过空格
            
            // 提取数值
            const char* angle_end = angle_ptr;
            while (*angle_end && (*angle_end >= '0' && *angle_end <= '9' || *angle_end == '.' || *angle_end == '-')) {
                angle_end++;
            }
            size_t angle_len = angle_end - angle_ptr;
            if (angle_len > 0 && angle_len < 16) {
                char angle_str[16] = {0};
                strncpy(angle_str, angle_ptr, angle_len);
                angle_str[angle_len] = '\0';
                
                float angle = atof(angle_str);
                printf("[EXECUTOR] Direct servo angle set to %.1f degrees\r\n", angle);
                // 设置舵机角度，范围0到180
                Servo_SetAngle(angle);
            }
        }
    }
    
    // 保留原有的兼容性代码
    if (strstr(data, "LED_ON") != NULL) {
        printf("[EXECUTOR] LED ON\r\n");
        // 控制LED
    } 
    else if (strstr(data, "LED_OFF") != NULL) {
        printf("[EXECUTOR] LED OFF\r\n");
        // 控制LED
    }
    else if(strstr(data, "{\"type\": \"text\", \"content\": \"1\"}")) {
        printf("[EXECUTOR] Motor ON command received\r\n");
        OLED_DISPLAY_8x16_BUFFER(6,"  Motor on: OK  ");
        // 控制电机
        Motor_SetSpeed(40);
    }
    else if(strstr(data, "{\"type\": \"text\", \"content\": \"0\"}")) {
        printf("[EXECUTOR] Motor OFF command received\r\n");
        OLED_DISPLAY_8x16_BUFFER(6,"  Motor on: OFF ");
        // 控制电机
        Motor_SetSpeed(0);
    }
}


