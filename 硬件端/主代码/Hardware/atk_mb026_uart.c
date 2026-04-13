/**
 * @file    atk_mb026_uart.c
 * @brief   ATK-MB026 WiFi模块UART接口驱动实现文件
 * @details 实现ATK-MB026 WiFi模块的UART接口初始化和通信功能
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    基于STM32F103微控制器，使用USART2
 */

#include "atk_mb026_uart.h"
#include "delay.h"
#include "RS485.h"
#include <stdarg.h>
#include <stdio.h>
#include <string.h>

/* ==================== 宏定义 ==================== */

#define TX_BUF_SIZE 128                             // 发送缓冲区大小

/* ==================== 全局变量 ==================== */

uint8_t g_uart_rx_frame[ATK_MB026_UART_RX_BUF_SIZE]; // UART接收帧缓冲区

struct {
    uint16_t len    : 15;                          // 接收到的数据长度
    uint16_t finsh  : 1;                           // 接收完成标志
} g_sta;

uint8_t tx_buf[TX_BUF_SIZE];                       // 发送缓冲区
volatile uint16_t tx_head = 0;                     // 发送缓冲区头指针
volatile uint16_t tx_tail = 0;                     // 发送缓冲区尾指针

/* ==================== 函数实现 ==================== */

/**
 * @brief   ATK-MB026 UART printf函数
 * @param   fmt 格式化字符串
 */
void atk_mb026_uart_printf(char *fmt, ...)
{
    va_list ap;
    char buf[512];
    uint16_t len;
    
    va_start(ap, fmt);
    len = vsnprintf(buf, sizeof(buf), fmt, ap);
    va_end(ap);
    
    if (len > 0)
    {
        // 将数据写入发送缓冲区
        for (uint16_t i = 0; i < len; i++)
        {
            tx_buf[tx_head] = buf[i];
            tx_head = (tx_head + 1) % TX_BUF_SIZE;
        }
        
        // 启用发送中断
        USART_ITConfig(ATK_MB026_UART_INTERFACE, USART_IT_TXE, ENABLE);
    }
}

/**
 * @brief   ATK-MB026 UART printf函数（阻塞方式）
 * @param   fmt 格式化字符串
 */
void atk_mb026_uart_printf_blocking(char *fmt, ...)
{
    va_list ap;
    char buf[512];
    uint16_t len;
    
    va_start(ap, fmt);
    len = vsnprintf(buf, sizeof(buf), fmt, ap);
    va_end(ap);
    
    if (len > 0)
    {
        // 使用阻塞方式发送
        usart2_send_data_blocking((uint8_t *)buf, len);
    }
}

/**
 * @brief   ATK-MB026 UART重新开始接收数据
 */
void atk_mb026_uart_rx_restart(void)
{
    g_sta.len = 0;
    g_sta.finsh = 0;
}

/**
 * @brief   获取ATK-MB026 UART接收到的一帧数据
 * @return  NULL: 未接收到完整帧
 *          其他: 指向接收数据缓冲区的指针
 */
uint8_t *atk_mb026_uart_rx_get_frame(void)
{
    if (g_sta.finsh == 1)
    {
        g_uart_rx_frame[g_sta.len] = '\0';
        return g_uart_rx_frame;
    }
    else
    {
        return NULL;
    }
}

/**
 * @brief   获取ATK-MB026 UART接收到的一帧数据的长度
 * @return  接收到的一帧数据的长度
 */
uint16_t atk_mb026_uart_rx_get_frame_len(void)
{
    return g_sta.finsh ? g_sta.len : 0;
}

/**
 * @brief   ATK-MB026 UART初始化
 * @param   baudrate UART波特率
 */
void atk_mb026_uart_init(uint32_t baudrate)
{
    GPIO_InitTypeDef GPIO_InitStructure;
    NVIC_InitTypeDef NVIC_InitStructure;
    USART_InitTypeDef USART_InitStructure;
    TIM_TimeBaseInitTypeDef TIM_TimeBaseStructure;
    
    printf("[Serial Init] 开始初始化WiFi模块串口...\r\n");
    printf("[Serial Init] 目标串口: USART2\r\n");
    printf("[Serial Init] 波特率: %lu\r\n", baudrate);
    printf("[Serial Init] TX引脚: PA2\r\n");
    printf("[Serial Init] RX引脚: PA3\r\n");
    
    // 1. 配置时钟
    printf("[Serial Init] 1. 配置时钟...\r\n");
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA | RCC_APB2Periph_AFIO, ENABLE);
    RCC_APB1PeriphClockCmd(RCC_APB1Periph_USART2 | RCC_APB1Periph_TIM2, ENABLE);
    printf("[Serial Init]  - GPIOA时钟: 已启用\r\n");
    printf("[Serial Init]  - AFIO时钟: 已启用\r\n");
    printf("[Serial Init]  - USART2时钟: 已启用\r\n");
    printf("[Serial Init]  - TIM2时钟: 已启用\r\n");
    
    // 2. 配置USART2的TX和RX引脚
    printf("[Serial Init] 2. 配置引脚...\r\n");
    // TX引脚配置
    GPIO_InitStructure.GPIO_Pin = ATK_MB026_UART_TX_GPIO_PIN;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_AF_PP;
    GPIO_InitStructure.GPIO_Speed = GPIO_Speed_50MHz;
    GPIO_Init(ATK_MB026_UART_TX_GPIO_PORT, &GPIO_InitStructure);
    printf("[Serial Init]  - TX引脚(PA2): 复用推挽输出，50MHz\r\n");
    
    // RX引脚配置
    GPIO_InitStructure.GPIO_Pin = ATK_MB026_UART_RX_GPIO_PIN;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_IN_FLOATING;
    GPIO_Init(ATK_MB026_UART_RX_GPIO_PORT, &GPIO_InitStructure);
    printf("[Serial Init]  - RX引脚(PA3): 浮空输入\r\n");
    
    // 3. 配置USART2参数
    printf("[Serial Init] 3. 配置串口参数...\r\n");
    USART_InitStructure.USART_BaudRate = baudrate;
    USART_InitStructure.USART_WordLength = USART_WordLength_8b;
    USART_InitStructure.USART_StopBits = USART_StopBits_1;
    USART_InitStructure.USART_Parity = USART_Parity_No;
    USART_InitStructure.USART_HardwareFlowControl = USART_HardwareFlowControl_None;
    USART_InitStructure.USART_Mode = USART_Mode_Tx | USART_Mode_Rx;
    USART_Init(ATK_MB026_UART_INTERFACE, &USART_InitStructure);
    printf("[Serial Init]  - 波特率: %lu\r\n", baudrate);
    printf("[Serial Init]  - 数据位: 8位\r\n");
    printf("[Serial Init]  - 停止位: 1位\r\n");
    printf("[Serial Init]  - 校验位: 无\r\n");
    printf("[Serial Init]  - 流控制: 无\r\n");
    printf("[Serial Init]  - 模式: 收发模式\r\n");
    
    // 4. 配置USART2中断
    printf("[Serial Init] 4. 配置中断...\r\n");
    NVIC_InitStructure.NVIC_IRQChannel = ATK_MB026_UART_IRQn;
    NVIC_InitStructure.NVIC_IRQChannelPreemptionPriority = 1;
    NVIC_InitStructure.NVIC_IRQChannelSubPriority = 1;
    NVIC_InitStructure.NVIC_IRQChannelCmd = ENABLE;
    NVIC_Init(&NVIC_InitStructure);
    printf("[Serial Init]  - USART2中断: 已启用\r\n");
    printf("[Serial Init]  - 中断处理函数: USART2_IRQHandler\r\n");
    printf("[Serial Init]  - 抢占优先级: 1\r\n");
    printf("[Serial Init]  - 子优先级: 1\r\n");
    
    // 5. 启用USART2接收中断
    USART_ITConfig(ATK_MB026_UART_INTERFACE, USART_IT_RXNE, ENABLE);
    printf("[Serial Init] 5. 启用接收中断: 已启用\r\n");
    
    // 6. 启用USART2
    USART_Cmd(ATK_MB026_UART_INTERFACE, ENABLE);
    printf("[Serial Init] 6. 启用USART2: 已启用\r\n");
    
    // 7. 配置TIM2定时器，用于UART接收超时检测
    printf("[Serial Init] 7. 配置TIM2定时器...\r\n");
    // 增加超时时间到200ms（原来约83ms）
    TIM_TimeBaseStructure.TIM_Period = 240 - 1;      // 240 * (1/1200) = 200ms
    TIM_TimeBaseStructure.TIM_Prescaler = ATK_MB026_TIM_PRESCALER - 1;  // 72MHz/60000 = 1200Hz
    TIM_TimeBaseStructure.TIM_ClockDivision = TIM_CKD_DIV1;
    TIM_TimeBaseStructure.TIM_CounterMode = TIM_CounterMode_Up;
    TIM_TimeBaseInit(ATK_MB026_TIM_INTERFACE, &TIM_TimeBaseStructure);
    printf("[Serial Init]  - 定时器: TIM2\r\n");
    printf("[Serial Init]  - 预分频器: %d\r\n", ATK_MB026_TIM_PRESCALER - 1);
    printf("[Serial Init]  - 自动重装载值: 239\r\n");
    printf("[Serial Init]  - 超时时间: 200ms\r\n");
    
    // 8. 配置TIM2中断
    NVIC_InitStructure.NVIC_IRQChannel = ATK_MB026_TIM_IRQn;
    NVIC_InitStructure.NVIC_IRQChannelPreemptionPriority = 2;
    NVIC_InitStructure.NVIC_IRQChannelSubPriority = 1;
    NVIC_Init(&NVIC_InitStructure);
    TIM_ITConfig(ATK_MB026_TIM_INTERFACE, TIM_IT_Update, ENABLE);
    printf("[Serial Init] 8. 配置TIM2中断: 已启用\r\n");
    printf("[Serial Init]  - 抢占优先级: 2\r\n");
    printf("[Serial Init]  - 子优先级: 1\r\n");
    
    // 注意：不要在初始化时启用TIM2，应该在接收到第一个字节时再启用
    // TIM_Cmd(TIM2, ENABLE);  // 移除此行

    // 9. 初始化缓冲区
    g_sta.len = 0;
    g_sta.finsh = 0;
    tx_head = 0;
    tx_tail = 0;
    printf("[Serial Init] 9. 初始化缓冲区...\r\n");
    printf("[Serial Init]  - 接收缓冲区: 已清空\r\n");
    printf("[Serial Init]  - 发送缓冲区: 已清空\r\n");
    printf("[Serial Init] WiFi模块串口初始化完成！\r\n\r\n");
}

/**
 * @brief   USART2中断服务程序
 * @note    处理UART数据接收和发送
 */
void USART2_IRQHandler(void)
{
    uint8_t tmp;
    
    // 1. 处理溢出错误
    if (USART_GetITStatus(USART2, USART_IT_ORE) != RESET)
    {
        USART_ClearITPendingBit(USART2, USART_IT_ORE);
        (void)USART_ReceiveData(USART2);            // 读取DR寄存器以清除错误标志
    }
    
    // 2. 处理接收中断
    if (USART_GetITStatus(USART2, USART_IT_RXNE) != RESET)
    {
        tmp = USART_ReceiveData(USART2);
        
        // 注意：不要在中断中调用printf，会导致通过USART2发送时阻塞等待，引发死锁
        
        // 处理接收缓冲区
        if (g_sta.len < (ATK_MB026_UART_RX_BUF_SIZE - 1))
        {
            TIM_SetCounter(TIM2, 0);                // 重置定时器计数
            
            // 如果是第一个字节，开启定时器
            if (g_sta.len == 0)
            {
                TIM_Cmd(TIM2, ENABLE);
            }
            
            // 存储接收到的字节
            g_uart_rx_frame[g_sta.len] = tmp;
            g_sta.len++;
        }
        else
        {
            // 接收缓冲区满
            g_sta.len = 0;
            g_uart_rx_frame[g_sta.len] = tmp;
            g_sta.len++;
        }
    }
    
    // 3. 处理发送中断
    if (USART_GetITStatus(USART2, USART_IT_TXE) != RESET)
    {
        if (tx_head != tx_tail)
        {
            // 发送缓冲区中的数据
            USART_SendData(USART2, tx_buf[tx_tail]);
            tx_tail = (tx_tail + 1) % TX_BUF_SIZE;
        }
        else
        {
            // 发送缓冲区为空，关闭发送中断
            USART_ITConfig(USART2, USART_IT_TXE, DISABLE);
        }
    }
}

/**
 * @brief   TIM2中断服务程序
 * @note    处理UART接收超时
 */
void TIM2_IRQHandler(void)
{
    if (TIM_GetITStatus(TIM2, TIM_IT_Update) != RESET)
    {
        // 清除中断标志
        TIM_ClearITPendingBit(TIM2, TIM_IT_Update);
        
        // 关闭定时器
        TIM_Cmd(TIM2, DISABLE);
        
        // 设置帧接收完成标志
        g_sta.finsh = 1;
        
        // 移除对Serial2_ProcessResponse()的调用，因为该函数可能不存在
        // extern void Serial2_ProcessResponse(void);
        // Serial2_ProcessResponse();
    }
}

/**
 * @brief   通过USART2发送数据（非阻塞方式）
 * @param   data 要发送的数据
 * @param   len 数据长度
 */
void usart2_send_data(const uint8_t *data, uint16_t len)
{
    for (uint16_t i = 0; i < len; i++)
    {
        tx_buf[tx_head] = data[i];
        tx_head = (tx_head + 1) % TX_BUF_SIZE;
    }
    
    // 启用发送中断
    USART_ITConfig(USART2, USART_IT_TXE, ENABLE);
}

/**
 * @brief   等待发送完成
 */
void atk_mb026_uart_wait_tx_done(void)
{
    uint32_t timeout = 10000;  // 10秒超时
    
    while ((tx_head != tx_tail) && (timeout > 0))
    {
        timeout--;
        delay_ms(1);
    }
}

/**
 * @brief   通过USART2发送数据（阻塞方式）
 * @param   data 要发送的数据
 * @param   len 数据长度
 */
void usart2_send_data_blocking(const uint8_t *data, uint16_t len)
{
    for (uint16_t i = 0; i < len; i++)
    {
        // 等待发送缓冲区为空
        while (USART_GetFlagStatus(USART2, USART_FLAG_TXE) == RESET);
        
        // 发送一个字节
        USART_SendData(USART2, data[i]);
    }
    
    // 等待发送完成
    while (USART_GetFlagStatus(USART2, USART_FLAG_TC) == RESET);
}
