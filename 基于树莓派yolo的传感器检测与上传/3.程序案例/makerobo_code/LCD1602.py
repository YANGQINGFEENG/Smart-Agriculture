#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# －－－－湖南创乐博智能科技有限公司－－－－
#  文件名：LCD1602.py
#  版本：V2.0
#  author: zhulin
# 说明：液晶显示器模块
#####################################################
import time
import smbus

makerobo_BUS = smbus.SMBus(1)

# IIC LCD1602 液晶模块写入字
def makerobo_write_word(addr, data):
	global makerobo_BLEN
	makerobo_temp = data
	if makerobo_BLEN == 1:
		makerobo_temp |= 0x08
	else:
		makerobo_temp &= 0xF7
	makerobo_BUS.write_byte(addr ,makerobo_temp) # 设置IIC LCD1602 液晶模块地址

# IIC LCD1602 发送命令
def  makerobo_send_command(comm):
	# 首先发送 bit7-4 位
	lcd_buf = comm & 0xF0
	lcd_buf |= 0x04               # RS = 0, RW = 0, EN = 1
	makerobo_write_word(LCD_ADDR ,lcd_buf)
	time.sleep(0.002)
	lcd_buf &= 0xFB               # Make EN = 0
	makerobo_write_word(LCD_ADDR ,lcd_buf)

	# 其次发送 bit3-0 位
	lcd_buf = (comm & 0x0F) << 4
	lcd_buf |= 0x04               # RS = 0, RW = 0, EN = 1
	makerobo_write_word(LCD_ADDR ,lcd_buf)
	time.sleep(0.002)
	lcd_buf &= 0xFB               # Make EN = 0
	makerobo_write_word(LCD_ADDR ,lcd_buf)

# IIC LCD1602 发送数据
def makerobo_send_data(data):
	# 首先发送 bit7-4 位
	lcd_buf = data & 0xF0
	lcd_buf |= 0x05               # RS = 1, RW = 0, EN = 1
	makerobo_write_word(LCD_ADDR ,lcd_buf)
	time.sleep(0.002)
	lcd_buf &= 0xFB               # Make EN = 0
	makerobo_write_word(LCD_ADDR ,lcd_buf)

	# 其次发送 bit3-0 位
	lcd_buf = (data & 0x0F) << 4
	lcd_buf |= 0x05               # RS = 1, RW = 0, EN = 1
	makerobo_write_word(LCD_ADDR ,lcd_buf)
	time.sleep(0.002)
	lcd_buf &= 0xFB               # Make EN = 0
	makerobo_write_word(LCD_ADDR ,lcd_buf)

# IIC LCD1602 初始化
def  makerobo_init(addr, bl):
	global LCD_ADDR
	global makerobo_BLEN
	LCD_ADDR = addr
	makerobo_BLEN = bl
	try:
		makerobo_send_command(0x33) # 必须先初始化到8线模式
		time.sleep(0.005)
		makerobo_send_command(0x32) # 然后初始化为4行模式
		time.sleep(0.005)
		makerobo_send_command(0x28) # 2 行 & 5*7 点位
		time.sleep(0.005)
		makerobo_send_command(0x0C) # 启用无光标显示
		time.sleep(0.005)
		makerobo_send_command(0x01) # 清除显示
		makerobo_BUS.write_byte(LCD_ADDR, 0x08)
	except:
		return False
	else:
		return True

# LCD 1602 清空显示函数
def makerobo_clear():
	makerobo_send_command(0x01)  # 清除显示

# LCD 1602 使能背光显示
def makerobo_openlight():  
	makerobo_BUS.write_byte(0x27,0x08)  # 使能背光显示命令
	makerobo_BUS.close()                # 关闭总线

# LCD 1602 显示函数
def makerobo_write(lcd_x, lcd_y, lcd_str):
	# 选择行与列
	if lcd_x < 0:
		lcd_x = 0
	if lcd_x > 15:
		lcd_x = 15
	if lcd_y <0:
		lcd_y = 0
	if lcd_y > 1:
		lcd_y = 1

	# 移动光标
	lcd_addr = 0x80 + 0x40 * lcd_y + lcd_x
	makerobo_send_command(lcd_addr)    # 发送地址

	for chr in lcd_str:                  # 获取字符串长度
		makerobo_send_data(ord(chr)) # 发送显示

# 程序入口
if __name__ == '__main__':
	makerobo_init(0x27, 1)          # 初始化显示屏
	makerobo_write(4, 0, 'Hello')   # 在第一行显示Hello
	makerobo_write(7, 1, 'world!')  # 在第二行显示world!

