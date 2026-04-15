/**
 * @file    atk_oled.h
 * @brief   ATK-OLED显示模块驱动头文件
 * @details 定义OLED初始化和显示控制函数
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    基于STM32F103微控制器，使用I2C接口
 *          OLED分辨率：128x64
 *          I2C地址：0x78
 */

#ifndef __ATK_OLED_H
#define __ATK_OLED_H

#include "stdlib.h"
#include "stm32f10x.h"

/* ==================== 命令/数据 定义 ==================== */

#define OLED_CMD        0       // 写命令
#define OLED_DATA       1       // 写数据

/* ==================== I2C地址定义 ==================== */

#define OLED_I2C_ADDR   (0x78)  // OLED从设备地址

/* ==================== 函数声明 ==================== */

/**
 * @brief   OLED初始化
 */
void atk_oled_init(void);

/**
 * @brief   OLED清屏
 */
void atk_oled_clear(void);

/**
 * @brief   打开OLED显示
 */
void atk_oled_display_on(void);

/**
 * @brief   关闭OLED显示
 */
void atk_oled_display_off(void);

/**
 * @brief   刷新显存到OLED
 */
void atk_oled_refresh_gram(void);

/**
 * @brief   OLED画点
 * @param   x: 横坐标 (0~127)
 * @param   y: 纵坐标 (0~63)
 * @param   dot: 点状态 (1表示点亮，0表示熄灭)
 */
void atk_oled_draw_point(uint8_t x, uint8_t y, uint8_t dot);

/**
 * @brief   OLED填充矩形
 * @param   x1: 起始横坐标
 * @param   y1: 起始纵坐标
 * @param   x2: 结束横坐标
 * @param   y2: 结束纵坐标
 * @param   dot: 点状态 (1表示点亮，0表示熄灭)
 */
void atk_oled_fill(uint8_t x1, uint8_t y1, uint8_t x2, uint8_t y2, uint8_t dot);

/**
 * @brief   OLED显示字符
 * @param   x: 起始横坐标
 * @param   y: 起始纵坐标
 * @param   chr: 要显示的字符
 * @param   size: 字符大小 (12, 16, 24)
 * @param   mode: 显示模式 (0表示反色，1表示正常)
 */
void atk_oled_show_char(uint8_t x, uint8_t y, uint8_t chr, uint8_t size, uint8_t mode);

/**
 * @brief   幂运算函数
 * @param   m: 底数
 * @param   n: 指数
 * @return  幂运算结果
 */
uint32_t atk_oled_pow(uint8_t m, uint8_t n);

/**
 * @brief   OLED显示数字
 * @param   x: 起始横坐标
 * @param   y: 起始纵坐标
 * @param   num: 要显示的数字
 * @param   len: 数值长度
 * @param   size: 字符大小 (12, 16, 24)
 */
void atk_oled_show_num(uint8_t x, uint8_t y, uint32_t num, uint8_t len, uint8_t size);

/**
 * @brief   OLED显示字符串
 * @param   x: 起始横坐标
 * @param   y: 起始纵坐标
 * @param   p: 要显示的字符串
 * @param   size: 字符大小 (12, 16, 24)
 */
void atk_oled_show_string(uint8_t x, uint8_t y, const char *p, uint8_t size);

#endif
