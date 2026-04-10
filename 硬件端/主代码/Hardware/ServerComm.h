#ifndef __SERVER_COMM_H
#define __SERVER_COMM_H

#include "stm32f10x.h"

// 服务器配置
#define SERVER_IP "192.168.225.43"  // 服务器IP地址
#define SERVER_PORT "3000"          // 服务器端口
#define SERVER_URL SERVER_IP         // 服务器URL
#define SERVER_PATH "/api/monitor/health"  // 服务器健康检查路径

// 传感器ID映射
#define SENSOR_ID_TEMPERATURE "T-001"    // 空气温度传感器
#define SENSOR_ID_HUMIDITY "H-001"       // 空气湿度传感器
#define SENSOR_ID_LIGHT "L-001"          // 光照传感器
#define SENSOR_ID_SOIL_MOISTURE "S-001"   // 土壤湿度传感器
#define SENSOR_ID_SOIL_TEMPERATURE "T-002" // 土壤温度传感器

// 函数声明
void ServerComm_Init(void);
uint8_t ServerComm_SendSensorData(const char *sensor_id, float value);
uint8_t ServerComm_CheckConnection(void);

#endif