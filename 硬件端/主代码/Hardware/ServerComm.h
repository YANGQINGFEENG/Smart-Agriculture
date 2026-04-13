#ifndef __SERVER_COMM_H
#define __SERVER_COMM_H

#include "stm32f10x.h"

// 服务器配置
#define SERVER_IP "192.168.128.43"
#define SERVER_PORT "3000"
#define SERVER_URL SERVER_IP
#define SERVER_PATH "/api/sensors"

// 数据上传间隔（毫秒）- 10秒
#define UPLOAD_INTERVAL_MS 10000

// TCP连接超时时间（毫秒）
#define TCP_CONNECT_TIMEOUT 5000

// 传感器ID映射
// 空气温湿度传感器（DHT11）
#define SENSOR_ID_AIR_TEMP "T-001"
#define SENSOR_ID_AIR_HUMIDITY "H-001"

// 光照传感器
#define SENSOR_ID_LIGHT "L-001"

// 土壤传感器（RS485）
#define SENSOR_ID_SOIL_MOISTURE "S-001"
#define SENSOR_ID_SOIL_TEMP "T-002"
#define SENSOR_ID_SOIL_EC "E-001"
#define SENSOR_ID_SOIL_PH "P-001"

// 执行器ID映射
// 继电器1 - 通风风扇
#define ACTUATOR_ID_FAN "WP-001"
// 继电器2 - 水泵
#define ACTUATOR_ID_PUMP "WP-002"

// 函数声明
void ServerComm_Init(void);
uint8_t ServerComm_Connect(void);
void ServerComm_Disconnect(void);
uint8_t ServerComm_IsConnected(void);
uint8_t ServerComm_UploadSensorData(const char *sensor_id, float value);
uint8_t ServerComm_UploadAllSensors(void);
uint8_t ServerComm_UploadAllSensors_Transparent(void);
uint8_t ServerComm_SendData_KeepAlive(void);
uint8_t ServerComm_SendData_KeepAlive_Silent(void);  // 静默上传（后台运行）
uint8_t ServerComm_UploadActuatorStatus(const char *actuator_id, uint8_t state, uint8_t mode);
uint8_t ServerComm_CheckAndExecuteCommand(const char *actuator_id, int *command_id, char *command);
uint8_t ServerComm_ConfirmCommand(const char *actuator_id, int command_id, const char *status);
void ServerComm_TestFixedRequest(void);

#endif
