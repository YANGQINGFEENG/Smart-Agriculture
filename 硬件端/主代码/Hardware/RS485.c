#include "stm32f10x.h"
#include "RS485.h"

// USART3接收缓冲区和状态变量
uint8_t USART3_RX_BUF[USART3_REC_LEN];
uint16_t USART3_RX_STA = 0;

/**
 * @brief RS485初始化
 * @param 无
 * @retval 无
 */
void RS485_Init(void)
{
	GPIO_InitTypeDef GPIO_InitStructure;
	
	// 使能GPIOA时钟
	RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE);
	
	// 配置RS485_RE引脚为推挽输出
	GPIO_InitStructure.GPIO_Pin = RS485_RE;
	GPIO_InitStructure.GPIO_Mode = GPIO_Mode_Out_PP;
	GPIO_InitStructure.GPIO_Speed = GPIO_Speed_50MHz;
	GPIO_Init(RS485PORT, &GPIO_InitStructure);
	
	// 默认设置为接收模式（RE为低电平）
	GPIO_ResetBits(RS485PORT, RS485_RE);
	
	// 初始化USART3，波特率4800（土壤传感器要求）
	USART3_Init(4800);
}

/**
 * @brief RS485发送格式化字符串
 * @param fmt 格式化字符串
 * @retval 无
 */
void RS485_printf(char *fmt, ...)
{
	char buffer[USART3_REC_LEN + 1];
	uint8_t i = 0;
	va_list arg_ptr;
	
	// 设置为发送模式（RE为高电平）
	GPIO_SetBits(RS485PORT, RS485_RE);
	
	va_start(arg_ptr, fmt);
	vsnprintf(buffer, USART3_REC_LEN + 1, fmt, arg_ptr);
	va_end(arg_ptr);
	
	// 发送数据
	while ((i < USART3_REC_LEN) && (i < strlen(buffer)))
	{
		USART_SendData(USART3, (uint8_t)buffer[i++]);
		while (USART_GetFlagStatus(USART3, USART_FLAG_TC) == RESET);
	}
	
	// 切换回接收模式（RE为低电平）
	GPIO_ResetBits(RS485PORT, RS485_RE);
}

/**
 * @brief USART3初始化
 * @param BaudRate 波特率
 * @retval 无
 */
void USART3_Init(uint32_t BaudRate)
{
	GPIO_InitTypeDef GPIO_InitStructure;
	USART_InitTypeDef USART_InitStructure;
	NVIC_InitTypeDef NVIC_InitStructure;
	
	// 使能GPIOB和USART3时钟
	RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOB, ENABLE);
	RCC_APB1PeriphClockCmd(RCC_APB1Periph_USART3, ENABLE);
	
	// 配置USART3_RX - PB11
	GPIO_InitStructure.GPIO_Pin = GPIO_Pin_11;
	GPIO_InitStructure.GPIO_Mode = GPIO_Mode_IN_FLOATING;
	GPIO_Init(GPIOB, &GPIO_InitStructure);
	
	// 配置USART3_TX - PB10
	GPIO_InitStructure.GPIO_Pin = GPIO_Pin_10;
	GPIO_InitStructure.GPIO_Speed = GPIO_Speed_50MHz;
	GPIO_InitStructure.GPIO_Mode = GPIO_Mode_AF_PP;
	GPIO_Init(GPIOB, &GPIO_InitStructure);
	
	// USART3初始化配置
	USART_InitStructure.USART_BaudRate = BaudRate;
	USART_InitStructure.USART_WordLength = USART_WordLength_8b;
	USART_InitStructure.USART_StopBits = USART_StopBits_1;
	USART_InitStructure.USART_Parity = USART_Parity_No;
	USART_InitStructure.USART_HardwareFlowControl = USART_HardwareFlowControl_None;
	USART_InitStructure.USART_Mode = USART_Mode_Rx | USART_Mode_Tx;
	USART_Init(USART3, &USART_InitStructure);
	
	// 使能USART3接收中断
	USART_ITConfig(USART3, USART_IT_RXNE, ENABLE);
	
	// 使能USART3
	USART_Cmd(USART3, ENABLE);
	
	// 配置USART3中断
	NVIC_InitStructure.NVIC_IRQChannel = USART3_IRQn;
	NVIC_InitStructure.NVIC_IRQChannelPreemptionPriority = 2;
	NVIC_InitStructure.NVIC_IRQChannelSubPriority = 2;
	NVIC_InitStructure.NVIC_IRQChannelCmd = ENABLE;
	NVIC_Init(&NVIC_InitStructure);
}

/**
 * @brief RS485发送原始字节数据（用于发送HEX数据）
 * @param data 数据指针
 * @param len 数据长度
 * @retval 无
 */
void RS485_SendHex(uint8_t *data, uint8_t len)
{
	uint8_t i = 0;
	
	// 设置为发送模式（RE为高电平）
	GPIO_SetBits(RS485PORT, RS485_RE);
	
	// 发送数据
	for (i = 0; i < len; i++)
	{
		USART_SendData(USART3, data[i]);
		while (USART_GetFlagStatus(USART3, USART_FLAG_TC) == RESET);
	}
	
	// 切换回接收模式（RE为低电平）
	GPIO_ResetBits(RS485PORT, RS485_RE);
}

// USART3中断处理函数在atk_mb026_uart.c中定义
