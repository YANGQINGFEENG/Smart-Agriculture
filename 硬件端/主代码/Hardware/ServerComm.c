#include "ServerComm.h"
#include "atk_mb026.h"
#include "atk_mb026_uart.h"
#include "Delay.h"
#include "dht11.h"
#include "LightSensor.h"
#include "SoilSensor.h"
#include "OLED.h"
#include "RELAY/relay.h"
#include "PrintManager.h"
#include "command_manager.h"
#include "state_manager.h"
#include <string.h>
#include <stdio.h>
#include <stdlib.h>

// DWT周期计数器相关定义
#define DWT_CYCCNT  ((volatile uint32_t *)0xE0001004)
#define DWT_CTRL    ((volatile uint32_t *)0xE0001000)
#define DWT_CTRL_CYCCNTENA_Msk  (1UL << 0)

// ==================== 全局变量定义 ====================

static uint8_t g_tcp_connected = 0;                    // TCP连接状态标志
static uint8_t g_transparent_mode = 0;                 // 透传模式标志
NetworkQueue_t g_network_queue;                         // 网络请求队列（全局变量，供OLED显示使用）

CommandQueue_t command_queue;                           // 指令队列
static uint32_t g_system_time = 0;                      // 系统时间计数器

// ==================== 时间统计函数 ====================

/**
 * @brief 初始化DWT周期计数器
 */
static void DWT_Init(void)
{
    CoreDebug->DEMCR |= CoreDebug_DEMCR_TRCENA_Msk;
    *DWT_CYCCNT = 0;
    *DWT_CTRL |= DWT_CTRL_CYCCNTENA_Msk;
}

/**
 * @brief 获取当前周期计数
 * @return 当前周期计数值
 */
static inline uint32_t DWT_GetCycles(void)
{
    return *DWT_CYCCNT;
}

/**
 * @brief 将周期数转换为毫秒
 * @param cycles 周期数
 * @return 毫秒数
 */
static inline uint32_t CyclesToMs(uint32_t cycles)
{
    return cycles / (SystemCoreClock / 1000);
}

// ==================== 队列操作函数实现 ====================

/**
 * @brief 初始化网络请求队列
 * @param queue 队列指针
 * @note 将队列头尾指针和计数器初始化为0
 */
void NetworkQueue_Init(NetworkQueue_t *queue)
{
    queue->head = 0;
    queue->tail = 0;
    queue->count = 0;
    memset(queue->requests, 0, sizeof(queue->requests));
    printf("[Queue] 队列初始化完成，大小: %d\r\n", NETWORK_QUEUE_SIZE);
}

/**
 * @brief 添加请求到队列（按优先级插入）
 * @param queue 队列指针
 * @param request 请求指针
 * @return 0:成功 1:队列已满
 * @note 高优先级请求会插入到队列前面
 */
uint8_t NetworkQueue_Enqueue(NetworkQueue_t *queue, NetworkRequest_t *request)
{
    if (NetworkQueue_IsFull(queue)) {
        printf("[Queue] 队列已满，无法添加请求\r\n");
        return SERVER_COMM_ERROR_QUEUE_FULL;
    }
    
    // 设置请求时间戳
    request->timestamp = g_system_time;
    request->retry_count = 0;
    
    // 根据优先级插入到队列
    if (request->priority == REQ_PRIORITY_HIGH) {
        // 高优先级：插入到队列头部
        uint16_t insert_pos = queue->head;
        if (insert_pos == 0) {
            insert_pos = NETWORK_QUEUE_SIZE - 1;
        } else {
            insert_pos--;
        }
        
        // 移动其他请求
        if (queue->count > 0) {
            for (uint16_t i = 0; i < queue->count; i++) {
                uint16_t src_pos = (queue->head - 1 - i + NETWORK_QUEUE_SIZE) % NETWORK_QUEUE_SIZE;
                uint16_t dst_pos = (src_pos - 1 + NETWORK_QUEUE_SIZE) % NETWORK_QUEUE_SIZE;
                queue->requests[dst_pos] = queue->requests[src_pos];
            }
        }
        
        queue->head = insert_pos;
    } else {
        // 普通和低优先级：添加到队列尾部
        queue->requests[queue->tail] = *request;
        queue->tail = (queue->tail + 1) % NETWORK_QUEUE_SIZE;
    }
    
    queue->count++;
    
    return SERVER_COMM_OK;
}

/**
 * @brief 从队列中取出请求
 * @param queue 队列指针
 * @param request 请求指针（用于返回）
 * @return 0:成功 1:队列为空
 */
uint8_t NetworkQueue_Dequeue(NetworkQueue_t *queue, NetworkRequest_t *request)
{
    if (NetworkQueue_IsEmpty(queue)) {
        return SERVER_COMM_ERROR_QUEUE_EMPTY;
    }
    
    *request = queue->requests[queue->head];
    queue->head = (queue->head + 1) % NETWORK_QUEUE_SIZE;
    queue->count--;
    
    return SERVER_COMM_OK;
}

/**
 * @brief 检查队列是否为空
 * @param queue 队列指针
 * @return 1:队列为空 0:队列不为空
 */
uint8_t NetworkQueue_IsEmpty(NetworkQueue_t *queue)
{
    return (queue->count == 0);
}

/**
 * @brief 检查队列是否已满
 * @param queue 队列指针
 * @return 1:队列已满 0:队列未满
 */
uint8_t NetworkQueue_IsFull(NetworkQueue_t *queue)
{
    return (queue->count >= NETWORK_QUEUE_SIZE);
}

/**
 * @brief 获取队列中的请求数量
 * @param queue 队列指针
 * @return 队列中的请求数量
 */
uint16_t NetworkQueue_GetCount(NetworkQueue_t *queue)
{
    return queue->count;
}

/**
 * @brief 清空队列
 * @param queue 队列指针
 */
void NetworkQueue_Clear(NetworkQueue_t *queue)
{
    queue->head = 0;
    queue->tail = 0;
    queue->count = 0;
    memset(queue->requests, 0, sizeof(queue->requests));
    printf("[Queue] 队列已清空\r\n");
}

// ==================== 指令队列操作函数实现 ====================

/**
 * @brief 初始化指令队列
 */
void ServerComm_InitCommandQueue(void)
{
    command_queue.head = 0;
    command_queue.tail = 0;
    command_queue.count = 0;
    memset(command_queue.commands, 0, sizeof(command_queue.commands));
    PRINT_INFO(PRINT_MODULE_SERVER, "指令队列初始化完成，大小: %d\r\n", COMMAND_QUEUE_SIZE);
}

/**
 * @brief 添加指令到队列
 * @param actuator_id 执行器ID
 * @param command 指令内容
 * @return 0:成功 1:队列已满
 */
uint8_t ServerComm_AddToCommandQueue(const char *actuator_id, const char *command)
{
    if (command_queue.count >= COMMAND_QUEUE_SIZE) {
        PRINT_WARNING(PRINT_MODULE_SERVER, "指令队列已满，无法添加新指令\r\n");
        return 1;
    }
    
    // 添加到队列尾部
    strncpy(command_queue.commands[command_queue.tail].actuator_id, actuator_id, sizeof(command_queue.commands[command_queue.tail].actuator_id) - 1);
    strncpy(command_queue.commands[command_queue.tail].command, command, sizeof(command_queue.commands[command_queue.tail].command) - 1);
    
    command_queue.tail = (command_queue.tail + 1) % COMMAND_QUEUE_SIZE;
    command_queue.count++;
    
    PRINT_INFO(PRINT_MODULE_SERVER, "指令已添加到队列: 执行器=%s, 指令=%s\r\n", actuator_id, command);
    return 0;
}

/**
 * @brief 处理队列中的指令
 */
void ServerComm_ProcessCommandQueue(void)
{
    if (command_queue.count == 0) {
        return;
    }
    
    // 处理队列中的所有指令
    while (command_queue.count > 0) {
        // 取出队列头部的指令
        Command_t cmd = command_queue.commands[command_queue.head];
        command_queue.head = (command_queue.head + 1) % COMMAND_QUEUE_SIZE;
        command_queue.count--;
        
        // 执行指令
        PRINT_INFO(PRINT_MODULE_ACTUATOR, "执行队列中的指令: 执行器=%s, 指令=%s\r\n", cmd.actuator_id, cmd.command);
        ServerComm_ExecuteCommand(cmd.actuator_id, cmd.command);
        
        // 短暂延迟，避免处理过快
        delay_ms(10);
    }
}

// ==================== 服务器通信模块初始化 ====================

/**
 * @brief 初始化服务器通信模块
 */
void ServerComm_Init(void)
{
    g_tcp_connected = 0;
    g_transparent_mode = 0;
    g_system_time = 0;
    
    // 初始化DWT周期计数器
    DWT_Init();
    
    // 初始化网络请求队列
    NetworkQueue_Init(&g_network_queue);
    
    // 初始化指令队列
    ServerComm_InitCommandQueue();
    
    printf("\r\n========================================\r\n");
    printf("[ServerComm] 初始化服务器通信模块\r\n");
    printf("[ServerComm] 服务器地址: %s:%s\r\n", SERVER_IP, SERVER_PORT);
    printf("[ServerComm] 上传间隔: %d ms\r\n", UPLOAD_INTERVAL_MS);
    printf("[ServerComm] 队列大小: %d\r\n", NETWORK_QUEUE_SIZE);
    printf("[ServerComm] 队列模式已启用\r\n");
    printf("========================================\r\n\r\n");
}

/**
 * @brief 检查TCP连接是否真的存活
 * @return 1:连接存活 0:连接断开
 */
static uint8_t ServerComm_CheckRealConnection(void)
{
    uint8_t *response;
    
    if (!g_tcp_connected) {
        return 0;
    }
    
    atk_mb026_uart_rx_restart();
    delay_ms(50);
    
    response = atk_mb026_uart_rx_get_frame();
    if (response != NULL) {
        if (strstr((const char *)response, "CLOSED") != NULL ||
            strstr((const char *)response, "ERROR") != NULL) {
            printf("[ServerComm] 检测到连接断开\r\n");
            g_tcp_connected = 0;
            g_transparent_mode = 0;
            return 0;
        }
        atk_mb026_uart_rx_restart();
    }
    
    return 1;
}

/**
 * @brief 建立TCP连接并进入透传模式
 * @return 0:成功 1:连接失败 2:透传模式失败
 */
uint8_t ServerComm_Connect(void)
{
    uint8_t retry = 0;
    uint8_t max_retry = 3;
    
    if (g_tcp_connected && g_transparent_mode) {
        if (ServerComm_CheckRealConnection()) {
            printf("[ServerComm] 已处于连接状态，无需重连\r\n");
            return 0;
        }
        printf("[ServerComm] 连接已断开，重新建立...\r\n");
        g_tcp_connected = 0;
        g_transparent_mode = 0;
    }
    
    for (retry = 0; retry < max_retry; retry++) {
        printf("[ServerComm] 建立TCP连接 (尝试 %d/%d)...\r\n", retry + 1, max_retry);
        
        atk_mb026_send_at_cmd("AT+CIPCLOSE", "OK", 1000);
        delay_ms(200);
        
        if (atk_mb026_connect_tcp_server((char *)SERVER_IP, (char *)SERVER_PORT) == ATK_MB026_EOK) {
            g_tcp_connected = 1;
            printf("[ServerComm] TCP连接成功\r\n");
            break;
        }
        
        printf("[ServerComm] TCP连接失败，%d秒后重试...\r\n", 1);
        delay_ms(1000);
    }
    
    if (!g_tcp_connected) {
        printf("[ServerComm] TCP连接失败，已达最大重试次数\r\n");
        return 1;
    }
    
    delay_ms(300);
    
    printf("[ServerComm] 进入透传模式...\r\n");
    if (atk_mb026_enter_unvarnished() != ATK_MB026_EOK) {
        printf("[ServerComm] 进入透传模式失败\r\n");
        atk_mb026_send_at_cmd("AT+CIPCLOSE", "OK", 2000);
        g_tcp_connected = 0;
        g_transparent_mode = 0;
        return 2;
    }
    
    g_transparent_mode = 1;
    printf("[ServerComm] 透传模式成功，连接已建立\r\n");
    
    return 0;
}

/**
 * @brief 断开TCP连接
 */
void ServerComm_Disconnect(void)
{
    if (g_transparent_mode) {
        printf("[ServerComm] 退出透传模式...\r\n");
        atk_mb026_exit_unvarnished();
        delay_ms(500);
        g_transparent_mode = 0;
    }
    
    if (g_tcp_connected) {
        printf("[ServerComm] 关闭TCP连接...\r\n");
        atk_mb026_send_at_cmd("AT+CIPCLOSE", "OK", 2000);
        g_tcp_connected = 0;
    }
    
    printf("[ServerComm] 连接已断开\r\n");
}

/**
 * @brief 检查TCP连接状态
 * @return 1:已连接 0:未连接
 */
uint8_t ServerComm_IsConnected(void)
{
    if (!g_tcp_connected || !g_transparent_mode) {
        return 0;
    }
    return ServerComm_CheckRealConnection();
}

/**
 * @brief 确保TCP连接可用，如果断开则重连
 * @return 0:连接可用 1:连接失败
 */
static uint8_t ServerComm_EnsureConnection(void)
{
    if (ServerComm_IsConnected()) {
        return 0;
    }
    
    printf("[ServerComm] 连接不可用，尝试重连...\r\n");
    return ServerComm_Connect();
}

/*
 * @brief 上传单个传感器数据到服务器
 * @param sensor_id 传感器ID
 * @param value 传感器值
 * @return 0:成功 1:连接失败 2:发送失败 3:响应异常
 */
/*
uint8_t ServerComm_UploadSensorData(const char *sensor_id, float value)
{
    char url[64];
    char request[400];
    char json_data[32];
    uint8_t *response = NULL;
    uint32_t timeout = 0;
    
    sprintf(url, "/api/sensors/%s/data", sensor_id);
    sprintf(json_data, "{\"value\":%.2f}", value);
    
    int json_len = strlen(json_data);
    sprintf(request, "POST %s HTTP/1.1\r\n"
                   "Host: %s:%s\r\n"
                   "Content-Type: application/json\r\n"
                   "Content-Length: %d\r\n"
                   "Connection: close\r\n"
                   "\r\n"
                   "%s",
                   url, SERVER_IP, SERVER_PORT, json_len, json_data);
    
    printf("\r\n[Upload] %s = %.2f\r\n", sensor_id, value);
    
    delay_ms(1000);
    
    if (atk_mb026_connect_tcp_server((char *)SERVER_IP, (char *)SERVER_PORT) != ATK_MB026_EOK) {
        printf("[Upload] 连接失败\r\n");
        return 1;
    }
    
    delay_ms(500);
    
    char cmd[32];
    int req_len = strlen(request);
    sprintf(cmd, "AT+CIPSEND=%d", req_len);
    
    atk_mb026_uart_rx_restart();
    
    if (atk_mb026_send_at_cmd(cmd, ">", 5000) != ATK_MB026_EOK) {
        printf("[Upload] 发送失败\r\n");
        atk_mb026_send_at_cmd("AT+CIPCLOSE", "OK", 2000);
        return 2;
    }
    
    atk_mb026_uart_rx_restart();
    atk_mb026_uart_printf(request);
    
    timeout = 10000;
    uint8_t success = 0;
    uint8_t got_send_ok = 0;
    
    while (timeout > 0) {
        response = atk_mb026_uart_rx_get_frame();
        if (response != NULL) {
            if (strstr((const char *)response, "SEND OK") != NULL) {
                got_send_ok = 1;
                printf("[Upload] 发送OK\r\n");
            }
            else if (strstr((const char *)response, "\"success\":true") != NULL ||
                     strstr((const char *)response, "\"success\": true") != NULL) {
                printf("[Upload] 成功!\r\n");
                success = 1;
            }
            else if (strstr((const char *)response, "HTTP/1.1 200") != NULL) {
                printf("[Upload] HTTP 200\r\n");
            }
            else if (strstr((const char *)response, "HTTP/1.1 400") != NULL) {
                printf("[Upload] HTTP 400\r\n");
            }
            else if (strstr((const char *)response, "CLOSED") != NULL) {
                printf("[Upload] 关闭\r\n");
                if (got_send_ok && !success) {
                    success = 1;
                }
                break;
            }
            atk_mb026_uart_rx_restart();
        }
        timeout--;
        delay_ms(1);
    }
    
    atk_mb026_send_at_cmd("AT+CIPCLOSE", "OK", 2000);
    
    delay_ms(1000);
    
    return success ? 0 : 3;
}
*/

/*
 * @brief 测试发送固定HTTP请求
 */
/*
void ServerComm_TestFixedRequest(void)
{
    if (atk_mb026_connect_tcp_server((char *)SERVER_IP, (char *)SERVER_PORT) != ATK_MB026_EOK) {
        return;
    }
    
    delay_ms(1000);
    
    if (atk_mb026_enter_unvarnished() != ATK_MB026_EOK) {
        atk_mb026_send_at_cmd("AT+CIPCLOSE", "OK", 2000);
        return;
    }
    
    delay_ms(500);
    
    atk_mb026_uart_printf_blocking("POST /api/sensors/T-001/data HTTP/1.1\r\n");
    atk_mb026_uart_printf_blocking("Host: 192.168.128.43:3000\r\n");
    atk_mb026_uart_printf_blocking("Content-Type: application/json\r\n");
    atk_mb026_uart_printf_blocking("Content-Length: 14\r\n");
    atk_mb026_uart_printf_blocking("Connection: close\r\n");
    atk_mb026_uart_printf_blocking("\r\n");
    atk_mb026_uart_printf_blocking("{\"value\":25.00}");
    
    delay_ms(500);
    atk_mb026_exit_unvarnished();
    delay_ms(1000);
    
    atk_mb026_send_at_cmd("AT+CIPCLOSE", "OK", 2000);
}
*/

/**
 * @brief 发送传感器数据并检查服务器响应
 * @param sensor_id 传感器ID
 * @param json_buf JSON数据缓冲区
 * @param json_len JSON数据长度
 * @return 1:成功 0:失败
 */
static uint8_t ServerComm_SendSensorDataWithCheck(const char *sensor_id, const char *json_buf, uint8_t json_len)
{
    uint8_t *response;
    uint16_t timeout;
    uint8_t success = 0;
    uint8_t got_200 = 0;
    
    if (ServerComm_EnsureConnection() != 0) {
        printf("[Sensor] %s -> 连接不可用，跳过发送\r\n", sensor_id);
        return 0;
    }
    
    atk_mb026_uart_rx_restart();
    delay_ms(50);
    atk_mb026_uart_rx_restart();
    delay_ms(20);
    
    atk_mb026_uart_printf_blocking("POST /api/sensors/%s/data HTTP/1.1\r\n", sensor_id);
    delay_ms(5);
    atk_mb026_uart_printf_blocking("Host: %s:%s\r\n", SERVER_IP, SERVER_PORT);
    delay_ms(5);
    atk_mb026_uart_printf_blocking("Content-Type: application/json\r\n");
    delay_ms(5);
    atk_mb026_uart_printf_blocking("Content-Length: %d\r\n", json_len);
    delay_ms(5);
    atk_mb026_uart_printf_blocking("Connection: keep-alive\r\n");
    delay_ms(5);
    atk_mb026_uart_printf_blocking("\r\n");
    delay_ms(5);
    atk_mb026_uart_printf_blocking("%s", json_buf);
    
    timeout = 2000;
    while (timeout > 0) {
        response = atk_mb026_uart_rx_get_frame();
        if (response != NULL) {
            if (strstr((const char *)response, "HTTP/1.1 200") != NULL) {
                printf("[Sensor] %s -> HTTP 200 OK\r\n", sensor_id);
                got_200 = 1;
            }
            else if (strstr((const char *)response, "HTTP/1.1 400") != NULL) {
                printf("[Sensor] %s -> 收到400 (可能是旧响应)\r\n", sensor_id);
            }
            else if (strstr((const char *)response, "HTTP/1.1 404") != NULL) {
                printf("[Sensor] %s -> 传感器不存在\r\n", sensor_id);
                break;
            }
            else if (strstr((const char *)response, "HTTP/1.1 500") != NULL) {
                printf("[Sensor] %s -> 服务器错误\r\n", sensor_id);
                break;
            }
            
            if (strstr((const char *)response, "\"success\":true") != NULL ||
                strstr((const char *)response, "\"success\": true") != NULL) {
                printf("[Sensor] %s -> 上传成功!\r\n", sensor_id);
                success = 1;
                break;
            }
            
            atk_mb026_uart_rx_restart();
        }
        timeout--;
        delay_ms(1);
    }
    
    if (!success && got_200) {
        printf("[Sensor] %s -> 收到200，视为成功\r\n", sensor_id);
        success = 1;
    }
    
    return success;
}

/*
 * @brief 使用长连接模式发送传感器数据（不断开连接）
 * @return 成功上传的传感器数量
 */
/*
uint8_t ServerComm_SendData_KeepAlive(void)
{
    uint8_t success_count = 0;
    uint8_t dht_temp, dht_humi;
    uint16_t light_lux;
    float soil_moisture, soil_temp, soil_ec, soil_ph;
    uint16_t ec_value;
    char json_buf[32];
    uint8_t json_len;
    
    printf("\r\n[DEBUG] ServerComm_SendData_KeepAlive 开始\r\n");
    
    if (ServerComm_EnsureConnection() != 0) {
        printf("[ERROR] 连接不可用，无法发送数据\r\n");
        OLED_ShowString(1, 1, "  TCP Failed");
        OLED_ShowString(2, 1, "  Retry...");
        return 0;
    }
    
    printf("[DEBUG] TCP连接正常，开始发送数据\r\n");
    
    OLED_ShowString(1, 1, "  Sending");
    OLED_ShowString(2, 1, "  Data...");
    
    printf("[DEBUG] 步骤1: 读取DHT11...\r\n");
    if (DHT11_ReadData() == 0) {
        dht_temp = DHT11_GetTemperature();
        dht_humi = DHT11_GetHumidity();
        printf("[DHT11] T=%dC, H=%d%%\r\n", dht_temp, dht_humi);
        
        if (dht_temp > 0) {
            printf("[DEBUG] 发送温度数据...\r\n");
            sprintf(json_buf, "{\"value\":%d.00}", dht_temp);
            json_len = strlen(json_buf);
            if (ServerComm_SendSensorDataWithCheck(SENSOR_ID_AIR_TEMP, json_buf, json_len)) {
                success_count++;
            }
        }
        
        if (dht_humi > 0) {
            printf("[DEBUG] 发送湿度数据...\r\n");
            sprintf(json_buf, "{\"value\":%d.00}", dht_humi);
            json_len = strlen(json_buf);
            if (ServerComm_SendSensorDataWithCheck(SENSOR_ID_AIR_HUMIDITY, json_buf, json_len)) {
                success_count++;
            }
        }
    } else {
        printf("[ERROR] DHT11读取失败\r\n");
    }
    
    printf("[DEBUG] 步骤2: 读取光照...\r\n");
    light_lux = LightSensor_GetLux();
    printf("[Light] %d Lux\r\n", light_lux);
    
    if (light_lux > 0) {
        sprintf(json_buf, "{\"value\":%d.00}", light_lux);
        json_len = strlen(json_buf);
        if (ServerComm_SendSensorDataWithCheck(SENSOR_ID_LIGHT, json_buf, json_len)) {
            success_count++;
        }
    }
    
    printf("[DEBUG] 步骤3: 读取土壤传感器...\r\n");
    if (SoilSensor_ReadData(&soil_moisture, &soil_temp, &ec_value, &soil_ph) == 0) {
        soil_ec = (float)ec_value;
        printf("[Soil] M=%.1f%%, T=%.1fC, EC=%.0f, pH=%.1f\r\n", 
               soil_moisture, soil_temp, soil_ec, soil_ph);
        
        if (soil_moisture > 0) {
            printf("[DEBUG] 发送土壤含水率...\r\n");
            sprintf(json_buf, "{\"value\":%.2f}", soil_moisture);
            json_len = strlen(json_buf);
            if (ServerComm_SendSensorDataWithCheck(SENSOR_ID_SOIL_MOISTURE, json_buf, json_len)) {
                success_count++;
            }
        }
        
        if (soil_temp > 0) {
            printf("[DEBUG] 发送土壤温度...\r\n");
            sprintf(json_buf, "{\"value\":%.2f}", soil_temp);
            json_len = strlen(json_buf);
            if (ServerComm_SendSensorDataWithCheck(SENSOR_ID_SOIL_TEMP, json_buf, json_len)) {
                success_count++;
            }
        }
        
        if (soil_ec > 0) {
            printf("[DEBUG] 发送土壤EC...\r\n");
            sprintf(json_buf, "{\"value\":%.2f}", soil_ec);
            json_len = strlen(json_buf);
            if (ServerComm_SendSensorDataWithCheck(SENSOR_ID_SOIL_EC, json_buf, json_len)) {
                success_count++;
            }
        }
        
        if (soil_ph > 0) {
            printf("[DEBUG] 发送土壤pH...\r\n");
            sprintf(json_buf, "{\"value\":%.2f}", soil_ph);
            json_len = strlen(json_buf);
            if (ServerComm_SendSensorDataWithCheck(SENSOR_ID_SOIL_PH, json_buf, json_len)) {
                success_count++;
            }
        }
    } else {
        printf("[ERROR] 土壤传感器读取失败\r\n");
    }
    
    printf("[DEBUG] 数据发送完成，保持TCP连接 (成功: %d)\r\n", success_count);
    
    OLED_ShowString(1, 1, "  Sent OK");
    OLED_ShowString(2, 1, "  KeepAlive");
    
    return success_count;
}
*/

/**
 * @brief 静默发送单个传感器数据（不打印日志）
 * @param sensor_id 传感器ID
 * @param json_buf JSON数据缓冲区
 * @param json_len JSON数据长度
 * @return 1:成功 0:失败
 */
static uint8_t ServerComm_SendSensorDataSilent(const char *sensor_id, const char *json_buf, uint8_t json_len)
{
    uint8_t *response;
    uint16_t timeout;
    uint8_t success = 0;
    
    if (ServerComm_EnsureConnection() != 0) {
        return 0;
    }
    
    atk_mb026_uart_rx_restart();
    delay_ms(50);
    atk_mb026_uart_rx_restart();
    delay_ms(20);
    
    atk_mb026_uart_printf_blocking("POST /api/sensors/%s/data HTTP/1.1\r\n", sensor_id);
    delay_ms(5);
    atk_mb026_uart_printf_blocking("Host: %s:%s\r\n", SERVER_IP, SERVER_PORT);
    delay_ms(5);
    atk_mb026_uart_printf_blocking("Content-Type: application/json\r\n");
    delay_ms(5);
    atk_mb026_uart_printf_blocking("Content-Length: %d\r\n", json_len);
    delay_ms(5);
    atk_mb026_uart_printf_blocking("Connection: keep-alive\r\n");
    delay_ms(5);
    atk_mb026_uart_printf_blocking("\r\n");
    delay_ms(5);
    atk_mb026_uart_printf_blocking("%s", json_buf);
    
    timeout = 1500;
    while (timeout > 0) {
        response = atk_mb026_uart_rx_get_frame();
        if (response != NULL) {
            if (strstr((const char *)response, "HTTP/1.1 200") != NULL ||
                strstr((const char *)response, "\"success\":true") != NULL ||
                strstr((const char *)response, "\"success\": true") != NULL) {
                success = 1;
                break;
            }
            atk_mb026_uart_rx_restart();
        }
        timeout--;
        delay_ms(1);
    }
    
    return success;
}

/**
 * @brief 静默上传传感器数据（后台运行，不打印详细日志）
 * @return 成功上传的传感器数量
 */
uint8_t ServerComm_SendData_KeepAlive_Silent(void)
{
    uint8_t success_count = 0;
    uint8_t dht_temp, dht_humi;
    uint16_t light_lux;
    float soil_moisture, soil_temp, soil_ec, soil_ph;
    uint16_t ec_value;
    char json_buf[32];
    uint8_t json_len;
    
    if (ServerComm_EnsureConnection() != 0) {
        return 0;
    }
    
    // 读取并发送DHT11数据
    if (DHT11_ReadData() == 0) {
        dht_temp = DHT11_GetTemperature();
        dht_humi = DHT11_GetHumidity();
        
        if (dht_temp > 0) {
            sprintf(json_buf, "{\"value\":%d.00}", dht_temp);
            json_len = strlen(json_buf);
            if (ServerComm_SendSensorDataSilent(SENSOR_ID_AIR_TEMP, json_buf, json_len)) {
                success_count++;
            }
        }
        
        if (dht_humi > 0) {
            sprintf(json_buf, "{\"value\":%d.00}", dht_humi);
            json_len = strlen(json_buf);
            if (ServerComm_SendSensorDataSilent(SENSOR_ID_AIR_HUMIDITY, json_buf, json_len)) {
                success_count++;
            }
        }
    }
    
    // 读取并发送光照数据
    light_lux = LightSensor_GetLux();
    if (light_lux > 0) {
        sprintf(json_buf, "{\"value\":%d.00}", light_lux);
        json_len = strlen(json_buf);
        if (ServerComm_SendSensorDataSilent(SENSOR_ID_LIGHT, json_buf, json_len)) {
            success_count++;
        }
    }
    
    // 读取并发送土壤传感器数据
    if (SoilSensor_ReadData(&soil_moisture, &soil_temp, &ec_value, &soil_ph) == 0) {
        soil_ec = (float)ec_value;
        
        if (soil_moisture > 0) {
            sprintf(json_buf, "{\"value\":%.2f}", soil_moisture);
            json_len = strlen(json_buf);
            if (ServerComm_SendSensorDataSilent(SENSOR_ID_SOIL_MOISTURE, json_buf, json_len)) {
                success_count++;
            }
        }
        
        if (soil_temp > 0) {
            sprintf(json_buf, "{\"value\":%.2f}", soil_temp);
            json_len = strlen(json_buf);
            if (ServerComm_SendSensorDataSilent(SENSOR_ID_SOIL_TEMP, json_buf, json_len)) {
                success_count++;
            }
        }
        
        if (soil_ec > 0) {
            sprintf(json_buf, "{\"value\":%.2f}", soil_ec);
            json_len = strlen(json_buf);
            if (ServerComm_SendSensorDataSilent(SENSOR_ID_SOIL_EC, json_buf, json_len)) {
                success_count++;
            }
        }
        
        if (soil_ph > 0) {
            sprintf(json_buf, "{\"value\":%.2f}", soil_ph);
            json_len = strlen(json_buf);
            if (ServerComm_SendSensorDataSilent(SENSOR_ID_SOIL_PH, json_buf, json_len)) {
                success_count++;
            }
        }
    }
    
    // 只在失败时打印日志
    if (success_count == 0) {
        printf("[Sensor] 后台上传失败\r\n");
    }
    
    return success_count;
}

/**
 * @brief 使用透传模式上传所有传感器数据（旧版本，每次断开连接）
 * @return 成功上传的传感器数量
 */
uint8_t ServerComm_UploadAllSensors_Transparent(void)
{
    uint8_t success_count = 0;
    uint8_t dht_temp, dht_humi;
    uint16_t light_lux;
    float soil_moisture, soil_temp, soil_ec, soil_ph;
    uint16_t ec_value;
    char json_buf[32];
    uint8_t json_len;
    
    printf("\r\n[DEBUG] ServerComm_UploadAllSensors_Transparent 开始\r\n");
    
    OLED_ShowString(1, 1, "  Uploading");
    OLED_ShowString(2, 1, "  Sensors...");
    
    printf("[DEBUG] 步骤1: 连接TCP服务器...\r\n");
    if (atk_mb026_connect_tcp_server((char *)SERVER_IP, (char *)SERVER_PORT) != ATK_MB026_EOK) {
        printf("[ERROR] TCP连接失败\r\n");
        return 0;
    }
    printf("[DEBUG] TCP连接成功\r\n");
    
    delay_ms(500);
    
    printf("[DEBUG] 步骤2: 进入透传模式...\r\n");
    if (atk_mb026_enter_unvarnished() != ATK_MB026_EOK) {
        printf("[ERROR] 透传模式失败\r\n");
        atk_mb026_send_at_cmd("AT+CIPCLOSE", "OK", 2000);
        return 0;
    }
    printf("[DEBUG] 透传模式成功\r\n");
    
    delay_ms(500);
    
    printf("[DEBUG] 步骤3: 读取DHT11...\r\n");
    if (DHT11_ReadData() == 0) {
        dht_temp = DHT11_GetTemperature();
        dht_humi = DHT11_GetHumidity();
        printf("[DHT11] T=%dC, H=%d%%\r\n", dht_temp, dht_humi);
        
        printf("[DEBUG] 发送温度数据...\r\n");
        sprintf(json_buf, "{\"value\":%d.00}", dht_temp);
        json_len = strlen(json_buf);
        printf("[DEBUG] JSON: %s (len=%d)\r\n", json_buf, json_len);
        
        atk_mb026_uart_printf_blocking("POST /api/sensors/%s/data HTTP/1.1\r\n", SENSOR_ID_AIR_TEMP);
        delay_ms(5);
        atk_mb026_uart_printf_blocking("Host: %s:%s\r\n", SERVER_IP, SERVER_PORT);
        delay_ms(5);
        atk_mb026_uart_printf_blocking("Content-Type: application/json\r\n");
        delay_ms(5);
        atk_mb026_uart_printf_blocking("Content-Length: %d\r\n", json_len);
        delay_ms(5);
        atk_mb026_uart_printf_blocking("Connection: keep-alive\r\n");
        delay_ms(5);
        atk_mb026_uart_printf_blocking("\r\n");
        delay_ms(5);
        atk_mb026_uart_printf_blocking("%s", json_buf);
        delay_ms(1000);
        
        printf("[DEBUG] 发送湿度数据...\r\n");
        sprintf(json_buf, "{\"value\":%d.00}", dht_humi);
        json_len = strlen(json_buf);
        printf("[DEBUG] JSON: %s (len=%d)\r\n", json_buf, json_len);
        
        atk_mb026_uart_printf_blocking("POST /api/sensors/%s/data HTTP/1.1\r\n", SENSOR_ID_AIR_HUMIDITY);
        delay_ms(5);
        atk_mb026_uart_printf_blocking("Host: %s:%s\r\n", SERVER_IP, SERVER_PORT);
        delay_ms(5);
        atk_mb026_uart_printf_blocking("Content-Type: application/json\r\n");
        delay_ms(5);
        atk_mb026_uart_printf_blocking("Content-Length: %d\r\n", json_len);
        delay_ms(5);
        atk_mb026_uart_printf_blocking("Connection: keep-alive\r\n");
        delay_ms(5);
        atk_mb026_uart_printf_blocking("\r\n");
        delay_ms(5);
        atk_mb026_uart_printf_blocking("%s", json_buf);
        delay_ms(1000);
    } else {
        printf("[ERROR] DHT11读取失败\r\n");
    }
    
    printf("[DEBUG] 步骤4: 读取光照...\r\n");
    light_lux = LightSensor_GetLux();
    printf("[Light] %d Lux\r\n", light_lux);
    
    sprintf(json_buf, "{\"value\":%d.00}", light_lux);
    json_len = strlen(json_buf);
    printf("[DEBUG] JSON: %s (len=%d)\r\n", json_buf, json_len);
    
    atk_mb026_uart_printf_blocking("POST /api/sensors/%s/data HTTP/1.1\r\n", SENSOR_ID_LIGHT);
    delay_ms(5);
    atk_mb026_uart_printf_blocking("Host: %s:%s\r\n", SERVER_IP, SERVER_PORT);
    delay_ms(5);
    atk_mb026_uart_printf_blocking("Content-Type: application/json\r\n");
    delay_ms(5);
    atk_mb026_uart_printf_blocking("Content-Length: %d\r\n", json_len);
    delay_ms(5);
    atk_mb026_uart_printf_blocking("Connection: keep-alive\r\n");
    delay_ms(5);
    atk_mb026_uart_printf_blocking("\r\n");
    delay_ms(5);
    atk_mb026_uart_printf_blocking("%s", json_buf);
    delay_ms(1000);
    
    printf("[DEBUG] 步骤5: 读取土壤传感器...\r\n");
    if (SoilSensor_ReadData(&soil_moisture, &soil_temp, &ec_value, &soil_ph) == 0) {
        soil_ec = (float)ec_value;
        printf("[Soil] M=%.1f%%, T=%.1fC, EC=%.0f, pH=%.1f\r\n", 
               soil_moisture, soil_temp, soil_ec, soil_ph);
        
        printf("[DEBUG] 发送土壤含水率...\r\n");
        sprintf(json_buf, "{\"value\":%.2f}", soil_moisture);
        json_len = strlen(json_buf);
        printf("[DEBUG] JSON: %s (len=%d)\r\n", json_buf, json_len);
        
        atk_mb026_uart_printf_blocking("POST /api/sensors/%s/data HTTP/1.1\r\n", SENSOR_ID_SOIL_MOISTURE);
        delay_ms(5);
        atk_mb026_uart_printf_blocking("Host: %s:%s\r\n", SERVER_IP, SERVER_PORT);
        delay_ms(5);
        atk_mb026_uart_printf_blocking("Content-Type: application/json\r\n");
        delay_ms(5);
        atk_mb026_uart_printf_blocking("Content-Length: %d\r\n", json_len);
        delay_ms(5);
        atk_mb026_uart_printf_blocking("Connection: keep-alive\r\n");
        delay_ms(5);
        atk_mb026_uart_printf_blocking("\r\n");
        delay_ms(5);
        atk_mb026_uart_printf_blocking("%s", json_buf);
        delay_ms(1000);
        
        printf("[DEBUG] 发送土壤温度...\r\n");
        sprintf(json_buf, "{\"value\":%.2f}", soil_temp);
        json_len = strlen(json_buf);
        printf("[DEBUG] JSON: %s (len=%d)\r\n", json_buf, json_len);
        
        atk_mb026_uart_printf_blocking("POST /api/sensors/%s/data HTTP/1.1\r\n", SENSOR_ID_SOIL_TEMP);
        delay_ms(5);
        atk_mb026_uart_printf_blocking("Host: %s:%s\r\n", SERVER_IP, SERVER_PORT);
        delay_ms(5);
        atk_mb026_uart_printf_blocking("Content-Type: application/json\r\n");
        delay_ms(5);
        atk_mb026_uart_printf_blocking("Content-Length: %d\r\n", json_len);
        delay_ms(5);
        atk_mb026_uart_printf_blocking("Connection: keep-alive\r\n");
        delay_ms(5);
        atk_mb026_uart_printf_blocking("\r\n");
        delay_ms(5);
        atk_mb026_uart_printf_blocking("%s", json_buf);
        delay_ms(1000);
        
        printf("[DEBUG] 发送土壤EC...\r\n");
        sprintf(json_buf, "{\"value\":%.2f}", soil_ec);
        json_len = strlen(json_buf);
        printf("[DEBUG] JSON: %s (len=%d)\r\n", json_buf, json_len);
        
        atk_mb026_uart_printf_blocking("POST /api/sensors/%s/data HTTP/1.1\r\n", SENSOR_ID_SOIL_EC);
        delay_ms(5);
        atk_mb026_uart_printf_blocking("Host: %s:%s\r\n", SERVER_IP, SERVER_PORT);
        delay_ms(5);
        atk_mb026_uart_printf_blocking("Content-Type: application/json\r\n");
        delay_ms(5);
        atk_mb026_uart_printf_blocking("Content-Length: %d\r\n", json_len);
        delay_ms(5);
        atk_mb026_uart_printf_blocking("Connection: keep-alive\r\n");
        delay_ms(5);
        atk_mb026_uart_printf_blocking("\r\n");
        delay_ms(5);
        atk_mb026_uart_printf_blocking("%s", json_buf);
        delay_ms(1000);
        
        printf("[DEBUG] 发送土壤pH...\r\n");
        sprintf(json_buf, "{\"value\":%.2f}", soil_ph);
        json_len = strlen(json_buf);
        printf("[DEBUG] JSON: %s (len=%d)\r\n", json_buf, json_len);
        
        atk_mb026_uart_printf_blocking("POST /api/sensors/%s/data HTTP/1.1\r\n", SENSOR_ID_SOIL_PH);
        delay_ms(5);
        atk_mb026_uart_printf_blocking("Host: %s:%s\r\n", SERVER_IP, SERVER_PORT);
        delay_ms(5);
        atk_mb026_uart_printf_blocking("Content-Type: application/json\r\n");
        delay_ms(5);
        atk_mb026_uart_printf_blocking("Content-Length: %d\r\n", json_len);
        delay_ms(5);
        atk_mb026_uart_printf_blocking("Connection: close\r\n");
        delay_ms(5);
        atk_mb026_uart_printf_blocking("\r\n");
        delay_ms(5);
        atk_mb026_uart_printf_blocking("%s", json_buf);
    } else {
        printf("[ERROR] 土壤传感器读取失败\r\n");
    }
    
    printf("[DEBUG] 步骤6: 退出透传模式...\r\n");
    delay_ms(500);
    atk_mb026_exit_unvarnished();
    delay_ms(1000);
    
    printf("[DEBUG] 步骤7: 关闭TCP连接...\r\n");
    atk_mb026_send_at_cmd("AT+CIPCLOSE", "OK", 2000);
    
    printf("[DEBUG] 上传完成!\r\n");
    
    OLED_ShowString(1, 1, "  Upload Done");
    OLED_ShowString(2, 1, "  Success!");
    
    return success_count;
}

/**
 * @brief 上传执行器状态到服务器
 * @param actuator_id 执行器ID
 * @param state 执行器状态 (0:关闭, 1:开启)
 * @param mode 执行器模式 (0:自动, 1:手动)
 * @return 0:成功 1:未连接 2:发送失败
 */
uint8_t ServerComm_UploadActuatorStatus(const char *actuator_id, uint8_t state, uint8_t mode)
{
    char json_buf[64];
    uint8_t json_len;
    
    PRINT_INFO(PRINT_MODULE_ACTUATOR, "上传执行器状态: 执行器=%s, 状态=%s, 模式=%s\r\n", 
              actuator_id, state ? "on" : "off", mode ? "manual" : "auto");
    
    sprintf(json_buf, "{\"state\":\"%s\",\"mode\":\"%s\"}", 
            state ? "on" : "off", 
            mode ? "manual" : "auto");
    json_len = strlen(json_buf);
    
    PRINT_INFO(PRINT_MODULE_ACTUATOR, "JSON数据: %s (长度: %d)\r\n", json_buf, json_len);
    
    // 创建网络请求
    NetworkRequest_t request;
    request.type = REQ_TYPE_ACTUATOR_STATUS;
    request.priority = REQ_PRIORITY_NORMAL;
    strncpy(request.data.actuator_status.actuator_id, actuator_id, sizeof(request.data.actuator_status.actuator_id) - 1);
    request.data.actuator_status.state = state;
    request.data.actuator_status.mode = mode;
    
    // 添加到队列
    if (NetworkQueue_Enqueue(&g_network_queue, &request) != SERVER_COMM_OK) {
        PRINT_ERROR(PRINT_MODULE_ACTUATOR, "无法添加执行器状态上传请求到队列\r\n");
        return 1;
    }
    
    PRINT_INFO(PRINT_MODULE_ACTUATOR, "执行器状态上传请求已添加到队列\r\n");
    return 0;
}

/**
 * @brief 查询并执行服务器下发的控制指令（带重试机制）
 * @param actuator_id 执行器ID
 * @param command_id 返回指令ID（指针）
 * @param command 返回指令内容（指针，需预分配空间）
 * @return 0:无指令 1:有指令 2:查询失败
 */
uint8_t ServerComm_CheckAndExecuteCommand(const char *actuator_id, int *command_id, char *command)
{
    uint8_t *response;
    uint16_t timeout;
    uint8_t got_command = 0;
    
    if (command_id == NULL || command == NULL) {
        return 2;
    }
    
    *command_id = 0;
    command[0] = '\0';
    
    if (ServerComm_EnsureConnection() != 0) {
        return 2;
    }
    
    atk_mb026_uart_rx_restart();
    delay_ms(50);
    atk_mb026_uart_rx_restart();
    delay_ms(20);
    
    atk_mb026_uart_printf_blocking("GET /api/actuators/%s/commands HTTP/1.1\r\n", actuator_id);
    delay_ms(5);
    atk_mb026_uart_printf_blocking("Host: %s:%s\r\n", SERVER_IP, SERVER_PORT);
    delay_ms(5);
    atk_mb026_uart_printf_blocking("Connection: keep-alive\r\n");
    delay_ms(5);
    atk_mb026_uart_printf_blocking("\r\n");
    
    // 等待服务器处理请求
    delay_ms(200);
    
    static char response_buffer[2048] = {0};
    uint16_t buffer_index = 0;
    
    timeout = 3000;
    while (timeout > 0) {
        response = atk_mb026_uart_rx_get_frame();
        if (response != NULL) {
            uint16_t frame_len = strlen((char *)response);
            
            if (buffer_index + frame_len < sizeof(response_buffer) - 1) {
                strcpy(&response_buffer[buffer_index], (const char *)response);
                buffer_index += frame_len;
                response_buffer[buffer_index] = '\0';
            }
        }
        
        if (strstr(response_buffer, "\r\n\r\n") != NULL) {
            break;
        }
        
        timeout--;
        delay_ms(2);
    }
    
    if (strlen(response_buffer) > 0) {
        if (strstr(response_buffer, "HTTP/1.1 200") != NULL) {
            char *data_ptr = strstr(response_buffer, "\"data\":");
            if (data_ptr != NULL) {
                if (strstr(data_ptr, "null") != NULL) {
                    memset(response_buffer, 0, sizeof(response_buffer));
                    atk_mb026_uart_rx_restart();
                    return 0;
                }
                
                char *id_ptr = strstr(data_ptr, "\"id\":");
                char *cmd_ptr = strstr(data_ptr, "\"command\":");
                
                if (id_ptr != NULL && cmd_ptr != NULL) {
                    sscanf(id_ptr, "\"id\":%d", command_id);
                    
                    char cmd_buf[16] = {0};
                    char *cmd_start = strstr(cmd_ptr, "\"command\":\"");
                    if (cmd_start != NULL) {
                        cmd_start += strlen("\"command\":\"");
                        char *cmd_end = strstr(cmd_start, "\"");
                        if (cmd_end != NULL) {
                            uint8_t cmd_len = cmd_end - cmd_start;
                            if (cmd_len < sizeof(cmd_buf)) {
                                strncpy(cmd_buf, cmd_start, cmd_len);
                                cmd_buf[cmd_len] = '\0';
                                
                                if (strcmp(cmd_buf, "on") == 0) {
                                    strcpy(command, "ON");
                                } else if (strcmp(cmd_buf, "off") == 0) {
                                    strcpy(command, "OFF");
                                } else {
                                    strncpy(command, cmd_buf, 15);
                                    command[15] = '\0';
                                }
                                
                                got_command = 1;
                            }
                        }
                    }
                }
            }
        }
        else if (strstr(response_buffer, "HTTP/1.1 404") != NULL) {
            memset(response_buffer, 0, sizeof(response_buffer));
            atk_mb026_uart_rx_restart();
            return 0;
        }
        else if (strstr(response_buffer, "HTTP/1.1 500") != NULL) {
            memset(response_buffer, 0, sizeof(response_buffer));
            atk_mb026_uart_rx_restart();
            return 0;
        }
    }
    
    memset(response_buffer, 0, sizeof(response_buffer));
    atk_mb026_uart_rx_restart();
    
    if (got_command) {
        // 使用命令管理器处理命令
        command_manager_handle_command(actuator_id, command, *command_id);
        return 1;
    }
    
    return 0;
}

/**
 * @brief 确认指令执行结果（带重试机制）
 * @param actuator_id 执行器ID
 * @param command_id 指令ID
 * @param status 执行状态 ("executed" 或 "failed")
 * @return 0:成功 1:失败
 */
uint8_t ServerComm_ConfirmCommand(const char *actuator_id, int command_id, const char *status)
{
    char json_buf[64];
    uint8_t json_len;
    uint8_t *response;
    uint16_t timeout;
    uint8_t success = 0;
    
    sprintf(json_buf, "{\"command_id\":%d,\"status\":\"%s\"}", command_id, status);
    json_len = strlen(json_buf);
    
    if (ServerComm_EnsureConnection() != 0) {
        return 1;
    }
    
    atk_mb026_uart_rx_restart();
    delay_ms(50);
    atk_mb026_uart_rx_restart();
    delay_ms(20);
    
    atk_mb026_uart_printf_blocking("PATCH /api/actuators/%s/commands HTTP/1.1\r\n", actuator_id);
    delay_ms(5);
    atk_mb026_uart_printf_blocking("Host: %s:%s\r\n", SERVER_IP, SERVER_PORT);
    delay_ms(5);
    atk_mb026_uart_printf_blocking("Content-Type: application/json\r\n");
    delay_ms(5);
    atk_mb026_uart_printf_blocking("Content-Length: %d\r\n", json_len);
    delay_ms(5);
    atk_mb026_uart_printf_blocking("Connection: keep-alive\r\n");
    delay_ms(5);
    atk_mb026_uart_printf_blocking("\r\n");
    delay_ms(5);
    atk_mb026_uart_printf_blocking("%s", json_buf);
    
    static char response_buffer[2048] = {0};
    uint16_t buffer_index = 0;
    
    timeout = 3000;
    while (timeout > 0) {
        response = atk_mb026_uart_rx_get_frame();
        if (response != NULL) {
            uint16_t frame_len = strlen((char *)response);
            
            if (buffer_index + frame_len < sizeof(response_buffer) - 1) {
                strcpy(&response_buffer[buffer_index], (char *)response);
                buffer_index += frame_len;
                response_buffer[buffer_index] = '\0';
            }
        }
        
        if (strstr(response_buffer, "\r\n\r\n") != NULL) {
            if (strstr(response_buffer, "HTTP/1.1 200") != NULL) {
                success = 1;
            }
            break;
        }
        
        timeout--;
        delay_ms(1);
    }
    
    memset(response_buffer, 0, sizeof(response_buffer));
    atk_mb026_uart_rx_restart();
    
    return success ? 0 : 1;
}

/**
 * @brief 处理WiFi模块接收到的数据
 * @note 从WiFi模块读取数据并解析指令
 */
void ServerComm_ProcessWiFiData(void)
{
    static char wifi_buffer[2048] = {0};
    static uint16_t buffer_index = 0;
    uint8_t *response;
    
    response = atk_mb026_uart_rx_get_frame();
    if (response != NULL) {
        uint16_t response_len = strlen((char *)response);
        
        for (uint16_t i = 0; i < response_len; i++) {
            if (buffer_index < sizeof(wifi_buffer) - 1) {
                wifi_buffer[buffer_index++] = response[i];
                wifi_buffer[buffer_index] = '\0';
            }
        }
        
        if (strstr(wifi_buffer, "\r\n\r\n") != NULL) {
            if (buffer_index > 0) {
                char *cmd_ptr = strstr(wifi_buffer, "CMD:");
                if (cmd_ptr != NULL) {
                    PRINT_INFO(PRINT_MODULE_WIFI, "接收到格式1控制指令\r\n");
                    
                    char *actuator_id = strstr(cmd_ptr, "ACTUATOR:");
                    char *command = strstr(cmd_ptr, "ACTION:");
                    
                    if (actuator_id != NULL && command != NULL) {
                        char actuator_id_buf[16] = {0};
                        sscanf(actuator_id, "ACTUATOR:%s", actuator_id_buf);
                        
                        char command_buf[16] = {0};
                        sscanf(command, "ACTION:%s", command_buf);
                        
                        PRINT_INFO(PRINT_MODULE_ACTUATOR, "添加指令到队列: 执行器=%s, 指令=%s\r\n", actuator_id_buf, command_buf);
                        ServerComm_AddToCommandQueue(actuator_id_buf, command_buf);
                    }
                }
                else if (strstr(wifi_buffer, "\"command\":") != NULL && strstr(wifi_buffer, "\"success\":true") != NULL) {
                    PRINT_INFO(PRINT_MODULE_WIFI, "接收到格式2控制指令\r\n");
                    
                    char *data_ptr = strstr(wifi_buffer, "\"data\":");
                    if (data_ptr != NULL && strstr(data_ptr, "null") == NULL) {
                        char *actuator_id_ptr = strstr(data_ptr, "\"actuator_id\":\"");
                        char actuator_id_buf[16] = {0};
                        if (actuator_id_ptr != NULL) {
                            actuator_id_ptr += strlen("\"actuator_id\":\"");
                            char *actuator_id_end = strstr(actuator_id_ptr, "\"");
                            if (actuator_id_end != NULL) {
                                uint8_t id_len = actuator_id_end - actuator_id_ptr;
                                if (id_len < sizeof(actuator_id_buf)) {
                                    strncpy(actuator_id_buf, actuator_id_ptr, id_len);
                                    actuator_id_buf[id_len] = '\0';
                                }
                            }
                        }
                        
                        char *cmd_ptr_json = strstr(data_ptr, "\"command\":\"");
                        char command_buf[16] = {0};
                        if (cmd_ptr_json != NULL) {
                            cmd_ptr_json += strlen("\"command\":\"");
                            char *cmd_end = strstr(cmd_ptr_json, "\"");
                            if (cmd_end != NULL) {
                                uint8_t cmd_len = cmd_end - cmd_ptr_json;
                                if (cmd_len < sizeof(command_buf)) {
                                    strncpy(command_buf, cmd_ptr_json, cmd_len);
                                    command_buf[cmd_len] = '\0';
                                    
                                    if (strcmp(command_buf, "on") == 0) {
                                        strcpy(command_buf, "ON");
                                    } else if (strcmp(command_buf, "off") == 0) {
                                        strcpy(command_buf, "OFF");
                                    }
                                }
                            }
                        }
                        
                        if (strlen(actuator_id_buf) > 0 && strlen(command_buf) > 0) {
                            PRINT_INFO(PRINT_MODULE_ACTUATOR, "添加指令到队列: 执行器=%s, 指令=%s\r\n", actuator_id_buf, command_buf);
                            ServerComm_AddToCommandQueue(actuator_id_buf, command_buf);
                        }
                    }
                }
                
                memset(wifi_buffer, 0, sizeof(wifi_buffer));
                buffer_index = 0;
            }
        }
        
        atk_mb026_uart_rx_restart();
    }
}

/**
 * @brief 执行服务器下发的指令
 * @param actuator_id 执行器ID
 * @param command 指令内容
 * @return 0:成功 1:失败
 */
uint8_t ServerComm_ExecuteCommand(const char *actuator_id, const char *command)
{
    if (actuator_id == NULL || command == NULL) {
        PRINT_ERROR(PRINT_MODULE_ACTUATOR, "参数错误\r\n");
        return 1;
    }
    
    // 处理风扇指令
    if (strcmp(actuator_id, ACTUATOR_ID_FAN) == 0) {
        if (strcmp(command, "ON") == 0) {
            PRINT_INFO(PRINT_MODULE_ACTUATOR, "打开风扇\r\n");
            RELAY_1(1); // 打开继电器1（风扇）
            // 上传执行器状态
            ServerComm_UploadActuatorStatus(ACTUATOR_ID_FAN, 1, 1); // 1:手动模式
            // 更新状态管理器中的执行器状态
            state_manager_update_actuator_state(ACTUATOR_ID_FAN, 1, 1);
            return 0;
        } else if (strcmp(command, "OFF") == 0) {
            PRINT_INFO(PRINT_MODULE_ACTUATOR, "关闭风扇\r\n");
            RELAY_1(0); // 关闭继电器1（风扇）
            // 上传执行器状态
            ServerComm_UploadActuatorStatus(ACTUATOR_ID_FAN, 0, 1); // 1:手动模式
            // 更新状态管理器中的执行器状态
            state_manager_update_actuator_state(ACTUATOR_ID_FAN, 0, 1);
            return 0;
        }
    }
    
    // 处理水泵指令
    if (strcmp(actuator_id, ACTUATOR_ID_PUMP) == 0) {
        if (strcmp(command, "ON") == 0) {
            PRINT_INFO(PRINT_MODULE_ACTUATOR, "打开水泵\r\n");
            RELAY_2(1); // 打开继电器2（水泵）
            // 上传执行器状态
            ServerComm_UploadActuatorStatus(ACTUATOR_ID_PUMP, 1, 1); // 1:手动模式
            // 更新状态管理器中的执行器状态
            state_manager_update_actuator_state(ACTUATOR_ID_PUMP, 1, 1);
            return 0;
        } else if (strcmp(command, "OFF") == 0) {
            PRINT_INFO(PRINT_MODULE_ACTUATOR, "关闭水泵\r\n");
            RELAY_2(0); // 关闭继电器2（水泵）
            // 上传执行器状态
            ServerComm_UploadActuatorStatus(ACTUATOR_ID_PUMP, 0, 1); // 1:手动模式
            // 更新状态管理器中的执行器状态
            state_manager_update_actuator_state(ACTUATOR_ID_PUMP, 0, 1);
            return 0;
        }
    }
    
    PRINT_WARNING(PRINT_MODULE_ACTUATOR, "未知指令: 执行器=%s, 指令=%s\r\n", actuator_id, command);
    return 1;
}

// ==================== 队列处理函数实现 ====================

/**
 * @brief 处理单个网络请求
 * @param request 请求指针
 * @return 0:成功 1:失败
 * @note 根据请求类型调用相应的处理函数
 */
static uint8_t ServerComm_ProcessRequest(NetworkRequest_t *request)
{
    uint8_t result = SERVER_COMM_OK;
    
    switch (request->type) {
        case REQ_TYPE_SENSOR_DATA: {
            // 处理传感器数据上传
            // 直接使用已建立的长连接发送数据，而不是重新建立连接
            char json_buf[32];
            uint8_t json_len;
            sprintf(json_buf, "{\"value\":%.2f}", request->data.sensor_data.value);
            json_len = strlen(json_buf);
            
            // 发送HTTP请求
            atk_mb026_uart_printf_blocking("POST /api/sensors/%s/data HTTP/1.1\r\n", request->data.sensor_data.sensor_id);
            atk_mb026_uart_printf_blocking("Host: %s:%s\r\n", SERVER_IP, SERVER_PORT);
            atk_mb026_uart_printf_blocking("Content-Type: application/json\r\n");
            atk_mb026_uart_printf_blocking("Content-Length: %d\r\n", json_len);
            atk_mb026_uart_printf_blocking("Connection: keep-alive\r\n");
            atk_mb026_uart_printf_blocking("\r\n");
            atk_mb026_uart_printf_blocking("%s", json_buf);
            
            result = SERVER_COMM_OK;
            break;
        }
            
        case REQ_TYPE_ACTUATOR_STATUS:
            // 处理执行器状态上传
            // 构造JSON数据
            char json_buf[64];
            uint8_t json_len;
            sprintf(json_buf, "{\"state\":\"%s\",\"mode\":\"%s\"}", 
                    request->data.actuator_status.state ? "on" : "off", 
                    request->data.actuator_status.mode ? "manual" : "auto");
            json_len = strlen(json_buf);
            
            // 清空接收缓冲区
            atk_mb026_uart_rx_restart();
            delay_ms(10);
            
            // 发送HTTP请求
            atk_mb026_uart_printf_blocking("POST /api/actuators/%s HTTP/1.1\r\n", request->data.actuator_status.actuator_id);
            delay_ms(5);
            atk_mb026_uart_printf_blocking("Host: %s:%s\r\n", SERVER_IP, SERVER_PORT);
            delay_ms(5);
            atk_mb026_uart_printf_blocking("Content-Type: application/json\r\n");
            delay_ms(5);
            atk_mb026_uart_printf_blocking("Content-Length: %d\r\n", json_len);
            delay_ms(5);
            atk_mb026_uart_printf_blocking("Connection: keep-alive\r\n");
            delay_ms(5);
            atk_mb026_uart_printf_blocking("\r\n");
            delay_ms(5);
            atk_mb026_uart_printf_blocking("%s", json_buf);
            
            delay_ms(500);
            
            uint16_t timeout = 3000;
            uint8_t *response;
            uint8_t got_response = 0;
            
            while (timeout > 0 && !got_response) {
                response = atk_mb026_uart_rx_get_frame();
                if (response != NULL) {
                    if (strstr((const char *)response, "HTTP/1.1 200") != NULL) {
                        PRINT_INFO(PRINT_MODULE_SERVER, "服务器响应: 200 OK\r\n");
                        got_response = 1;
                    } else if (strstr((const char *)response, "HTTP/1.1 4") != NULL ||
                               strstr((const char *)response, "HTTP/1.1 5") != NULL) {
                        PRINT_ERROR(PRINT_MODULE_SERVER, "服务器响应错误\r\n");
                        got_response = 1;
                    }
                    
                    if (strstr((const char *)response, "\"action\":\"force_sync\"") != NULL) {
                        PRINT_INFO(PRINT_MODULE_SERVER, "收到强制同步指令\r\n");
                        
                        char *server_state_ptr = strstr((const char *)response, "\"server_state\":\"");
                        char *server_mode_ptr = strstr((const char *)response, "\"server_mode\":\"");
                        
                        if (server_state_ptr != NULL && server_mode_ptr != NULL) {
                            server_state_ptr += strlen("\"server_state\":\"");
                            char *state_end = strstr(server_state_ptr, "\"");
                            char server_state[10] = {0};
                            if (state_end != NULL) {
                                strncpy(server_state, server_state_ptr, state_end - server_state_ptr);
                                server_state[state_end - server_state_ptr] = '\0';
                            }
                            
                            server_mode_ptr += strlen("\"server_mode\":\"");
                            char *mode_end = strstr(server_mode_ptr, "\"");
                            char server_mode[10] = {0};
                            if (mode_end != NULL) {
                                strncpy(server_mode, server_mode_ptr, mode_end - server_mode_ptr);
                                server_mode[mode_end - server_mode_ptr] = '\0';
                            }
                            
                            uint8_t new_state = strcmp(server_state, "on") == 0 ? 1 : 0;
                            uint8_t new_mode = strcmp(server_mode, "manual") == 0 ? 1 : 0;
                            
                            if (strcmp(request->data.actuator_status.actuator_id, ACTUATOR_ID_FAN) == 0) {
                                RELAY_1(new_state);
                            } else if (strcmp(request->data.actuator_status.actuator_id, ACTUATOR_ID_PUMP) == 0) {
                                RELAY_2(new_state);
                            }
                            
                            delay_ms(100);
                            ServerComm_UploadActuatorStatus(
                                request->data.actuator_status.actuator_id,
                                new_state, new_mode);
                        }
                    }
                    
                    atk_mb026_uart_rx_restart();
                    break;
                }
                timeout--;
                delay_ms(1);
            }
            
            result = SERVER_COMM_OK;
            break;
            
        case REQ_TYPE_COMMAND_QUERY:
            // 处理指令查询
            printf("[Queue] 处理指令查询: %s\r\n", 
                   request->data.command_query.actuator_id);
            result = ServerComm_CheckAndExecuteCommand(
                request->data.command_query.actuator_id,
                request->data.command_query.command_id_ptr,
                request->data.command_query.command_ptr);
            break;
            
        case REQ_TYPE_COMMAND_CONFIRM:
            // 处理指令确认
            printf("[Queue] 处理指令确认: %s, ID: %d\r\n", 
                   request->data.command_confirm.actuator_id,
                   request->data.command_confirm.command_id);
            result = ServerComm_ConfirmCommand(
                request->data.command_confirm.actuator_id,
                request->data.command_confirm.command_id,
                request->data.command_confirm.status);
            break;
            
        case REQ_TYPE_HEARTBEAT:
            // 处理心跳保活
            printf("[Queue] 处理心跳请求\r\n");
            // 心跳请求可以发送简单的HTTP请求或空数据
            // 这里暂时不做处理
            break;
            
        default:
            printf("[Queue] 未知请求类型: %d\r\n", request->type);
            result = SERVER_COMM_ERROR_INVALID_PARAM;
            break;
    }
    
    return result;
}

/**
 * @brief 处理队列中的所有请求
 * @note 从队列中依次取出请求并处理，直到队列为空
 */
void ServerComm_ProcessQueue(void)
{
    NetworkRequest_t request;
    uint8_t process_count = 0;
    
    // 循环处理队列中的所有请求
    while (!NetworkQueue_IsEmpty(&g_network_queue)) {
        // 从队列中取出请求
        if (NetworkQueue_Dequeue(&g_network_queue, &request) != SERVER_COMM_OK) {
            break;
        }
        
        // 处理请求
        uint8_t result = ServerComm_ProcessRequest(&request);
        
        if (result != SERVER_COMM_OK) {
            // 如果未达到最大重试次数，重新加入队列
            if (request.retry_count < MAX_RETRY_COUNT) {
                request.retry_count++;
                NetworkQueue_Enqueue(&g_network_queue, &request);
            }
        }
        
        process_count++;
        
        // 避免一次处理太多请求，影响其他任务
        if (process_count >= 5) {
            break;
        }
    }
}

/**
 * @brief 批量处理队列中的请求
 * @param max_count 最大处理数量
 * @return 实际处理的请求数量
 * @note 一次最多处理max_count个请求，避免长时间占用CPU
 */
uint8_t ServerComm_ProcessBatch(uint8_t max_count)
{
    NetworkRequest_t request;
    uint8_t process_count = 0;
    uint16_t queue_count = NetworkQueue_GetCount(&g_network_queue);
    
    // 时间统计变量
    uint32_t start_cycles, end_cycles, total_cycles;
    uint32_t request_start, request_end;
    uint32_t total_ms;
    
    // 如果队列为空，直接返回
    if (queue_count == 0) {
        return 0;
    }
    
    // 记录开始时间
    start_cycles = DWT_GetCycles();
    
    printf("\r\n[Queue] ========== 批量处理队列 ==========\r\n");
    printf("[Queue] 最大处理数量: %d, 队列中的请求数量: %d\r\n", 
           max_count, queue_count);
    
    // 循环处理队列中的请求，最多处理max_count个
    while (process_count < max_count && !NetworkQueue_IsEmpty(&g_network_queue)) {
        // 从队列中取出请求
        if (NetworkQueue_Dequeue(&g_network_queue, &request) != SERVER_COMM_OK) {
            printf("[Queue] 取出请求失败\r\n");
            break;
        }
        
        // 记录单个请求开始时间
        request_start = DWT_GetCycles();
        
        // 处理请求
        uint8_t result = ServerComm_ProcessRequest(&request);
        
        // 记录单个请求结束时间
        request_end = DWT_GetCycles();
        
        // 计算单个请求耗时
        uint32_t request_cycles = request_end - request_start;
        uint32_t request_ms = CyclesToMs(request_cycles);
        
        if (result == SERVER_COMM_OK) {
            printf("[Queue] 请求#%d 处理成功, 耗时: %lu ms\r\n", process_count + 1, request_ms);
        } else {
            printf("[Queue] 请求#%d 处理失败(错误:%d), 耗时: %lu ms\r\n", 
                   process_count + 1, result, request_ms);
            
            // 如果未达到最大重试次数，重新加入队列
            if (request.retry_count < MAX_RETRY_COUNT) {
                request.retry_count++;
                printf("[Queue] 重新加入队列，重试次数: %d\r\n", request.retry_count);
                NetworkQueue_Enqueue(&g_network_queue, &request);
            } else {
                printf("[Queue] 已达到最大重试次数，放弃请求\r\n");
            }
        }
        
        process_count++;
    }
    
    // 记录结束时间
    end_cycles = DWT_GetCycles();
    
    // 计算总耗时
    total_cycles = end_cycles - start_cycles;
    total_ms = CyclesToMs(total_cycles);
    
    printf("[Queue] ========== 批量处理完成 ==========\r\n");
    printf("[Queue] 实际处理的请求数量: %d, 剩余: %d\r\n", 
           process_count, NetworkQueue_GetCount(&g_network_queue));
    printf("[Queue] 总耗时: %lu ms, 平均每个请求: %lu ms\r\n\r\n", 
           total_ms, process_count > 0 ? total_ms / process_count : 0);
    
    return process_count;
}

/**
 * @brief 上传单个传感器数据（队列方式）
 * @param sensor_id 传感器ID
 * @param value 传感器值
 * @return 0:成功 1:失败
 * @note 将传感器数据请求添加到队列中
 */
uint8_t ServerComm_UploadSensorData(const char *sensor_id, float value)
{
    NetworkRequest_t request;
    
    // 构造传感器数据请求
    request.type = REQ_TYPE_SENSOR_DATA;
    request.priority = REQ_PRIORITY_NORMAL;
    request.timestamp = g_system_time;
    request.retry_count = 0;
    strcpy(request.data.sensor_data.sensor_id, sensor_id);
    request.data.sensor_data.value = value;
    
    // 添加到队列
    uint8_t result = NetworkQueue_Enqueue(&g_network_queue, &request);
    
    if (result == SERVER_COMM_OK) {
        printf("[ServerComm] 传感器数据已加入队列: %s = %.2f\r\n", sensor_id, value);
    }
    
    return result;
}

/**
 * @brief 上传所有传感器数据（队列方式）
 * @return 0:成功 1:失败
 * @note 将所有传感器数据请求批量添加到队列中
 */
uint8_t ServerComm_UploadAllSensors(void)
{
    uint8_t dht_temp, dht_humi;
    uint16_t light_lux;
    float soil_moisture, soil_temp, soil_ec, soil_ph;
    uint16_t ec_value;
    uint8_t success_count = 0;
    
    printf("\r\n[ServerComm] ========== 批量上传传感器数据 ==========\r\n");
    
    // 读取DHT11数据
    if (DHT11_ReadData() == 0) {
        dht_temp = DHT11_GetTemperature();
        dht_humi = DHT11_GetHumidity();
        printf("[DHT11] T=%dC, H=%d%%\r\n", dht_temp, dht_humi);
        
        // 添加温度数据到队列
        if (dht_temp > 0) {
            if (ServerComm_UploadSensorData(SENSOR_ID_AIR_TEMP, (float)dht_temp) == SERVER_COMM_OK) {
                success_count++;
            }
        }
        
        // 添加湿度数据到队列
        if (dht_humi > 0) {
            if (ServerComm_UploadSensorData(SENSOR_ID_AIR_HUMIDITY, (float)dht_humi) == SERVER_COMM_OK) {
                success_count++;
            }
        }
    } else {
        printf("[ERROR] DHT11读取失败\r\n");
    }
    
    // 读取光照数据
    light_lux = LightSensor_GetLux();
    printf("[Light] %d Lux\r\n", light_lux);
    
    // 添加光照数据到队列
    if (light_lux > 0) {
        if (ServerComm_UploadSensorData(SENSOR_ID_LIGHT, (float)light_lux) == SERVER_COMM_OK) {
            success_count++;
        }
    }
    
    // 读取土壤传感器数据
    if (SoilSensor_ReadData(&soil_moisture, &soil_temp, &ec_value, &soil_ph) == 0) {
        soil_ec = (float)ec_value;
        printf("[Soil] M=%.1f%%, T=%.1fC, EC=%.0f, pH=%.1f\r\n", 
               soil_moisture, soil_temp, soil_ec, soil_ph);
        
        // 添加土壤含水率数据到队列
        if (soil_moisture > 0) {
            if (ServerComm_UploadSensorData(SENSOR_ID_SOIL_MOISTURE, soil_moisture) == SERVER_COMM_OK) {
                success_count++;
            }
        }
        
        // 添加土壤温度数据到队列
        if (soil_temp > 0) {
            if (ServerComm_UploadSensorData(SENSOR_ID_SOIL_TEMP, soil_temp) == SERVER_COMM_OK) {
                success_count++;
            }
        }
        
        // 添加土壤EC数据到队列
        if (soil_ec > 0) {
            if (ServerComm_UploadSensorData(SENSOR_ID_SOIL_EC, soil_ec) == SERVER_COMM_OK) {
                success_count++;
            }
        }
        
        // 添加土壤pH数据到队列
        if (soil_ph > 0) {
            if (ServerComm_UploadSensorData(SENSOR_ID_SOIL_PH, soil_ph) == SERVER_COMM_OK) {
                success_count++;
            }
        }
    } else {
        printf("[ERROR] 土壤传感器读取失败\r\n");
    }
    
    printf("[ServerComm] ========== 批量上传完成 ==========\r\n");
    printf("[ServerComm] 成功添加%d个传感器数据到队列\r\n\r\n", success_count);
    
    return (success_count > 0) ? SERVER_COMM_OK : SERVER_COMM_ERROR_SENSOR;
}
