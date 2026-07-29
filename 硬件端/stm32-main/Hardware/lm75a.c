/**
 * @file    lm75a.c
 * @brief   LM75A温度传感器驱动实现文件
 * @details 实现LM75A温度传感器的温度读取和掉电模式功能
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    基于I2C接口的LM75A温度传感器
 */

#include "lm75a.h"

/* ==================== 函数实现 ==================== */

/**
 * @brief   获取LM75A温度值
 * @param   Tempbuffer 温度数据缓冲区（3字节）
 * @note    温度范围：-55~125℃
 *          Tempbuffer[0]: 温度符号（0为正，1为负）
 *          Tempbuffer[1]: 温度整数部分（0~125）
 *          Tempbuffer[2]: 温度小数部分（0~99）
 */
void LM75A_GetTemp(u8 *Tempbuffer)
{
    u8 buf[2];                                  // 温度值缓存
    u8 t = 0, a = 0;
    
    // 读取温度值（从机地址、寄存器地址、数据存储地址、读取字节数）
    I2C_READ_BUFFER(LM75A_ADD, 0x00, buf, 2);
    
    t = buf[0];                                 // 获取温度整数部分（0~125）
    *Tempbuffer = 0;                            // 温度值为正值
    
    if(t & 0x80)
    {
        // 判断温度是否为负（MSB表示温度符号）
        *Tempbuffer = 1;                        // 温度值为负值
        t = ~t;
        t++;                                    // 计算补码（原码取反加1）
    }
    
    // 从高到低位计算温度整数部分（0~125）
    if(t & 0x01){ a = a + 1; }
    if(t & 0x02){ a = a + 2; }
    if(t & 0x04){ a = a + 4; }
    if(t & 0x08){ a = a + 8; }
    if(t & 0x10){ a = a + 16; }
    if(t & 0x20){ a = a + 32; }
    if(t & 0x40){ a = a + 64; }
    
    Tempbuffer++;
    *Tempbuffer = a;
    a = 0;
    
    t = buf[1];                                 // 获取小数部分
    // 计算小数部分，取0.125度前2位（12、25、37、50、62、75、87）
    if(t & 0x20){ a = a + 12; }
    if(t & 0x40){ a = a + 25; }
    if(t & 0x80){ a = a + 50; }
    
    Tempbuffer++;
    *Tempbuffer = a;
}

/**
 * @brief   LM75A进入掉电模式
 * @note    掉电模式可降低功耗，再次调用LM75A_GetTemp()可唤醒
 *          此功能只在需要低功耗时使用
 */
void LM75A_POWERDOWN(void)
{
    I2C_SAND_BYTE(LM75A_ADD, 0x01, 1);
}
