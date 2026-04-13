/*********************************************************************************************
模板制作：  杜洋工作室/洋桃电子
程序名：	RS485通信测试程序
编写人：	杜洋	
编写时间：	2018年3月16日
硬件支持：	STM32F103C8   外部晶振8MHz RCC函数设置主频72MHz　  

修改日志：　　
1-	
	
							
说明：
 # 本模板加载了STM32F103内部的RCC时钟设置，并加入了利用滴答定时器的延时函数。
 # 可根据自己的需要增加或删减。

*********************************************************************************************/
#include "stm32f10x.h" //STM32头文件
#include "sys.h"
#include "delay.h"
#include "touch_key.h"
#include "relay.h"
#include "oled0561.h"

#include "usart.h"
#include "rs485.h"

int main (void){//主程序
	u8 a;
	delay_ms(100); //上电时等待其他器件就绪
	RCC_Configuration(); //系统时钟初始化 
	TOUCH_KEY_Init();//触摸按键初始化
	RELAY_Init();//继电器初始化

	I2C_Configuration();//I2C初始化
	OLED0561_Init(); //OLED初始化
	OLED_DISPLAY_8x16_BUFFER(0,"   YoungTalk "); //显示字符串
	OLED_DISPLAY_8x16_BUFFER(2,"  RS485 TEST "); //显示字符串
	OLED_DISPLAY_8x16_BUFFER(6,"TX:    RX:   "); //显示字符串

	USART3_Init(115200);//串口3初始化并启动
	RS485_Init();//RS485总线初始化，需要跟在USART3初始化下方

	while(1){
		if(!GPIO_ReadInputDataBit(TOUCH_KEYPORT,TOUCH_KEY_A)){RS485_printf("%c",'A');OLED_DISPLAY_8x16(6,4*8,'A');} //向RS232串口发送字符并在OLED上显示		
		else if(!GPIO_ReadInputDataBit(TOUCH_KEYPORT,TOUCH_KEY_B)){RS485_printf("%c",'B');OLED_DISPLAY_8x16(6,4*8,'B');} //向RS232串口发送字符并在OLED上显示		
		else if(!GPIO_ReadInputDataBit(TOUCH_KEYPORT,TOUCH_KEY_C)){RS485_printf("%c",'C');OLED_DISPLAY_8x16(6,4*8,'C');} //向RS232串口发送字符并在OLED上显示
		else if(!GPIO_ReadInputDataBit(TOUCH_KEYPORT,TOUCH_KEY_D)){RS485_printf("%c",'D');OLED_DISPLAY_8x16(6,4*8,'D');} //向RS232串口发送字符并在OLED上显示

		//查询方式接收
		if(USART_GetFlagStatus(USART3,USART_FLAG_RXNE) != RESET){  //查询串口待处理标志位
			a =USART_ReceiveData(USART3);//读取接收到的数据
			OLED_DISPLAY_8x16(6,11*8,a);//在OLED上显示
		}
	}
}

/*********************************************************************************************
 * 杜洋工作室 www.DoYoung.net
 * 洋桃电子 www.DoYoung.net/YT 
*********************************************************************************************/
/*

【变量定义】
u32     a; //定义32位无符号变量a
u16     a; //定义16位无符号变量a
u8     a; //定义8位无符号变量a
vu32     a; //定义易变的32位无符号变量a
vu16     a; //定义易变的 16位无符号变量a
vu8     a; //定义易变的 8位无符号变量a
uc32     a; //定义只读的32位无符号变量a
uc16     a; //定义只读 的16位无符号变量a
uc8     a; //定义只读 的8位无符号变量a

#define ONE  1   //宏定义

delay_us(1); //延时1微秒
delay_ms(1); //延时1毫秒
delay_s(1); //延时1秒

GPIO_WriteBit(LEDPORT,LED1,(BitAction)(1)); //LED控制

*/



