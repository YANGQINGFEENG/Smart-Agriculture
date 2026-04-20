/**
 * @file    usart.c
 * @brief   串口驱动实现文件
 * @details 实现USART1串口的初始化、中断处理和数据接收功能
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    支持printf函数，需要选择use MicroLIB选项
 */

#include "usart.h"

/* 如果使用OS,则在下面include该头文件 */

#if SYS_SUPPORT_OS
#include "includes.h"  /* OS 使用 */
#endif

/* ==================== printf函数支持 ==================== */

/* 加入以下代码, 支持printf函数, 而不需要选择use MicroLIB */

#if 1
#if (__ARMCC_VERSION >= 6010050)  /* 使用AC6编译器时 */
__asm(".global __use_no_semihosting\n\t");  /* 声明不使用半主机模式 */
__asm(".global __ARM_use_no_argv \n\t");    /* AC6需要声明main函数为无参数格式,否则部分工程可能出现半主机模式 */

#else
/* 使用AC5编译器时, 要在这里定义__FILE , 否则使用半主机模式 */
#pragma import(__use_no_semihosting)

struct __FILE
{
    int handle;
};

#endif

/* 不使用半主机模式,至少需要重定义_ttywrch、_sys_exit、_sys_command_string函数,同时兼容AC6和AC5模式 */
int _ttywrch(int ch)
{
    ch = ch;
    return ch;
}

/* 定义_sys_exit()以避免使用半主机模式 */
void _sys_exit(int x)
{
    x = x;
}

char *_sys_command_string(char *cmd, int len)
{
    return NULL;
}

/* FILE 在stdio.h里面定义. */
FILE __stdout;

/* 重定义fputc函数, printf函数最终会通过调用fputc函数输出字符 */
int fputc(int ch, FILE *f)
{
    while ((USART1->SR & USART_FLAG_TXE) == 0);  /* 等待上一个字符发送完成 */
    USART1->DR = (uint8_t)ch;                   /* 将要发送的字符 ch 写入到DR寄存器 */
    return ch;
}
#endif

/* ==================== 全局变量定义 ==================== */

/* 接收缓冲区, 最大USART_REC_LEN个字节 */
uint8_t g_usart_rx_buf[USART_REC_LEN];

/*  接收状态
 *  bit15：      接收完成标志
 *  bit14：      接收到0x0d
 *  bit13~0：    接收到的有效字节数目
*/
uint16_t g_usart_rx_sta = 0;

uint8_t g_rx_buffer[RXBUFFERSIZE];  /* 串口接收缓冲区 */

extern GPIO_InitTypeDef GPIO_InitStructure;
extern USART_InitTypeDef USART_InitStructure;
extern NVIC_InitTypeDef NVIC_InitStructure;

/* ==================== 函数实现 ==================== */

/**
 * @brief   串口X初始化函数
 * @param   baudrate: 波特率, 根据自己需求设置波特率值
 * @note    注意: 必须正确设置时钟源, 否则串口波特率就会显示异常
 *          对于USART的时钟源在sys_stm32_clock_init()函数中已经设置过了
 */
void usart_init(uint32_t baudrate)
{
    /* 使能GPIO和USART时钟 */
    USART_TX_GPIO_CLK_ENABLE();
    USART_RX_GPIO_CLK_ENABLE();
    USART_UX_CLK_ENABLE();

    /* 配置USART TX引脚 */
    GPIO_InitStructure.GPIO_Pin = USART_TX_GPIO_PIN;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_AF_PP;
    GPIO_InitStructure.GPIO_Speed = GPIO_Speed_50MHz;
    GPIO_Init(USART_TX_GPIO_PORT, &GPIO_InitStructure);

    /* 配置USART RX引脚 */
    GPIO_InitStructure.GPIO_Pin = USART_RX_GPIO_PIN;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_IPD;
    GPIO_Init(USART_RX_GPIO_PORT, &GPIO_InitStructure);

    /* 配置USART */
    USART_InitStructure.USART_BaudRate = baudrate;
    USART_InitStructure.USART_WordLength = USART_WordLength_8b;
    USART_InitStructure.USART_StopBits = USART_StopBits_1;
    USART_InitStructure.USART_Parity = USART_Parity_No;
    USART_InitStructure.USART_HardwareFlowControl = USART_HardwareFlowControl_None;
    USART_InitStructure.USART_Mode = USART_Mode_Rx | USART_Mode_Tx;
    USART_Init(USART_UX, &USART_InitStructure);

    /* 使能USART */
    USART_Cmd(USART_UX, ENABLE);

    /* 设置中断优先级并使能中断 */
    NVIC_InitStructure.NVIC_IRQChannel = USART_UX_IRQn;
    NVIC_InitStructure.NVIC_IRQChannelPreemptionPriority = 3;
    NVIC_InitStructure.NVIC_IRQChannelSubPriority = 3;
    NVIC_InitStructure.NVIC_IRQChannelCmd = ENABLE;
    NVIC_Init(&NVIC_InitStructure);

    /* 使能USART中断 */
    USART_ITConfig(USART_UX, USART_IT_RXNE, ENABLE);
}

/**
 * @brief   串口1中断服务函数
 */
void USART1_IRQHandler(void)
{
    uint8_t ch;

    if (USART_GetITStatus(USART1, USART_IT_RXNE) != RESET)
    {
        ch = USART_ReceiveData(USART1);

        if ((g_usart_rx_sta & 0x8000) == 0)  /* 接收未完成 */
        {
            if (g_usart_rx_sta & 0x4000)     /* 接收到了0x0d */
            {
                if (ch != 0x0a)
                {
                    g_usart_rx_sta = 0;      /* 接收错误,重新开始 */
                }
                else
                {
                    g_usart_rx_sta |= 0x8000; /* 接收完成了 */
                }
            }
            else
            {
                if (ch == 0x0d)
                {
                    g_usart_rx_sta |= 0x4000;
                }
                else
                {
                    g_usart_rx_buf[g_usart_rx_sta & 0x3FFF] = ch;
                    g_usart_rx_sta++;
                    if (g_usart_rx_sta > (USART_REC_LEN - 1))
                    {
                        g_usart_rx_sta = 0;  /* 接收数据错误,重新开始接收 */
                    }
                }
            }
        }
    }
    
    /* 移除对ATK_MB026_USART1_IRQHandler的调用，因为WiFi模块现在使用USART2 */
}
