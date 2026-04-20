#ifndef __PRINT_MANAGER_H
#define __PRINT_MANAGER_H

#include "sys.h"

// 打印级别定义
typedef enum {
    PRINT_LEVEL_DEBUG,    // 调试信息
    PRINT_LEVEL_INFO,     // 信息
    PRINT_LEVEL_WARNING,  // 警告
    PRINT_LEVEL_ERROR,    // 错误
    PRINT_LEVEL_CRITICAL  // 严重错误
} PrintLevel_t;

// 打印模块定义
typedef enum {
    PRINT_MODULE_ALL,         // 所有模块
    PRINT_MODULE_SENSOR,      // 传感器模块
    PRINT_MODULE_ACTUATOR,    // 执行器模块
    PRINT_MODULE_SERVER,      // 服务器通信模块
    PRINT_MODULE_WIFI,        // WiFi模块
    PRINT_MODULE_OLED,        // OLED显示模块
    PRINT_MODULE_QUEUE,       // 队列模块
    PRINT_MODULE_SYSTEM       // 系统模块
} PrintModule_t;

// 函数声明
void PrintManager_Init(void);
void PrintManager_SetLevel(PrintLevel_t level);
void PrintManager_SetModule(PrintModule_t module, uint8_t enabled);
void PrintManager_Printf(PrintModule_t module, PrintLevel_t level, char *format, ...);

// 宏定义，方便使用
#define PRINT_DEBUG(module, format, ...)   PrintManager_Printf(module, PRINT_LEVEL_DEBUG, format, ##__VA_ARGS__)
#define PRINT_INFO(module, format, ...)    PrintManager_Printf(module, PRINT_LEVEL_INFO, format, ##__VA_ARGS__)
#define PRINT_WARNING(module, format, ...) PrintManager_Printf(module, PRINT_LEVEL_WARNING, format, ##__VA_ARGS__)
#define PRINT_ERROR(module, format, ...)   PrintManager_Printf(module, PRINT_LEVEL_ERROR, format, ##__VA_ARGS__)
#define PRINT_CRITICAL(module, format, ...) PrintManager_Printf(module, PRINT_LEVEL_CRITICAL, format, ##__VA_ARGS__)

#endif
