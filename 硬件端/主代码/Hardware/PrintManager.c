#include "PrintManager.h"
#include "Serial.h"
#include <stdarg.h>

// 全局变量
static PrintLevel_t g_print_level = PRINT_LEVEL_INFO;  // 默认打印级别
static uint8_t g_module_enabled[PRINT_MODULE_SYSTEM + 1] = {1};  // 默认启用所有模块

/**
 * @brief 初始化打印管理器
 */
void PrintManager_Init(void)
{
    // 初始化所有模块为启用状态
    for (uint8_t i = 0; i <= PRINT_MODULE_SYSTEM; i++) {
        g_module_enabled[i] = 1;
    }
    
    PRINT_INFO(PRINT_MODULE_SYSTEM, "打印管理器初始化完成\r\n");
    printf("[PrintManager] 初始化完成\r\n");
}

/**
 * @brief 设置打印级别
 * @param level 打印级别
 */
void PrintManager_SetLevel(PrintLevel_t level)
{
    g_print_level = level;
    PRINT_INFO(PRINT_MODULE_SYSTEM, "打印级别设置为: %d\r\n", level);
}

/**
 * @brief 设置模块打印使能
 * @param module 模块
 * @param enabled 使能状态
 */
void PrintManager_SetModule(PrintModule_t module, uint8_t enabled)
{
    if (module == PRINT_MODULE_ALL) {
        for (uint8_t i = 0; i <= PRINT_MODULE_SYSTEM; i++) {
            g_module_enabled[i] = enabled;
        }
        PRINT_INFO(PRINT_MODULE_SYSTEM, "所有模块打印已%s\r\n", enabled ? "启用" : "禁用");
    } else if (module <= PRINT_MODULE_SYSTEM) {
        g_module_enabled[module] = enabled;
        PRINT_INFO(PRINT_MODULE_SYSTEM, "模块 %d 打印已%s\r\n", module, enabled ? "启用" : "禁用");
    }
}

/**
 * @brief 打印函数
 * @param module 模块
 * @param level 打印级别
 * @param format 格式化字符串
 * @param ... 可变参数
 */
void PrintManager_Printf(PrintModule_t module, PrintLevel_t level, char *format, ...)
{
    // 检查模块是否启用
    if (!g_module_enabled[PRINT_MODULE_ALL] && !g_module_enabled[module]) {
        return;
    }
    
    // 检查打印级别
    if (level < g_print_level) {
        return;
    }
    
    // 打印前缀
    switch (level) {
        case PRINT_LEVEL_DEBUG:
            Serial_Printf("[DEBUG] ");
            break;
        case PRINT_LEVEL_INFO:
            Serial_Printf("[INFO] ");
            break;
        case PRINT_LEVEL_WARNING:
            Serial_Printf("[WARNING] ");
            break;
        case PRINT_LEVEL_ERROR:
            Serial_Printf("[ERROR] ");
            break;
        case PRINT_LEVEL_CRITICAL:
            Serial_Printf("[CRITICAL] ");
            break;
    }
    
    // 打印模块信息
    switch (module) {
        case PRINT_MODULE_SENSOR:
            Serial_Printf("[传感器] ");
            break;
        case PRINT_MODULE_ACTUATOR:
            Serial_Printf("[执行器] ");
            break;
        case PRINT_MODULE_SERVER:
            Serial_Printf("[服务器] ");
            break;
        case PRINT_MODULE_WIFI:
            Serial_Printf("[WiFi] ");
            break;
        case PRINT_MODULE_OLED:
            Serial_Printf("[OLED] ");
            break;
        case PRINT_MODULE_QUEUE:
            Serial_Printf("[队列] ");
            break;
        case PRINT_MODULE_SYSTEM:
            Serial_Printf("[系统] ");
            break;
    }
    
    // 打印格式化内容
    va_list args;
    va_start(args, format);
    char buffer[256];
    vsprintf(buffer, format, args);
    Serial_Printf("%s", buffer);
    va_end(args);
}
