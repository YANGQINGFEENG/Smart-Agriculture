/**
 * @file    OLED_Display.c
 * @brief   OLED显示管理
 * @details 实现智能农业监控系统的OLED显示管理，包括系统状态、传感器数据、执行器状态等信息的显示
 * @author  Smart Agriculture Team
 * @date    2026-04-15
 * @version 1.0.0
 * @note    基于128x64 OLED显示屏，4行16字符显示
 */

#include "stm32f10x.h"
#include "OLED.h"
#include "Delay.h"
#include "dht11.h"
#include "LightSensor.h"
#include "SoilSensor.h"
#include "ServerComm.h"
#include "RELAY/relay.h"
#include <stdio.h>

/* ==================== 全局变量 ==================== */

extern uint32_t timecount;  // 从main.c引用timecount变量
extern uint8_t g_wifi_connected;  // 从main.c引用WiFi连接状态
extern NetworkQueue_t g_network_queue;  // 从ServerComm.c引用网络队列
static uint8_t display_mode = 0;  // 显示模式：0-系统状态，1-传感器数据，2-执行器状态，3-网络状态
static uint8_t sensor_index = 0;  // 传感器数据显示索引
static uint32_t last_display_update = 0;  // 上次显示更新时间

/* ==================== 显示模式定义 ==================== */

#define DISPLAY_MODE_SYSTEM 0      // 系统状态模式
#define DISPLAY_MODE_SENSOR 1      // 传感器数据模式
#define DISPLAY_MODE_ACTUATOR 2    // 执行器状态模式
#define DISPLAY_MODE_NETWORK 3     // 网络状态模式

#define DISPLAY_UPDATE_INTERVAL 1000  // 显示更新间隔（ms）

/* ==================== 函数声明 ==================== */

void OLED_Display_Init(void);
void OLED_Display_Update(void);
void OLED_Display_SystemStatus(void);
void OLED_Display_SensorData(void);
void OLED_Display_ActuatorStatus(void);
void OLED_Display_NetworkStatus(void);
void OLED_Display_CycleMode(void);

/* ==================== 函数实现 ==================== */

/**
 * @brief   初始化OLED显示管理
 * @details 初始化显示相关的变量和状态
 */
void OLED_Display_Init(void)
{
    display_mode = 0;
    sensor_index = 0;
    last_display_update = 0;
    
    OLED_Clear();
    OLED_ShowString(1, 1, "  Smart Agri");
    OLED_ShowString(2, 1, "  System");
    OLED_ShowString(3, 1, "  Initializing");
    OLED_ShowString(4, 1, "  Please wait...");
    delay_ms(1000);
}

/**
 * @brief   获取系统时间（毫秒）
 * @return  系统时间（毫秒）
 */
uint32_t GetSystemTime(void)
{
    return timecount;
}

/**
 * @brief   更新OLED显示
 * @details 根据当前显示模式更新OLED显示内容
 */
void OLED_Display_Update(void)
{
    uint32_t current_time = GetSystemTime();
    
    if (current_time - last_display_update >= DISPLAY_UPDATE_INTERVAL) {
        last_display_update = current_time;
        
        switch (display_mode) {
            case DISPLAY_MODE_SYSTEM:
                OLED_Display_SystemStatus();
                break;
            case DISPLAY_MODE_SENSOR:
                OLED_Display_SensorData();
                break;
            case DISPLAY_MODE_ACTUATOR:
                OLED_Display_ActuatorStatus();
                break;
            case DISPLAY_MODE_NETWORK:
                OLED_Display_NetworkStatus();
                break;
        }
    }
}

/**
 * @brief   显示系统状态
 * @details 显示系统基本状态，包括WiFi连接、TCP连接等
 */
void OLED_Display_SystemStatus(void)
{
    OLED_Clear();
    
    // 第1行：系统名称
    OLED_ShowString(1, 1, "  Smart Agri");
    
    // 第2行：WiFi状态
    if (g_wifi_connected) {
        OLED_ShowString(2, 1, "  WiFi: Connected");
    } else {
        OLED_ShowString(2, 1, "  WiFi: Disconnected");
    }
    
    // 第3行：TCP连接状态
    if (ServerComm_IsConnected()) {
        OLED_ShowString(3, 1, "  TCP: Connected");
    } else {
        OLED_ShowString(3, 1, "  TCP: Disconnected");
    }
    
    // 第4行：系统时间（简化显示）
    char time_str[16];
    uint32_t current_time = GetSystemTime() / 1000;  // 转换为秒
    uint8_t minutes = current_time / 60;
    uint8_t seconds = current_time % 60;
    sprintf(time_str, "  Time: %02d:%02d", minutes, seconds);
    OLED_ShowString(4, 1, time_str);
}

/**
 * @brief   显示传感器数据
 * @details 循环显示各种传感器数据
 */
void OLED_Display_SensorData(void)
{
    OLED_Clear();
    
    // 读取传感器数据
    uint8_t dht_temp, dht_humi;
    uint16_t light_lux;
    float soil_moisture, soil_temp, soil_ph;
    uint16_t ec_value;
    
    DHT11_ReadData();
    dht_temp = DHT11_GetTemperature();
    dht_humi = DHT11_GetHumidity();
    light_lux = LightSensor_GetLux();
    SoilSensor_ReadData(&soil_moisture, &soil_temp, &ec_value, &soil_ph);
    
    char line2[16], line3[16], line4[16];
    
    switch (sensor_index) {
        case 0:  // 空气温湿度
            OLED_ShowString(1, 1, "  Air Sensors");
            sprintf(line2, "  Temp: %dC", dht_temp);
            sprintf(line3, "  Humid: %d%%", dht_humi);
            OLED_ShowString(2, 1, line2);
            OLED_ShowString(3, 1, line3);
            OLED_ShowString(4, 1, "  ------");
            break;
            
        case 1:  // 光照强度
            OLED_ShowString(1, 1, "  Light Sensor");
            sprintf(line2, "  Lux: %d", light_lux);
            if (light_lux < 10) {
                OLED_ShowString(3, 1, "  Status: Dark");
            } else if (light_lux < 500) {
                OLED_ShowString(3, 1, "  Status: Indoor");
            } else if (light_lux < 2000) {
                OLED_ShowString(3, 1, "  Status: Cloudy");
            } else {
                OLED_ShowString(3, 1, "  Status: Sunny");
            }
            OLED_ShowString(2, 1, line2);
            OLED_ShowString(4, 1, "  ------");
            break;
            
        case 2:  // 土壤传感器
            OLED_ShowString(1, 1, "  Soil Sensors");
            sprintf(line2, "  Moist: %.1f%%", soil_moisture);
            sprintf(line3, "  Temp: %.1fC", soil_temp);
            sprintf(line4, "  EC: %d", ec_value);
            OLED_ShowString(2, 1, line2);
            OLED_ShowString(3, 1, line3);
            OLED_ShowString(4, 1, line4);
            break;
            
        case 3:  // 土壤pH值
            OLED_ShowString(1, 1, "  Soil pH");
            sprintf(line2, "  pH: %.1f", soil_ph);
            if (soil_ph < 5.5) {
                OLED_ShowString(3, 1, "  Status: Acidic");
            } else if (soil_ph > 7.5) {
                OLED_ShowString(3, 1, "  Status: Alkaline");
            } else {
                OLED_ShowString(3, 1, "  Status: Neutral");
            }
            OLED_ShowString(2, 1, line2);
            OLED_ShowString(4, 1, "  ------");
            break;
    }
    
    // 循环切换传感器显示
    sensor_index = (sensor_index + 1) % 4;
}

/**
 * @brief   获取继电器状态
 * @param   relay_num 继电器编号（1或2）
 * @return  继电器状态（0-关闭，1-打开）
 */
uint8_t RELAY_GetState(uint8_t relay_num)
{
    if (relay_num == 1) {
        return GPIO_ReadOutputDataBit(RELAYPORT, RELAY1);
    } else if (relay_num == 2) {
        return GPIO_ReadOutputDataBit(RELAYPORT, RELAY2);
    }
    return 0;
}

/**
 * @brief   显示执行器状态
 * @details 显示执行器的当前状态
 */
void OLED_Display_ActuatorStatus(void)
{
    OLED_Clear();
    
    OLED_ShowString(1, 1, "  Actuators");
    
    // 继电器1状态（假设控制通风风扇）
    if (RELAY_GetState(1)) {
        OLED_ShowString(2, 1, "  Fan: ON");
    } else {
        OLED_ShowString(2, 1, "  Fan: OFF");
    }
    
    // 继电器2状态（假设控制水泵）
    if (RELAY_GetState(2)) {
        OLED_ShowString(3, 1, "  Pump: ON");
    } else {
        OLED_ShowString(3, 1, "  Pump: OFF");
    }
    
    OLED_ShowString(4, 1, "  ------");
}

/**
 * @brief   显示网络状态
 * @details 显示网络连接状态和数据上传状态
 */
void OLED_Display_NetworkStatus(void)
{
    OLED_Clear();
    
    OLED_ShowString(1, 1, "  Network Status");
    
    // 队列状态
    uint16_t queue_count = NetworkQueue_GetCount(&g_network_queue);
    char queue_str[16];
    sprintf(queue_str, "  Queue: %d/32", queue_count);
    OLED_ShowString(2, 1, queue_str);
    
    // 服务器状态
    if (ServerComm_IsConnected()) {
        OLED_ShowString(3, 1, "  Server: Online");
    } else {
        OLED_ShowString(3, 1, "  Server: Offline");
    }
    
    // 上传状态
    OLED_ShowString(4, 1, "  Upload: Active");
}

/**
 * @brief   循环切换显示模式
 * @details 按顺序切换显示模式
 */
void OLED_Display_CycleMode(void)
{
    display_mode = (display_mode + 1) % 4;
    OLED_Clear();
    
    // 显示模式切换提示
    switch (display_mode) {
        case DISPLAY_MODE_SYSTEM:
            OLED_ShowString(2, 1, "  System Status");
            break;
        case DISPLAY_MODE_SENSOR:
            OLED_ShowString(2, 1, "  Sensor Data");
            break;
        case DISPLAY_MODE_ACTUATOR:
            OLED_ShowString(2, 1, "  Actuators");
            break;
        case DISPLAY_MODE_NETWORK:
            OLED_ShowString(2, 1, "  Network");
            break;
    }
    
    OLED_ShowString(3, 1, "  Mode Changed");
    delay_ms(500);
}
