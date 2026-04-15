#include "relay.h"
#include <stdio.h>

void RELAY_Init(void){ //继电器接口初始化
	GPIO_InitTypeDef  GPIO_InitStructure; 
	RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA | RCC_APB2Periph_AFIO, ENABLE); //APB2外设时钟使能
    GPIO_InitStructure.GPIO_Pin = RELAY1 | RELAY2; //选择端口位                        
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_Out_PP; //选择IO接口工作方式             
    GPIO_InitStructure.GPIO_Speed = GPIO_Speed_50MHz; //设置IO接口速度（2/10/50MHz）
	GPIO_Init(RELAYPORT, &GPIO_InitStructure);
	//必须将占用的JTAG功能解除为GPIO使用
	GPIO_PinRemapConfig(GPIO_Remap_SWJ_Disable, ENABLE);// 改变指定管脚的映射,完全禁用JTAG+SW-DP
	GPIO_ResetBits(RELAYPORT,RELAY1 | RELAY2); //置为低电平（0） 初始为关闭继电器
}

void RELAY_1(u8 c){ //继电器1控制 c=0继电器关闭 c=1继电器开启
	printf("[Relay] 继电器1设置为: %d\r\n", c);
	GPIO_WriteBit(RELAYPORT,RELAY1,(BitAction)(c));//通过位带操作写端口
}
void RELAY_2(u8 c){ //继电器2控制 c=0继电器关闭 c=1继电器开启
	printf("[Relay] 继电器2设置为: %d\r\n", c);
	GPIO_WriteBit(RELAYPORT,RELAY2,(BitAction)(c));//通过位带操作写端口
	// 读取实际状态并打印
	printf("[Relay] 继电器2实际状态: %d\r\n", GPIO_ReadOutputDataBit(RELAYPORT, RELAY2));
}
