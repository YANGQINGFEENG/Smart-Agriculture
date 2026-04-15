/**
 * @file    atk_oled.c
 * @brief   ATK-OLED显示模块驱动实现文件
 * @details 实现OLED初始化、显示控制和图形绘制功能
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    基于STM32F103微控制器，使用I2C接口
 *          OLED分辨率：128x64
 *          I2C地址：0x78
 */

#include "atk_oled.h"
#include "oledfont.h"
#include "myiic.h"
#include "Delay.h"

/* ==================== 全局变量定义 ==================== */

static uint8_t g_atk_oled_gram[128][8];                                 // OLED显存

/* ==================== 内部函数实现 ==================== */

/**
 * @brief   写一个字节到OLED
 * @param   data: 要写入的数据
 * @param   cmd: 0表示命令，1表示数据
 */
static void atk_oled_wr_byte(uint8_t data, uint8_t cmd)
{
    iic_start();
    iic_send_byte(OLED_I2C_ADDR);                                       // 发送设备地址
    iic_ack();
    if (cmd)
    {
        iic_send_byte(0x40);                                            // 数据模式
    }
    else
    {
        iic_send_byte(0x00);                                            // 命令模式
    }
    iic_ack();
    iic_send_byte(data);                                                // 发送数据
    iic_ack();
    iic_stop();
}

/* ==================== 函数实现 ==================== */

/**
 * @brief   OLED初始化
 * @details 初始化I2C接口和OLED显示参数
 */
void atk_oled_init(void)
{
    iic_init();                                                         // 初始化I2C

    atk_oled_wr_byte(0xAE, OLED_CMD);                                   // 关闭显示
    atk_oled_wr_byte(0xD5, OLED_CMD);                                   // 设置时钟分频
    atk_oled_wr_byte(0x80, OLED_CMD);                                   // 分频系数
    atk_oled_wr_byte(0xA8, OLED_CMD);                                   // 设置MUX比率
    atk_oled_wr_byte(0x3F, OLED_CMD);                                   // 1/64 MUX
    atk_oled_wr_byte(0xD3, OLED_CMD);                                   // 设置显示偏移
    atk_oled_wr_byte(0x00, OLED_CMD);                                   // 无偏移
    atk_oled_wr_byte(0x40, OLED_CMD);                                   // 设置显示起始行
    atk_oled_wr_byte(0x8D, OLED_CMD);                                   // 设置电荷泵
    atk_oled_wr_byte(0x14, OLED_CMD);                                   // 开启电荷泵
    atk_oled_wr_byte(0x20, OLED_CMD);                                   // 设置内存模式
    atk_oled_wr_byte(0x02, OLED_CMD);                                   // 垂直地址模式
    atk_oled_wr_byte(0xA1, OLED_CMD);                                   // 设置段映射
    atk_oled_wr_byte(0xC8, OLED_CMD);                                   // 设置COM扫描方向
    atk_oled_wr_byte(0xDA, OLED_CMD);                                   // 设置COM引脚
    atk_oled_wr_byte(0x12, OLED_CMD);                                   // 设置COM引脚硬件配置
    atk_oled_wr_byte(0x81, OLED_CMD);                                   // 设置对比度控制
    atk_oled_wr_byte(0xFF, OLED_CMD);                                   // 设置对比度值
    atk_oled_wr_byte(0xD9, OLED_CMD);                                   // 设置预充电周期
    atk_oled_wr_byte(0xF1, OLED_CMD);                                   // 设置预充电周期值
    atk_oled_wr_byte(0xDB, OLED_CMD);                                   // 设置VCOMH电平
    atk_oled_wr_byte(0x30, OLED_CMD);                                   // 设置VCOMH电平值
    atk_oled_wr_byte(0xA4, OLED_CMD);                                   // 设置显示全部ON/OFF
    atk_oled_wr_byte(0xA6, OLED_CMD);                                   // 设置正常显示
    atk_oled_wr_byte(0xAF, OLED_CMD);                                   // 开启显示
    atk_oled_clear();                                                   // 清屏
}

/**
 * @brief   OLED清屏
 * @details 清除显存并刷新显示
 */
void atk_oled_clear(void)
{
    uint8_t i, j;
    for (i = 0; i < 8; i++)
    {
        for (j = 0; j < 128; j++)
        {
            g_atk_oled_gram[j][i] = 0x00;
        }
    }
    atk_oled_refresh_gram();                                            // 刷新显示
}

/**
 * @brief   OLED显示开启
 */
void atk_oled_display_on(void)
{
    atk_oled_wr_byte(0xAF, OLED_CMD);                                   // 开启显示
}

/**
 * @brief   OLED显示关闭
 */
void atk_oled_display_off(void)
{
    atk_oled_wr_byte(0xAE, OLED_CMD);                                   // 关闭显示
}

/**
 * @brief   刷新显存到OLED
 * @details 将显存数据写入OLED显示
 */
void atk_oled_refresh_gram(void)
{
    uint8_t i, j;
    for (i = 0; i < 8; i++)
    {
        atk_oled_wr_byte(0xB0 + i, OLED_CMD);                           // 设置页地址
        atk_oled_wr_byte(0x00, OLED_CMD);                               // 设置列地址低字节
        atk_oled_wr_byte(0x10, OLED_CMD);                               // 设置列地址高字节
        for (j = 0; j < 128; j++)
        {
            atk_oled_wr_byte(g_atk_oled_gram[j][i], OLED_DATA);         // 写入数据
        }
    }
}

/**
 * @brief   OLED画点
 * @param   x: 横坐标 (0~127)
 * @param   y: 纵坐标 (0~63)
 * @param   dot: 点状态 (1表示点亮，0表示熄灭)
 */
void atk_oled_draw_point(uint8_t x, uint8_t y, uint8_t dot)
{
    uint8_t pos, bx, temp = 0;

    if (x > 127 || y > 63) return;                                      // 超出屏幕范围

    pos = y / 8;                                                        // 计算字节位置
    bx = y % 8;                                                         // 计算位位置
    temp = 1 << bx;                                                     // 计算位掩码

    if (dot)
    {
        g_atk_oled_gram[x][pos] |= temp;                                // 点亮
    }
    else
    {
        g_atk_oled_gram[x][pos] &= ~temp;                               // 熄灭
    }
}

/**
 * @brief   OLED填充矩形
 * @param   x1: 起始横坐标
 * @param   y1: 起始纵坐标
 * @param   x2: 结束横坐标
 * @param   y2: 结束纵坐标
 * @param   dot: 点状态 (1表示点亮，0表示熄灭)
 */
void atk_oled_fill(uint8_t x1, uint8_t y1, uint8_t x2, uint8_t y2, uint8_t dot)
{
    uint8_t x, y;
    for (x = x1; x <= x2; x++)
    {
        for (y = y1; y <= y2; y++)
        {
            atk_oled_draw_point(x, y, dot);
        }
    }
    atk_oled_refresh_gram();                                            // 刷新显示
}

/**
 * @brief   OLED显示字符
 * @param   x: 起始横坐标
 * @param   y: 起始纵坐标
 * @param   chr: 要显示的字符
 * @param   size: 字符大小 (12, 16, 24)
 * @param   mode: 显示模式 (0表示反色，1表示正常)
 */
void atk_oled_show_char(uint8_t x, uint8_t y, uint8_t chr, uint8_t size, uint8_t mode)
{
    uint8_t temp, t, t1;
    uint8_t *pfont = 0;
    uint8_t csize = (size / 8 + ((size % 8) ? 1 : 0)) * (size / 2);

    chr = chr - ' ';                                                    // 计算字符偏移

    if (size == 12)
    {
        pfont = (uint8_t *)oled_asc2_1206[chr];
    }
    else if (size == 16)
    {
        pfont = (uint8_t *)oled_asc2_1608[chr];
    }
    else if (size == 24)
    {
        pfont = (uint8_t *)oled_asc2_2412[chr];
    }
    else
    {
        return;                                                         // 不支持的大小
    }

    uint8_t y_start = y;                                                // 保存起始纵坐标

    for (t = 0; t < csize; t++)
    {
        temp = pfont[t];

        for (t1 = 0; t1 < 8; t1++)
        {
            if (temp & 0x80)
            {
                atk_oled_draw_point(x, y, mode);
            }
            else
            {
                atk_oled_draw_point(x, y, !mode);
            }

            temp <<= 1;
            y++;

            if ((y - y_start) == size)
            {
                y = y_start;
                x++;
                break;
            }
        }
    }
}

/**
 * @brief   幂运算函数
 * @param   m: 底数
 * @param   n: 指数
 * @return  幂运算结果
 */
uint32_t atk_oled_pow(uint8_t m, uint8_t n)
{
    uint32_t result = 1;

    while (n--)
    {
        result *= m;
    }

    return result;
}

/**
 * @brief   OLED显示数字
 * @param   x: 起始横坐标
 * @param   y: 起始纵坐标
 * @param   num: 要显示的数字
 * @param   len: 数值长度
 * @param   size: 字符大小 (12, 16, 24)
 */
void atk_oled_show_num(uint8_t x, uint8_t y, uint32_t num, uint8_t len, uint8_t size)
{
    uint8_t t, temp;
    uint8_t enshow = 0;

    for (t = 0; t < len; t++)
    {
        temp = (num / atk_oled_pow(10, len - t - 1)) % 10;

        if (enshow == 0 && t < (len - 1))
        {
            if (temp == 0)
            {
                atk_oled_show_char(x + (size / 2) * t, y, ' ', size, 1);
                continue;
            }
            else
            {
                enshow = 1;
            }
        }

        atk_oled_show_char(x + (size / 2) * t, y, temp + '0', size, 1);
    }
}

/**
 * @brief   OLED显示字符串
 * @param   x: 起始横坐标
 * @param   y: 起始纵坐标
 * @param   p: 要显示的字符串
 * @param   size: 字符大小 (12, 16, 24)
 */
void atk_oled_show_string(uint8_t x, uint8_t y, const char *p, uint8_t size)
{
    while ((*p <= '~') && (*p >= ' '))
    {
        if (x > (128 - (size / 2)))
        {
            x = 0;
            y += size;
        }

        if (y > (64 - size))
        {
            y = x = 0;
            atk_oled_clear();
        }

        atk_oled_show_char(x, y, *p, size, 1);
        x += size / 2;
        p++;
    }
}
