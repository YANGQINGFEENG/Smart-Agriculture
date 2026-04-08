#include "touch_key.h"
#include "../System/Delay.h"
#include "../Hardware/RELAY/relay.h"
#include "../Hardware/OLED.h"
#include <stdio.h>

// 触摸按键状态变量
volatile uint8_t touch_key_status = 0; // 0-无按键，1-A，2-B，3-C，4-D

void TOUCH_KEY_Init(void){ //触摸按键初始化
	GPIO_InitTypeDef  GPIO_InitStructure; //定义GPIO的初始化结构体
    GPIO_InitStructure.GPIO_Pin = TOUCH_KEY_A | TOUCH_KEY_B | TOUCH_KEY_C | TOUCH_KEY_D; //选择端口位                        
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_IPU; //选择IO接口工作方式 //上拉输入       
	GPIO_Init(TOUCH_KEYPORT,&GPIO_InitStructure);
}

// 外部中断初始化
void TOUCH_KEY_EXTI_Init(void){
	GPIO_InitTypeDef GPIO_InitStructure;
	EXTI_InitTypeDef EXTI_InitStructure;
	NVIC_InitTypeDef NVIC_InitStructure;

	// 使能GPIOA时钟
	RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA | RCC_APB2Periph_AFIO, ENABLE);

	// 配置GPIO为输入模式
	GPIO_InitStructure.GPIO_Pin = TOUCH_KEY_A | TOUCH_KEY_C | TOUCH_KEY_D;
	GPIO_InitStructure.GPIO_Mode = GPIO_Mode_IPU;
	GPIO_Init(TOUCH_KEYPORT, &GPIO_InitStructure);

	// 配置EXTI线路
	GPIO_EXTILineConfig(GPIO_PortSourceGPIOA, GPIO_PinSource0); // A键
	GPIO_EXTILineConfig(GPIO_PortSourceGPIOA, GPIO_PinSource2); // C键
	GPIO_EXTILineConfig(GPIO_PortSourceGPIOA, GPIO_PinSource3); // D键

	// 配置EXTI0（A键）
	EXTI_InitStructure.EXTI_Line = EXTI_Line0;
	EXTI_InitStructure.EXTI_Mode = EXTI_Mode_Interrupt;
	EXTI_InitStructure.EXTI_Trigger = EXTI_Trigger_Falling; // 下降沿触发
	EXTI_InitStructure.EXTI_LineCmd = ENABLE;
	EXTI_Init(&EXTI_InitStructure);

	// 配置EXTI2（C键）
	EXTI_InitStructure.EXTI_Line = EXTI_Line2;
	EXTI_Init(&EXTI_InitStructure);

	// 配置EXTI3（D键）
	EXTI_InitStructure.EXTI_Line = EXTI_Line3;
	EXTI_Init(&EXTI_InitStructure);

	// 配置NVIC
	NVIC_InitStructure.NVIC_IRQChannel = EXTI0_IRQn;
	NVIC_InitStructure.NVIC_IRQChannelPreemptionPriority = 0x01; // 更高优先级
	NVIC_InitStructure.NVIC_IRQChannelSubPriority = 0x01;
	NVIC_InitStructure.NVIC_IRQChannelCmd = ENABLE;
	NVIC_Init(&NVIC_InitStructure);

	NVIC_InitStructure.NVIC_IRQChannel = EXTI2_IRQn;
	NVIC_InitStructure.NVIC_IRQChannelPreemptionPriority = 0x02;
	NVIC_InitStructure.NVIC_IRQChannelSubPriority = 0x02;
	NVIC_Init(&NVIC_InitStructure);

	NVIC_InitStructure.NVIC_IRQChannel = EXTI3_IRQn;
	NVIC_Init(&NVIC_InitStructure);

	printf("[Touch Key] 外部中断初始化完成\r\n");
}

// 检测触摸按键状态
// 返回值：0-无按键，1-A，2-B，3-C，4-D
uint8_t TOUCH_KEY_Scan(void)
{
    if (GPIO_ReadInputDataBit(TOUCH_KEYPORT, TOUCH_KEY_A) == 0) {
        delay_ms(10); // 消抖
        if (GPIO_ReadInputDataBit(TOUCH_KEYPORT, TOUCH_KEY_A) == 0) {
            while (GPIO_ReadInputDataBit(TOUCH_KEYPORT, TOUCH_KEY_A) == 0); // 等待释放
            return 1; // A键
        }
    }
    if (GPIO_ReadInputDataBit(TOUCH_KEYPORT, TOUCH_KEY_B) == 0) {
        delay_ms(10); // 消抖
        if (GPIO_ReadInputDataBit(TOUCH_KEYPORT, TOUCH_KEY_B) == 0) {
            while (GPIO_ReadInputDataBit(TOUCH_KEYPORT, TOUCH_KEY_B) == 0); // 等待释放
            return 2; // B键
        }
    }
    if (GPIO_ReadInputDataBit(TOUCH_KEYPORT, TOUCH_KEY_C) == 0) {
        delay_ms(10); // 消抖
        if (GPIO_ReadInputDataBit(TOUCH_KEYPORT, TOUCH_KEY_C) == 0) {
            while (GPIO_ReadInputDataBit(TOUCH_KEYPORT, TOUCH_KEY_C) == 0); // 等待释放
            return 3; // C键
        }
    }
    if (GPIO_ReadInputDataBit(TOUCH_KEYPORT, TOUCH_KEY_D) == 0) {
        delay_ms(10); // 消抖
        if (GPIO_ReadInputDataBit(TOUCH_KEYPORT, TOUCH_KEY_D) == 0) {
            while (GPIO_ReadInputDataBit(TOUCH_KEYPORT, TOUCH_KEY_D) == 0); // 等待释放
            return 4; // D键
        }
    }
    return 0; // 无按键
}

// EXTI2中断处理函数（C键）
void EXTI2_IRQHandler(void)
{
	if (EXTI_GetITStatus(EXTI_Line2) != RESET) {
		// 消抖
		delay_ms(10);
		if (GPIO_ReadInputDataBit(TOUCH_KEYPORT, TOUCH_KEY_C) == 0) {
			printf("[Touch Key] 中断：C键被按下\r\n");
			// 打开继电器2（水泵供电）
			RELAY_2(1);
			printf("[System] 触摸按键C按下，打开继电器2（水泵供电）\r\n");
			OLED_ShowString(1, 1, "  Relay 2");
			OLED_ShowString(2, 1, "  ON");
			OLED_ShowString(3, 1, "  Water Pump");
			OLED_ShowString(4, 1, "  Powered");
		}
		// 清除中断标志位
		EXTI_ClearITPendingBit(EXTI_Line2);
	}
}

// EXTI3中断处理函数（D键）
void EXTI3_IRQHandler(void)
{
	if (EXTI_GetITStatus(EXTI_Line3) != RESET) {
		// 消抖
		delay_ms(10);
		if (GPIO_ReadInputDataBit(TOUCH_KEYPORT, TOUCH_KEY_D) == 0) {
			printf("[Touch Key] 中断：D键被按下\r\n");
			// 关闭继电器2（停止水泵供电）
			RELAY_2(0);
			printf("[System] 触摸按键D按下，关闭继电器2（停止水泵供电）\r\n");
			OLED_ShowString(1, 1, "  Relay 2");
			OLED_ShowString(2, 1, "  OFF");
			OLED_ShowString(3, 1, "  Water Pump");
			OLED_ShowString(4, 1, "  Stopped");
		}
		// 清除中断标志位
		EXTI_ClearITPendingBit(EXTI_Line3);
	}
}

// EXTI0中断处理函数（A键）
void EXTI0_IRQHandler(void)
{
	if (EXTI_GetITStatus(EXTI_Line0) != RESET) {
		// 消抖
		delay_ms(10);
		if (GPIO_ReadInputDataBit(TOUCH_KEYPORT, TOUCH_KEY_A) == 0) {
			printf("[Touch Key] 中断：A键被按下\r\n");
			printf("[System] 触摸按键A按下\r\n");
		}
		// 清除中断标志位
		EXTI_ClearITPendingBit(EXTI_Line0);
	}
}
