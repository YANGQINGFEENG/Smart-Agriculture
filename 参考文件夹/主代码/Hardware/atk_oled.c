#include "atk_oled.h"
#include "oledfont.h"
#include "myiic.h"
#include "Delay.h"

static uint8_t g_atk_oled_gram[128][8]; // OLED 显存

/**
 * @brief       写一个字节到 OLED
 * @param       data: 要写入的数据
 * @param       cmd: 0 表示命令，1 表示数据
 * @retval      无
 */
static void atk_oled_wr_byte(uint8_t data, uint8_t cmd)
{
    iic_start();
    iic_send_byte(OLED_I2C_ADDR); // 发送设备地址
    iic_ack();
    if (cmd)
    {
        iic_send_byte(0x40); // 数据模式
    }
    else
    {
        iic_send_byte(0x00); // 命令模式
    }
    iic_ack();
    iic_send_byte(data); // 发送数据
    iic_ack();
    iic_stop();
}

/**
 * @brief       OLED 初始化
 * @param       无
 * @retval      无
 */
void atk_oled_init(void)
{
    iic_init(); // 初始化 I2C

    atk_oled_wr_byte(0xAE, OLED_CMD); // 关闭显示
    atk_oled_wr_byte(0xD5, OLED_CMD); // 设置时钟分频
    atk_oled_wr_byte(0x80, OLED_CMD); // 分频因子
    atk_oled_wr_byte(0xA8, OLED_CMD); // 设置 MUX 比例
    atk_oled_wr_byte(0x3F, OLED_CMD); // 1/64 MUX
    atk_oled_wr_byte(0xD3, OLED_CMD); // 设置显示偏移
    atk_oled_wr_byte(0x00, OLED_CMD); // 不偏移
    atk_oled_wr_byte(0x40, OLED_CMD); // 设置显示开始行
    atk_oled_wr_byte(0x8D, OLED_CMD); // 设置充电泵
    atk_oled_wr_byte(0x14, OLED_CMD); // 开启充电泵
    atk_oled_wr_byte(0x20, OLED_CMD); // 设置内存模式
    atk_oled_wr_byte(0x02, OLED_CMD); // 垂直地址模式
    atk_oled_wr_byte(0xA1, OLED_CMD); // 设置段重映射
    atk_oled_wr_byte(0xC8, OLED_CMD); // 设置 COM 输出扫描方向
    atk_oled_wr_byte(0xDA, OLED_CMD); // 设置 COM 配置
    atk_oled_wr_byte(0x12, OLED_CMD); // 设置 COM 引脚硬件配置
    atk_oled_wr_byte(0x81, OLED_CMD); // 设置对比度控制
    atk_oled_wr_byte(0xFF, OLED_CMD); // 设置对比度值
    atk_oled_wr_byte(0xD9, OLED_CMD); // 设置预充电周期
    atk_oled_wr_byte(0xF1, OLED_CMD); // 设置预充电周期值
    atk_oled_wr_byte(0xDB, OLED_CMD); // 设置 VCOMH 电平
    atk_oled_wr_byte(0x30, OLED_CMD); // 设置 VCOMH 电平值
    atk_oled_wr_byte(0xA4, OLED_CMD); // 设置显示全部 ON/OFF
    atk_oled_wr_byte(0xA6, OLED_CMD); // 设置正常显示
    atk_oled_wr_byte(0xAF, OLED_CMD); // 开启显示
    atk_oled_clear(); // 清屏
}

/**
 * @brief       OLED 清屏
 * @param       无
 * @retval      无
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
    atk_oled_refresh_gram(); // 刷新显示
}

/**
 * @brief       OLED 显示开启
 * @param       无
 * @retval      无
 */
void atk_oled_display_on(void)
{
    atk_oled_wr_byte(0xAF, OLED_CMD); // 开启显示
}

/**
 * @brief       OLED 显示关闭
 * @param       无
 * @retval      无
 */
void atk_oled_display_off(void)
{
    atk_oled_wr_byte(0xAE, OLED_CMD); // 关闭显示
}

/**
 * @brief       刷新显存到 OLED
 * @param       无
 * @retval      无
 */
void atk_oled_refresh_gram(void)
{
    uint8_t i, j;
    for (i = 0; i < 8; i++)
    {
        atk_oled_wr_byte(0xB0 + i, OLED_CMD); // 设置页地址
        atk_oled_wr_byte(0x00, OLED_CMD);     // 设置列地址低字节
        atk_oled_wr_byte(0x10, OLED_CMD);     // 设置列地址高字节
        for (j = 0; j < 128; j++)
        {
            atk_oled_wr_byte(g_atk_oled_gram[j][i], OLED_DATA); // 写入数据
        }
    }
}

/**
 * @brief       OLED 画点
 * @param       x: 横坐标 (0~127)
 * @param       y: 纵坐标 (0~63)
 * @param       dot: 点的状态 (1 表示点亮，0 表示熄灭)
 * @retval      无
 */
void atk_oled_draw_point(uint8_t x, uint8_t y, uint8_t dot)
{
    uint8_t pos, bx, temp = 0;

    if (x > 127 || y > 63) return; // 超出屏幕范围

    pos = y / 8; // 计算行位置
    bx = y % 8;  // 计算位位置
    temp = 1 << bx; // 计算掩码

    if (dot)
    {
        g_atk_oled_gram[x][pos] |= temp; // 点亮
    }
    else
    {
        g_atk_oled_gram[x][pos] &= ~temp; // 熄灭
    }
}

/**
 * @brief       OLED 区域填充
 * @param       x1: 起始横坐标
 * @param       y1: 起始纵坐标
 * @param       x2: 结束横坐标
 * @param       y2: 结束纵坐标
 * @param       dot: 点的状态 (1 表示点亮，0 表示熄灭)
 * @retval      无
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
    atk_oled_refresh_gram(); // 刷新显示
}

/**
 * @brief       OLED 显示字符
 * @param       x: 起始横坐标
 * @param       y: 起始纵坐标
 * @param       chr: 要显示的字符
 * @param       size: 字符大小 (12, 16, 24)
 * @param       mode: 显示模式 (0 表示反色，1 表示正常)
 * @retval      无
 */
void atk_oled_show_char(uint8_t x, uint8_t y, uint8_t chr, uint8_t size, uint8_t mode)
{
    uint8_t temp, t, t1;
    uint8_t *pfont = 0;
    uint8_t csize = (size / 8 + ((size % 8) ? 1 : 0)) * (size / 2);

    chr = chr - ' '; // 调整字符偏移

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
        return; // 不支持的大小
    }

    uint8_t y_start = y; // 保存起始纵坐标

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
 * @brief       计算幂函数
 * @param       m: 底数
 * @param       n: 指数
 * @retval      计算结果
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
 * @brief       OLED 显示数字
 * @param       x: 起始横坐标
 * @param       y: 起始纵坐标
 * @param       num: 要显示的数字
 * @param       len: 数字长度
 * @param       size: 字符大小 (12, 16, 24)
 * @retval      无
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
 * @brief       OLED 显示字符串
 * @param       x: 起始横坐标
 * @param       y: 起始纵坐标
 * @param       p: 要显示的字符串
 * @param       size: 字符大小 (12, 16, 24)
 * @retval      无
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


