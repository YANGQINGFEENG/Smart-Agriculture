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

static uint8_t g_tcp_connected = 0;
static uint8_t g_transparent_mode = 0;

/**
 * @brief 初始化服务器通信模块
 */
void ServerComm_Init(void)
{
    g_tcp_connected = 0;
    g_transparent_mode = 0;
    
    printf("\r\n========================================\r\n");
    printf("[ServerComm] 初始化服务器通信模块\r\n");
    printf("[ServerComm] 服务器地址: %s:%s\r\n", SERVER_IP, SERVER_PORT);
    printf("[ServerComm] 上传间隔: %d ms\r\n", UPLOAD_INTERVAL_MS);
    printf("[ServerComm] 长连接模式已启用\r\n");
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

/**
 * @brief 上传单个传感器数据到服务器
 * @param sensor_id 传感器ID
 * @param value 传感器值
 * @return 0:成功 1:连接失败 2:发送失败 3:响应异常
 */
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

/**
 * @brief 测试发送固定HTTP请求
 */
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

/**
 * @brief 使用长连接模式发送传感器数据（不断开连接）
 * @return 成功上传的传感器数量
 */
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
 * @brief 上传所有传感器数据
 * @return 成功上传的传感器数量
 */
uint8_t ServerComm_UploadAllSensors(void)
{
    return ServerComm_SendData_KeepAlive();
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
    delay_ms(100);
    atk_mb026_uart_rx_restart();
    delay_ms(50);
    
    printf("[Actuator] 发送HTTP请求...\r\n");
    
    atk_mb026_uart_printf_blocking("PATCH /api/actuators/%s HTTP/1.1\r\n", actuator_id);
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
