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

// ==================== 队列系统配置 ====================

// 队列大小
#define NETWORK_QUEUE_SIZE 32

// 最大重试次数
#define MAX_RETRY_COUNT 3

// 返回值定义
#define SERVER_COMM_OK 0
#define SERVER_COMM_ERROR 1
#define SERVER_COMM_ERROR_QUEUE_FULL 2
#define SERVER_COMM_ERROR_QUEUE_EMPTY 3
#define SERVER_COMM_ERROR_INVALID_PARAM 4
#define SERVER_COMM_ERROR_SENSOR 5

// ==================== 队列数据结构定义 ====================

/**
 * @brief 请求类型枚举
 */
typedef enum {
    REQ_TYPE_SENSOR_DATA = 0,      // 传感器数据上传请求
    REQ_TYPE_ACTUATOR_STATUS,      // 执行器状态上传请求
    REQ_TYPE_COMMAND_QUERY,         // 指令查询请求
    REQ_TYPE_COMMAND_CONFIRM,        // 指令确认请求
    REQ_TYPE_HEARTBEAT             // 心跳保活请求
} RequestType_t;

/**
 * @brief 请求优先级枚举
 */
typedef enum {
    REQ_PRIORITY_LOW = 0,          // 低优先级
    REQ_PRIORITY_NORMAL = 1,        // 普通优先级
    REQ_PRIORITY_HIGH = 2           // 高优先级
} RequestPriority_t;

/**
 * @brief 传感器数据请求结构体
 */
typedef struct {
    char sensor_id[16];            // 传感器ID
    float value;                   // 传感器值
} SensorDataRequest_t;

/**
 * @brief 执行器状态请求结构体
 */
typedef struct {
    char actuator_id[16];          // 执行器ID
    uint8_t state;                 // 执行器状态 (0:关闭, 1:开启)
    uint8_t mode;                  // 执行器模式 (0:自动, 1:手动)
} ActuatorStatusRequest_t;

/**
 * @brief 指令查询请求结构体
 */
typedef struct {
    char actuator_id[16];          // 执行器ID
    int *command_id_ptr;           // 指令ID指针（用于返回）
    char *command_ptr;             // 指令内容指针（用于返回）
} CommandQueryRequest_t;

/**
 * @brief 指令确认请求结构体
 */
typedef struct {
    char actuator_id[16];          // 执行器ID
    int command_id;                // 指令ID
    char status[16];               // 指令状态
} CommandConfirmRequest_t;

/**
 * @brief 统一网络请求结构体（使用联合体节省内存）
 */
typedef struct {
    RequestType_t type;           // 请求类型
    RequestPriority_t priority;     // 请求优先级
    uint32_t timestamp;          // 请求时间戳
    uint8_t retry_count;         // 重试次数
    union {
        SensorDataRequest_t sensor_data;         // 传感器数据
        ActuatorStatusRequest_t actuator_status;  // 执行器状态
        CommandQueryRequest_t command_query;      // 指令查询
        CommandConfirmRequest_t command_confirm;   // 指令确认
    } data;                              // 请求数据联合体
} NetworkRequest_t;

/**
 * @brief 网络请求队列结构体
 */
typedef struct {
    NetworkRequest_t requests[NETWORK_QUEUE_SIZE];  // 请求队列
    uint16_t head;                                  // 队列头指针
    uint16_t tail;                                  // 队列尾指针
    uint16_t count;                                 // 队列计数
} NetworkQueue_t;

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

// ==================== 队列操作函数声明 ====================

/**
 * @brief 初始化网络请求队列
 */
void NetworkQueue_Init(NetworkQueue_t *queue);

/**
 * @brief 添加请求到队列（按优先级插入）
 */
uint8_t NetworkQueue_Enqueue(NetworkQueue_t *queue, NetworkRequest_t *request);

/**
 * @brief 从队列中取出请求
 */
uint8_t NetworkQueue_Dequeue(NetworkQueue_t *queue, NetworkRequest_t *request);

/**
 * @brief 检查队列是否为空
 */
uint8_t NetworkQueue_IsEmpty(NetworkQueue_t *queue);

/**
 * @brief 检查队列是否已满
 */
uint8_t NetworkQueue_IsFull(NetworkQueue_t *queue);

/**
 * @brief 获取队列中的请求数量
 */
uint16_t NetworkQueue_GetCount(NetworkQueue_t *queue);

/**
 * @brief 批量处理队列中的请求
 */
uint8_t ServerComm_ProcessBatch(uint8_t max_count);

/**
 * @brief 处理队列中的所有请求
 */
void ServerComm_ProcessQueue(void);

#endif
