#ifndef __OLED0561_H
#define __OLED0561_H	 
#include "sys.h"
#include "i2c.h"

// OLED 的 I2C 从机地址（7 位地址左移 1 位，写方向位为 0），不可随意改动
#define OLED0561_ADD    0x78
// OLED 命令标志，I2C 传输时首字节为 0x00 表示后续为命令流，不可随意改动
#define COM             0x00
// OLED 数据标志，I2C 传输时首字节为 0x40 表示后续为数据流，不可随意改动
#define DAT             0x40

// OLED 初始化：配置引脚、发送初始化命令序列，完成屏幕唤醒
void OLED0561_Init(void);

// 打开 OLED 显示：关闭全屏熄灭命令，恢复屏幕内容
void OLED_DISPLAY_ON(void);

// 关闭 OLED 显示：发送全屏熄灭命令，屏幕变黑但显存数据保留
void OLED_DISPLAY_OFF(void);

// 设置 OLED 全局对比度，x 取值 0~255，数值越大越亮
void OLED_DISPLAY_LIT(u8 x);

// 清屏：将内部 128×64 点阵显存全部写 0，并立即刷新到屏幕
void OLED_DISPLAY_CLEAR(void);

// 在指定坐标 (x,y) 显示一个 8×16 点阵的 ASCII 字符，w 为字符编码
void OLED_DISPLAY_8x16(u8 x, u8 y, u16 w);

// 在指定行 row（0~7）显示一串 8×16 点阵的 ASCII 字符串，str 以 '\0' 结尾
void OLED_DISPLAY_8x16_BUFFER(u8 row, u8 *str);

// 垂直滚动显示：从 start_row 到 end_row 区域整体向右滚动，需先设置滚动参数
void OLED_SCROLL_RIGHT(u8 start_row, u8 end_row);

// 垂直滚动显示：从 start_row 到 end_row 区域整体向左滚动，需先设置滚动参数
void OLED_SCROLL_LEFT(u8 start_row, u8 end_row);

// 停止当前滚动动画，恢复屏幕静止状态
void OLED_SCROLL_STOP(void);

		 				    
#endif
