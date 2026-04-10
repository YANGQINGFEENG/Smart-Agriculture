/**
 ****************************************************************************************************
 * @file        atk_mb026_uart.c
 * @author      ʺ���������\(ALIENTEK)
 * @version     V1.0
 * @date        2024-11-28
 * @brief       ATK-MB026 UART�����g������
 * @license     Copyright (c) 2020-2032, ���nƫ���ɸF���H���͌�����
 ****************************************************************************************************
 * @attention
 *
 * �S�΍g�:ʺ������ M48Z-M3�|�o����ҽSTM32F103��
 * ��?ƪײ:www.yuanzige.com
 * �ұ�̥��:www.openedv.com
 * �������{:www.alientek.com
 * ���k���{:openedv.taobao.com
 *
 ****************************************************************************************************
 */

#include "atk_mb026_uart.h"
#include "delay.h"
#include "RS485.h"
#include <stdarg.h>
#include <stdio.h>
#include <string.h>

/* �f�ȿ߃W�b���ؼďo */
#define TX_BUF_SIZE 128

/* UART���x�b�� */
uint8_t g_uart_rx_frame[ATK_MB026_UART_RX_BUF_SIZE];
/* UART���򝙸��� */
struct {
    uint16_t len    : 15;  /* ���x���h���󺣘I?sta[14:0] */
    uint16_t finsh  : 1;   /* ���x�m���׍�?sta[15] */
} g_sta;

/* �߃W�b���زōyį */
uint8_t tx_buf[TX_BUF_SIZE];
volatile uint16_t tx_head = 0;
volatile uint16_t tx_tail = 0;

/* �f�������ɹ������ */
TIM_TimeBaseInitTypeDef  TIM_TimeBaseStructure;
/* USART����ɹ������ */
extern USART_InitTypeDef USART_InitStructure;
/* GPIO����ɹ������ */
extern GPIO_InitTypeDef GPIO_InitStructure;
/* NVIC����ɹ������ */
extern NVIC_InitTypeDef NVIC_InitStructure;

/**
 * @brief       ATK-MB026 UART printf�۷�
 * @param       fmt: ���Bɹ�⑗��
 * @retval      ��
 */
void atk_mb026_uart_printf(char *fmt, ...)
{
    va_list ap;
    char buf[128];
    uint16_t len;
    
    va_start(ap, fmt);
    len = vsnprintf(buf, sizeof(buf), fmt, ap);
    va_end(ap);
    
    if (len > 0) {
        // ��������ؿ߃W�b����
        for (uint16_t i = 0; i < len; i++) {
            tx_buf[tx_head] = buf[i];
            tx_head = (tx_head + 1) % TX_BUF_SIZE;
        }
        
        // �ᴭ�߃W��H
        USART_ITConfig(ATK_MB026_UART_INTERFACE, USART_IT_TXE, ENABLE);
    }
}

/**
 * @brief       ATK-MB026 UART��Ǫ�g�����x����
 * @param       ��
 * @retval      ��
 */
void atk_mb026_uart_rx_restart(void)
{
    g_sta.len = 0;
    g_sta.finsh = 0;
}

/**
 * @brief       �Y��ATK-MB026 UART���x���h�R�췽��
 * @param       ��
 * @retval      NULL: ¡���x���mƨ������
 *              �M�O: �y�D���x���h����b����
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
 * @brief       �Y��ATK-MB026 UART���x���h�������h���I
 * @param       ��
 * @retval      ���x���h�������h���I
 */
uint16_t atk_mb026_uart_rx_get_frame_len(void)
{
    return g_sta.finsh ? g_sta.len : 0;
}

/**
 * @brief       ATK-MB026 UART����ɹ
 * @param       baudrate: UART嶃��\�ɗ�
 * @retval      ��
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
    
    // 1. ������细打印时钟配置
    printf("[Serial Init] 1. 配置时钟...\r\n");
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA | RCC_APB2Periph_AFIO, ENABLE);
    RCC_APB1PeriphClockCmd(RCC_APB1Periph_USART2 | RCC_APB1Periph_TIM2, ENABLE);
    printf("[Serial Init]  - GPIOA时钟: 已启用\r\n");
    printf("[Serial Init]  - AFIO时钟: 已启用\r\n");
    printf("[Serial Init]  - USART2时钟: 已启用\r\n");
    printf("[Serial Init]  - TIM2时钟: 已启用\r\n");
    
    // 2. ����USART2���筨细打印引脚配置
    printf("[Serial Init] 2. 配置引脚...\r\n");
    // TX��������
    GPIO_InitStructure.GPIO_Pin = ATK_MB026_UART_TX_GPIO_PIN;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_AF_PP;
    GPIO_InitStructure.GPIO_Speed = GPIO_Speed_50MHz;
    GPIO_Init(ATK_MB026_UART_TX_GPIO_PORT, &GPIO_InitStructure);
    printf("[Serial Init]  - TX引脚(PA2): 复用推挽输出，50MHz\r\n");
    
    // RX��������
    GPIO_InitStructure.GPIO_Pin = ATK_MB026_UART_RX_GPIO_PIN;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_IN_FLOATING;
    GPIO_Init(ATK_MB026_UART_RX_GPIO_PORT, &GPIO_InitStructure);
    printf("[Serial Init]  - RX引脚(PA3): 浮空输入\r\n");
    
    // 3. ����USART2�跽��细打印串口配置
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
    
    // 4. ����USART2��H��细打印中断配置
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
    
    // 5. ��USART2���x��H
    USART_ITConfig(ATK_MB026_UART_INTERFACE, USART_IT_RXNE, ENABLE);
    printf("[Serial Init] 5. 启用接收中断: 已启用\r\n");
    
    // 6. ��USART2
    USART_Cmd(ATK_MB026_UART_INTERFACE, ENABLE);
    printf("[Serial Init] 6. 启用USART2: 已启用\r\n");
    
    // 7. 配置TIM2定时器，用于UART接收超时检测
    printf("[Serial Init] 7. 配置TIM2定时器...\r\n");
    // 增加超时时间到200ms（原来约83ms）
    TIM_TimeBaseStructure.TIM_Period = 240 - 1;  // 240 * (1/1200) = 200ms
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

		
		
    // ����ɹ�������ӳ��细打印初始化完成
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
 * @brief USART2�жϷ�����
 * @note ����UART���ݽ��պͷ���
 */
void USART2_IRQHandler(void)
{
    uint8_t tmp;
    
    /* 1. �������ش��� */
    if (USART_GetITStatus(USART2, USART_IT_ORE) != RESET)
    {
        USART_ClearITPendingBit(USART2, USART_IT_ORE);
        (void)USART_ReceiveData(USART2); // ��ȡDR�Ĵ�����������־
    }
    
    /* 2. 处理接收中断 */
    if (USART_GetITStatus(USART2, USART_IT_RXNE) != RESET)
    {
        tmp = USART_ReceiveData(USART2);
        
        /* 注意：不要在中断中调用printf，会导致通过USART2发送时阻塞等待，引发死锁 */
        
        /* 处理接收缓冲区 */
        if (g_sta.len < (ATK_MB026_UART_RX_BUF_SIZE - 1))
        {
            TIM_SetCounter(TIM2, 0); // 重置定时器计数
            
            /* 如果是第一个字节，开启定时器 */
            if (g_sta.len == 0)
            {
                TIM_Cmd(TIM2, ENABLE);
            }
            
            /* 存储接收到的字节 */
            g_uart_rx_frame[g_sta.len] = tmp;
            g_sta.len++;
        }
        else
        {
            /* 接收缓冲区满 */
            g_sta.len = 0;
            g_uart_rx_frame[g_sta.len] = tmp;
            g_sta.len++;
        }
    }
    
    /* 3. ���������ж� */
    if (USART_GetITStatus(USART2, USART_IT_TXE) != RESET)
    {
        if (tx_head != tx_tail)
        {
            /* ���ͻ������е����� */
            USART_SendData(USART2, tx_buf[tx_tail]);
            tx_tail = (tx_tail + 1) % TX_BUF_SIZE;
        }
        else
        {
            /* ���ͻ�����Ϊ�գ����÷����ж� */
            USART_ITConfig(USART2, USART_IT_TXE, DISABLE);
        }
    }
}

/**
 * @brief TIM2�жϷ�����
 * @note ����UART���ճ�ʱ
 */
void TIM2_IRQHandler(void)
{
    if (TIM_GetITStatus(TIM2, TIM_IT_Update) != RESET)
    {
        /* 清除中断标志 */
        TIM_ClearITPendingBit(TIM2, TIM_IT_Update);
        
        /* 关闭定时器 */
        TIM_Cmd(TIM2, DISABLE);
        
        /* 设置帧接收完成标志 */
        g_sta.finsh = 1;
        
        /* 移除对Serial2_ProcessResponse()的调用，因为该函数可能不存在 */
        // extern void Serial2_ProcessResponse(void);
        // Serial2_ProcessResponse();
    }
}

/**
 * @brief ͨ��USART2�������ݣ���������
 * @param data Ҫ���͵�����
 * @param len ���ݳ���
 */
void usart2_send_data(const uint8_t *data, uint16_t len)
{
    for (uint16_t i = 0; i < len; i++) {
        tx_buf[tx_head] = data[i];
        tx_head = (tx_head + 1) % TX_BUF_SIZE;
    }
    
    // ���÷����ж�
    USART_ITConfig(USART2, USART_IT_TXE, ENABLE);
}



