#include "ServerComm.h"
#include "atk_mb026.h"
#include "atk_mb026_uart.h"
#include "Delay.h"
#include "dht11.h"
#include "LightSensor.h"
#include "SoilSensor.h"
#include "OLED.h"
#include <string.h>
#include <stdio.h>
#include <stdlib.h>

// ==================== 全局变量定义 ====================

static uint8_t g_tcp_connected = 0;                    // TCP连接状态标志
static uint8_t g_transparent_mode = 0;                 // 透传模式标志
NetworkQueue_t g_network_queue;                         // 网络请求队列（全局变量，供OLED显示使用）
static uint32_t g_system_time = 0;                      // 系统时间计数器

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
    printf("[Queue] 请求已添加，类型: %d, 优先级: %d, 队列数量: %d\r\n", 
           request->type, request->priority, queue->count);
    
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
        printf("[Queue] 队列为空，无法取出请求\r\n");
        return SERVER_COMM_ERROR_QUEUE_EMPTY;
    }
    
    *request = queue->requests[queue->head];
    queue->head = (queue->head + 1) % NETWORK_QUEUE_SIZE;
    queue->count--;
    
    printf("[Queue] 请求已取出，类型: %d, 队列数量: %d\r\n", 
           request->type, queue->count);
    
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

// ==================== 服务器通信模块初始化 ====================

/**
 * @brief 初始化服务器通信模块
 */
void ServerComm_Init(void)
{
    g_tcp_connected = 0;
    g_transparent_mode = 0;
    g_system_time = 0;
    
    // 初始化网络请求队列
    NetworkQueue_Init(&g_network_queue);
    
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
    uint8_t *response;
    uint16_t timeout;
    uint8_t success = 0;
    
    printf("\r\n[Actuator] ========== 上传执行器状态 ==========\r\n");
    printf("[Actuator] 执行器ID: %s\r\n", actuator_id);
    printf("[Actuator] state参数: %d\r\n", state);
    printf("[Actuator] mode参数: %d\r\n", mode);
    
    sprintf(json_buf, "{\"state\":\"%s\",\"mode\":\"%s\"}", 
            state ? "on" : "off", 
            mode ? "manual" : "auto");
    json_len = strlen(json_buf);
    
    printf("[Actuator] JSON数据: %s (长度: %d)\r\n", json_buf, json_len);
    printf("[Actuator] state转换: %d -> \"%s\"\r\n", state, state ? "on" : "off");
    printf("[Actuator] mode转换: %d -> \"%s\"\r\n", mode, mode ? "manual" : "auto");
    printf("[Actuator] =====================================\r\n");
    
    if (ServerComm_EnsureConnection() != 0) {
        printf("[Actuator] 连接不可用，无法上传\r\n");
        return 1;
    }
    
    atk_mb026_uart_rx_restart();
    atk_mb026_uart_rx_restart();
    
    printf("[Actuator] 发送HTTP请求...\r\n");
    
    atk_mb026_uart_printf_blocking("PATCH /api/actuators/%s HTTP/1.1\r\n", actuator_id);
    atk_mb026_uart_printf_blocking("Host: %s:%s\r\n", SERVER_IP, SERVER_PORT);
    atk_mb026_uart_printf_blocking("Content-Type: application/json\r\n");
    atk_mb026_uart_printf_blocking("Content-Length: %d\r\n", json_len);
    atk_mb026_uart_printf_blocking("Connection: keep-alive\r\n");
    atk_mb026_uart_printf_blocking("\r\n");
    atk_mb026_uart_printf_blocking("%s", json_buf);
    
    printf("[Actuator] HTTP请求已发送，等待响应...\r\n");
    
    uint8_t got_200 = 0;
    timeout = 3000;
    while (timeout > 0) {
        response = atk_mb026_uart_rx_get_frame();
        if (response != NULL) {
            if (strstr((const char *)response, "HTTP/1.1 200") != NULL) {
                printf("[Actuator] 服务器响应: HTTP 200 OK\r\n");
                got_200 = 1;
            }
            else if (strstr((const char *)response, "HTTP/1.1 400") != NULL) {
                printf("[Actuator] 收到HTTP 400 (可能是旧响应，继续等待...)\r\n");
            }
            else if (strstr((const char *)response, "HTTP/1.1 404") != NULL) {
                printf("[Actuator] 执行器不存在 (404)\r\n");
                break;
            }
            else if (strstr((const char *)response, "HTTP/1.1 500") != NULL) {
                printf("[Actuator] 服务器内部错误 (500)\r\n");
                break;
            }
            
            if (strstr((const char *)response, "\"success\":true") != NULL ||
                strstr((const char *)response, "\"success\": true") != NULL) {
                printf("[Actuator] 执行器状态更新成功!\r\n");
                success = 1;
                break;
            }
            
            if (got_200 && strstr((const char *)response, "}") != NULL) {
                delay_ms(100);
                response = atk_mb026_uart_rx_get_frame();
                if (response != NULL && 
                    (strstr((const char *)response, "\"success\":true") != NULL ||
                     strstr((const char *)response, "\"success\": true") != NULL)) {
                    printf("[Actuator] 执行器状态更新成功!\r\n");
                    success = 1;
                }
                break;
            }
            
            atk_mb026_uart_rx_restart();
        }
        timeout--;
        delay_ms(1);
    }
    
    if (success) {
        printf("[Actuator] 执行器状态已成功同步到服务器\r\n");
    } else if (got_200) {
        printf("[Actuator] 收到200响应，但未收到确认数据\r\n");
        success = 1;
    } else {
        printf("[Actuator] 执行器状态发送完成（未收到确认）\r\n");
    }
    
    return success ? 0 : 2;
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
    char *cmd_ptr;
    char *id_ptr;
    uint8_t result = 0;
    uint8_t retry_count = 0;
    uint8_t max_retries = 3;  // 最多重试3次
    
    if (command_id == NULL || command == NULL) {
        printf("[Command] 参数错误\r\n");
        return 2;
    }
    
    *command_id = 0;
    command[0] = '\0';
    
    printf("\r\n[Command] ========== 查询控制指令 ==========\r\n");
    printf("[Command] 执行器ID: %s\r\n", actuator_id);
    
    if (ServerComm_EnsureConnection() != 0) {
        printf("[Command] 连接不可用，无法查询指令\r\n");
        return 2;
    }
    
    // 重试循环
    for (retry_count = 0; retry_count < max_retries; retry_count++) {
        if (retry_count > 0) {
            printf("[Command] 第 %d 次重试...\r\n", retry_count + 1);
        }
        
        // 清空接收缓冲区
        atk_mb026_uart_rx_restart();
        delay_ms(50);
        atk_mb026_uart_rx_restart();
        delay_ms(30);
        
        printf("[Command] 发送查询请求...\r\n");
        
        atk_mb026_uart_printf_blocking("GET /api/actuators/%s/commands HTTP/1.1\r\n", actuator_id);
        delay_ms(10);
        atk_mb026_uart_printf_blocking("Host: %s:%s\r\n", SERVER_IP, SERVER_PORT);
        delay_ms(10);
        atk_mb026_uart_printf_blocking("Connection: keep-alive\r\n");
        delay_ms(10);
        atk_mb026_uart_printf_blocking("\r\n");
        
        printf("[Command] 等待服务器响应...\r\n");
        
        delay_ms(300);
        
        uint8_t got_response = 0;
        timeout = 3000;  // 每次等待3秒
        while (timeout > 0) {
            response = atk_mb026_uart_rx_get_frame();
            if (response != NULL) {
                printf("[Command] 收到响应帧 (%d字节)\r\n", strlen((char*)response));
                
                if (strstr((const char *)response, "HTTP/1.1 200") != NULL) {
                    printf("[Command] 收到HTTP 200 OK\r\n");
                    got_response = 1;
                }
                
                if (strstr((const char *)response, "\"data\":null") != NULL ||
                    strstr((const char *)response, "\"data\": null") != NULL) {
                    printf("[Command] 没有待执行的指令\r\n");
                    return 0;
                }
                
                if (strstr((const char *)response, "\"command\"") != NULL) {
                    cmd_ptr = strstr((const char *)response, "\"command\"");
                    if (cmd_ptr != NULL) {
                        char *colon = strchr(cmd_ptr, ':');
                        if (colon != NULL) {
                            char *quote1 = strchr(colon + 1, '"');
                            char *quote2 = quote1 ? strchr(quote1 + 1, '"') : NULL;
                            if (quote1 && quote2 && (quote2 - quote1 - 1) < 8) {
                                strncpy(command, quote1 + 1, quote2 - quote1 - 1);
                                command[quote2 - quote1 - 1] = '\0';
                            }
                        }
                    }
                    
                    id_ptr = strstr((const char *)response, "\"id\"");
                    if (id_ptr != NULL) {
                        char *colon = strchr(id_ptr, ':');
                        if (colon != NULL) {
                            *command_id = atoi(colon + 1);
                        }
                    }
                    
                    printf("[Command] 解析结果: id=%d, command=%s\r\n", *command_id, command);
                    
                    if (strlen(command) > 0 && *command_id > 0) {
                        printf("[Command] 收到指令: id=%d, command=%s\r\n", *command_id, command);
                        result = 1;
                        break;
                    }
                }
                
                atk_mb026_uart_rx_restart();
            }
            
            delay_ms(10);
            timeout -= 10;
        }
        
        if (result == 1) {
            printf("[Command] 指令解析成功\r\n");
            return 1;
        }
        
        if (got_response && result == 0) {
            // 收到响应但没有指令，说明真的没有待执行指令
            printf("[Command] 无待执行指令\r\n");
            return 0;
        }
        
        // 没有收到响应，继续重试
        printf("[Command] 未收到响应，准备重试...\r\n");
        delay_ms(200);  // 重试前等待
    }
    
    printf("[Command] 重试%d次后仍未收到响应\r\n", max_retries);
    return 2;
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
    uint8_t *response;
    uint16_t timeout;
    char json_buf[64];
    uint8_t json_len;
    uint8_t success = 0;
    uint8_t retry_count = 0;
    uint8_t max_retries = 3;  // 最多重试3次
    
    printf("\r\n[Command] ========== 确认指令执行 ==========\r\n");
    printf("[Command] 执行器ID: %s, 指令ID: %d, 状态: %s\r\n", actuator_id, command_id, status);
    
    if (ServerComm_EnsureConnection() != 0) {
        printf("[Command] 连接不可用，无法确认指令\r\n");
        return 1;
    }
    
    sprintf(json_buf, "{\"command_id\":%d,\"status\":\"%s\"}", command_id, status);
    json_len = strlen(json_buf);
    
    printf("[Command] JSON数据: %s\r\n", json_buf);
    
    // 重试循环
    for (retry_count = 0; retry_count < max_retries; retry_count++) {
        if (retry_count > 0) {
            printf("[Command] 第 %d 次重试确认...\r\n", retry_count + 1);
        }
        
        // 清空接收缓冲区
        atk_mb026_uart_rx_restart();
        delay_ms(50);
        atk_mb026_uart_rx_restart();
        delay_ms(30);
        
        printf("[Command] 发送确认请求...\r\n");
        
        atk_mb026_uart_printf_blocking("PATCH /api/actuators/%s/commands HTTP/1.1\r\n", actuator_id);
        delay_ms(10);
        atk_mb026_uart_printf_blocking("Host: %s:%s\r\n", SERVER_IP, SERVER_PORT);
        delay_ms(10);
        atk_mb026_uart_printf_blocking("Content-Type: application/json\r\n");
        delay_ms(10);
        atk_mb026_uart_printf_blocking("Content-Length: %d\r\n", json_len);
        delay_ms(10);
        atk_mb026_uart_printf_blocking("Connection: keep-alive\r\n");
        delay_ms(10);
        atk_mb026_uart_printf_blocking("\r\n");
        delay_ms(10);
        atk_mb026_uart_printf_blocking("%s", json_buf);
        
        printf("[Command] 等待服务器响应...\r\n");
        
        delay_ms(300);
        
        timeout = 3000;  // 每次等待3秒
        while (timeout > 0) {
            response = atk_mb026_uart_rx_get_frame();
            if (response != NULL) {
                printf("[Command] 收到确认响应 (%d字节)\r\n", strlen((char*)response));
                
                if (strstr((const char *)response, "HTTP/1.1 200") != NULL) {
                    printf("[Command] 服务器响应: HTTP 200 OK\r\n");
                }
                
                if (strstr((const char *)response, "\"success\":true") != NULL ||
                    strstr((const char *)response, "\"success\": true") != NULL) {
                    printf("[Command] 指令确认成功!\r\n");
                    success = 1;
                    break;
                }
                
                atk_mb026_uart_rx_restart();
            }
            
            delay_ms(10);
            timeout -= 10;
        }
        
        if (success) {
            printf("[Command] 指令确认完成\r\n");
            return 0;
        }
        
        // 没有收到响应，继续重试
        printf("[Command] 未收到确认响应，准备重试...\r\n");
        delay_ms(200);
    }
    
    printf("[Command] 重试%d次后仍未确认成功\r\n", max_retries);
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
            printf("[Queue] 处理传感器数据: %s = %.2f\r\n", 
                   request->data.sensor_data.sensor_id, 
                   request->data.sensor_data.value);
            // 直接使用已建立的长连接发送数据，而不是重新建立连接
            char json_buf[32];
            uint8_t json_len;
            sprintf(json_buf, "{\"value\":%.2f}", request->data.sensor_data.value);
            json_len = strlen(json_buf);
            
            printf("[DEBUG] 发送传感器数据: %s\r\n", request->data.sensor_data.sensor_id);
            printf("[DEBUG] JSON: %s (len=%d)\r\n", json_buf, json_len);
            
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
            printf("[Queue] 处理执行器状态: %s\r\n", 
                   request->data.actuator_status.actuator_id);
            result = ServerComm_UploadActuatorStatus(
                request->data.actuator_status.actuator_id,
                request->data.actuator_status.state,
                request->data.actuator_status.mode);
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
    
    printf("\r\n[Queue] ========== 开始处理队列 ==========\r\n");
    printf("[Queue] 队列中的请求数量: %d\r\n", NetworkQueue_GetCount(&g_network_queue));
    
    // 循环处理队列中的所有请求
    while (!NetworkQueue_IsEmpty(&g_network_queue)) {
        // 从队列中取出请求
        if (NetworkQueue_Dequeue(&g_network_queue, &request) != SERVER_COMM_OK) {
            printf("[Queue] 取出请求失败\r\n");
            break;
        }
        
        // 处理请求
        uint8_t result = ServerComm_ProcessRequest(&request);
        
        if (result == SERVER_COMM_OK) {
            printf("[Queue] 请求处理成功\r\n");
        } else {
            printf("[Queue] 请求处理失败，错误码: %d\r\n", result);
            
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
        
        // 避免一次处理太多请求，影响其他任务
        if (process_count >= 5) {
            printf("[Queue] 已处理%d个请求，暂停处理\r\n", process_count);
            break;
        }
    }
    
    printf("[Queue] ========== 队列处理完成 ==========\r\n");
    printf("[Queue] 处理的请求数量: %d, 剩余: %d\r\n\r\n", 
           process_count, NetworkQueue_GetCount(&g_network_queue));
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
    
    // 如果队列为空，直接返回
    if (queue_count == 0) {
        return 0;
    }
    
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
        
        // 处理请求
        uint8_t result = ServerComm_ProcessRequest(&request);
        
        if (result == SERVER_COMM_OK) {
            printf("[Queue] 请求处理成功\r\n");
        } else {
            printf("[Queue] 请求处理失败，错误码: %d\r\n", result);
            
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
    
    printf("[Queue] ========== 批量处理完成 ==========\r\n");
    printf("[Queue] 实际处理的请求数量: %d, 剩余: %d\r\n\r\n", 
           process_count, NetworkQueue_GetCount(&g_network_queue));
    
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
