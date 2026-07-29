/**
 ****************************************************************************************************
 * @file        main.c
 * @author      Embedded System Team
 * @version     V2.0.0
 * @date        2026-04-13
 * @brief       主程序 - 状态机架构
 ****************************************************************************************************
 */

#include "stm32f10x.h"
#include "system.h"
#include "uart.h"
#include "wifi_manager.h"
#include "protocol.h"
#include "command_manager.h"
#include "state_manager.h"
#include "sys_config.h"

/* ==================================== 任务定义 ==================================== */
static task_t g_wdt_task;
static task_t g_sensor_task;
static task_t g_data_send_task;
static task_t g_heartbeat_task;

/* ==================================== 传感器数据 ==================================== */
typedef struct {
    float temperature;
    float humidity;
    float light;
    float soil_moisture;
    float soil_temperature;
    float soil_ec;
    float soil_ph;
} SensorData;

static SensorData g_sensor_data = {
    .temperature = 25.0f,
    .humidity = 50.0f,
    .light = 10000.0f,
    .soil_moisture = 60.0f,
    .soil_temperature = 22.0f,
    .soil_ec = 1.2f,
    .soil_ph = 6.5f
};

/* ==================================== 任务回调函数 ==================================== */

static void wdt_task_callback(void *arg)
{
    (void)arg;
    sys_wdt_feed();
}

static void sensor_task_callback(void *arg)
{
    (void)arg;
    
    /* 模拟传感器数据采集 */
    g_sensor_data.temperature += (float)(rand() % 100 - 50) / 100.0f;
    g_sensor_data.humidity += (float)(rand() % 100 - 50) / 200.0f;
    g_sensor_data.light += (float)(rand() % 1000 - 500);
    
    /* 边界检查 */
    if (g_sensor_data.temperature < 10.0f) g_sensor_data.temperature = 10.0f;
    if (g_sensor_data.temperature > 40.0f) g_sensor_data.temperature = 40.0f;
    if (g_sensor_data.humidity < 20.0f) g_sensor_data.humidity = 20.0f;
    if (g_sensor_data.humidity > 90.0f) g_sensor_data.humidity = 90.0f;
    if (g_sensor_data.light < 0.0f) g_sensor_data.light = 0.0f;
    if (g_sensor_data.light > 50000.0f) g_sensor_data.light = 50000.0f;
}

static void data_send_task_callback(void *arg)
{
    (void)arg;
    
    if (!wifi_manager_is_tcp_connected()) {
        debug_uart_printf("[Main] TCP not connected, skip sending\r\n");
        return;
    }
    
    /* 构建传感器数据帧 */
    SensorDataFrame frame;
    if (protocol_build_sensor_frame(&frame,
                                     g_sensor_data.temperature,
                                     g_sensor_data.humidity,
                                     g_sensor_data.light,
                                     g_sensor_data.soil_moisture,
                                     g_sensor_data.soil_temperature,
                                     g_sensor_data.soil_ec,
                                     g_sensor_data.soil_ph) != SYS_OK) {
        debug_uart_printf("[Main] Failed to build sensor frame\r\n");
        return;
    }
    
    /* 转换为字节数组 */
    uint8_t send_buf[sizeof(SensorDataFrame)];
    uint16_t send_len = protocol_frame_to_bytes(&frame, sizeof(SensorDataFrame),
                                                  send_buf, sizeof(send_buf));
    
    /* 发送数据 */
    if (wifi_manager_send_tcp_data(send_buf, send_len) == SYS_OK) {
        debug_uart_printf("[Main] Sensor data sent: T=%.1f H=%.1f L=%.0f\r\n",
                          g_sensor_data.temperature,
                          g_sensor_data.humidity,
                          g_sensor_data.light);
    } else {
        debug_uart_printf("[Main] Failed to send sensor data\r\n");
    }
}

static void heartbeat_task_callback(void *arg)
{
    (void)arg;
    
    if (!wifi_manager_is_tcp_connected()) {
        return;
    }
    
    /* 构建心跳帧 */
    HeartbeatFrame frame;
    if (protocol_build_heartbeat_frame(&frame) != SYS_OK) {
        return;
    }
    
    uint8_t send_buf[sizeof(HeartbeatFrame)];
    uint16_t send_len = protocol_frame_to_bytes(&frame, sizeof(HeartbeatFrame),
                                                  send_buf, sizeof(send_buf));
    
    wifi_manager_send_tcp_data(send_buf, send_len);
    debug_uart_printf("[Main] Heartbeat sent\r\n");
}

/* ==================================== 硬件初始化 ==================================== */

static void hardware_init(void)
{
    /* 初始化系统时钟（假设已在启动文件中配置） */
    
    /* 初始化SysTick */
    sys_tick_init();
    debug_uart_printf("[System] SysTick initialized\r\n");
    
    /* 初始化看门狗 */
    sys_wdt_init();
    debug_uart_printf("[System] Watchdog initialized\r\n");
    
    /* 初始化调试串口 */
    debug_uart_init();
    debug_uart_printf("\r\n========================================\r\n");
    debug_uart_printf("  Smart Agriculture IoT Device\r\n");
    debug_uart_printf("  Version: 2.0.0\r\n");
    debug_uart_printf("========================================\r\n");
    
    /* 初始化WiFi串口 */
    wifi_uart_init();
    debug_uart_printf("[UART] WiFi UART initialized with DMA\r\n");
    
    /* 初始化协议模块 */
    protocol_init();
    debug_uart_printf("[Protocol] Protocol module initialized\r\n");
    
    /* 初始化命令管理器 */
    command_manager_init();
    debug_uart_printf("[Command] Command manager initialized\r\n");
    
    /* 初始化状态管理器 */
    state_manager_init();
    debug_uart_printf("[State] State manager initialized\r\n");
    
    /* 初始化WiFi管理器 */
    wifi_manager_init();
    debug_uart_printf("[WiFi] WiFi manager initialized\r\n");
    
    /* 初始化任务调度器 */
    sys_scheduler_init();
    debug_uart_printf("[Scheduler] Task scheduler initialized\r\n");
    
    /* 创建任务 */
    sys_task_create(&g_wdt_task, wdt_task_callback, NULL, WDT_FEED_INTERVAL, "WDT");
    sys_task_create(&g_sensor_task, sensor_task_callback, NULL, ADC_SAMPLE_INTERVAL, "Sensor");
    sys_task_create(&g_data_send_task, data_send_task_callback, NULL, DATA_SEND_INTERVAL, "DataSend");
    sys_task_create(&g_heartbeat_task, heartbeat_task_callback, NULL, TCP_KEEP_ALIVE_INTERVAL, "Heartbeat");
    debug_uart_printf("[Scheduler] All tasks created\r\n");
    
    /* 启动任务 */
    sys_task_start(&g_wdt_task);
    sys_task_start(&g_sensor_task);
    sys_task_start(&g_data_send_task);
    sys_task_start(&g_heartbeat_task);
    debug_uart_printf("[Scheduler] All tasks started\r\n");
}

/* ==================================== 主函数 ==================================== */

int main(void)
{
    /* 初始化硬件 */
    hardware_init();
    
    debug_uart_printf("\r\n[System] Entering main loop...\r\n");
    
    /* 主循环 */
    while (1) {
        /* 运行任务调度器 */
        sys_scheduler_run();
        
        /* 运行WiFi管理器状态机 */
        wifi_manager_run();
        
        /* 运行命令管理器状态机 */
        command_manager_process();
        
        /* 运行状态管理器 */
        state_manager_process();
    }
}
