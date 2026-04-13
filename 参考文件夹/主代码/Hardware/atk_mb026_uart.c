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
        USART_ITConfig(USART3, USART_IT_TXE, ENABLE);
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
    
    // 1. �����
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOB | RCC_APB2Periph_AFIO, ENABLE);
    RCC_APB1PeriphClockCmd(RCC_APB1Periph_USART3 | RCC_APB1Periph_TIM2, ENABLE);
    
    // 2. ����USART3���� (PB10: TX, PB11: RX)
    // TX��������
    GPIO_InitStructure.GPIO_Pin = ATK_MB026_UART_TX_GPIO_PIN;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_AF_PP;
    GPIO_InitStructure.GPIO_Speed = GPIO_Speed_50MHz;
    GPIO_Init(ATK_MB026_UART_TX_GPIO_PORT, &GPIO_InitStructure);
    
    // RX��������
    GPIO_InitStructure.GPIO_Pin = ATK_MB026_UART_RX_GPIO_PIN;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_IN_FLOATING;
    GPIO_Init(ATK_MB026_UART_RX_GPIO_PORT, &GPIO_InitStructure);
    
    // 3. ����USART3�跽
    USART_InitStructure.USART_BaudRate = baudrate;
    USART_InitStructure.USART_WordLength = USART_WordLength_8b;
    USART_InitStructure.USART_StopBits = USART_StopBits_1;
    USART_InitStructure.USART_Parity = USART_Parity_No;
    USART_InitStructure.USART_HardwareFlowControl = USART_HardwareFlowControl_None;
    USART_InitStructure.USART_Mode = USART_Mode_Tx | USART_Mode_Rx;
    USART_Init(ATK_MB026_UART_INTERFACE, &USART_InitStructure);
    
    // 4. ����USART3��H
    NVIC_InitStructure.NVIC_IRQChannel = ATK_MB026_UART_IRQn;
    NVIC_InitStructure.NVIC_IRQChannelPreemptionPriority = 1;
    NVIC_InitStructure.NVIC_IRQChannelSubPriority = 1;
    NVIC_InitStructure.NVIC_IRQChannelCmd = ENABLE;
    NVIC_Init(&NVIC_InitStructure);
    
    // 5. ��USART3���x��H
    USART_ITConfig(ATK_MB026_UART_INTERFACE, USART_IT_RXNE, ENABLE);
    
    // 6. ��USART3
    USART_Cmd(ATK_MB026_UART_INTERFACE, ENABLE);
    
    // 7. ���ޅf���TIM2���r���x�A����ϼ
    TIM_TimeBaseStructure.TIM_Period = 100 - 1;
    TIM_TimeBaseStructure.TIM_Prescaler = ATK_MB026_TIM_PRESCALER - 1;
    TIM_TimeBaseStructure.TIM_ClockDivision = TIM_CKD_DIV1;
    TIM_TimeBaseStructure.TIM_CounterMode = TIM_CounterMode_Up;
    TIM_TimeBaseInit(ATK_MB026_TIM_INTERFACE, &TIM_TimeBaseStructure);
    
    // 8. ����TIM2��H
    NVIC_InitStructure.NVIC_IRQChannel = ATK_MB026_TIM_IRQn;
    NVIC_InitStructure.NVIC_IRQChannelPreemptionPriority = 2;
    NVIC_InitStructure.NVIC_IRQChannelSubPriority = 1;
    NVIC_Init(&NVIC_InitStructure);
    TIM_ITConfig(ATK_MB026_TIM_INTERFACE, TIM_IT_Update, ENABLE);
    
		TIM_OCInitTypeDef TIM_OCInitStructure;
		TIM_OCStructInit(&TIM_OCInitStructure);
		TIM_OCInitStructure.TIM_OCMode = TIM_OCMode_PWM1;
		TIM_OCInitStructure.TIM_OCPolarity = TIM_OCPolarity_High;
		TIM_OCInitStructure.TIM_OutputState = TIM_OutputState_Enable;
		TIM_OCInitStructure.TIM_Pulse = 0;		//CCR
		TIM_OC1Init(TIM2, &TIM_OCInitStructure);
		
		TIM_Cmd(TIM2, ENABLE);

		
		
    // ����ɹ�������ӳ�
    g_sta.len = 0;
    g_sta.finsh = 0;
    tx_head = 0;
    tx_tail = 0;
}


/**
 * @brief USART3�жϷ�����
 * @note ����UART���ݽ��պͷ���
 */
void USART3_IRQHandler(void)
{
    uint8_t tmp;
    
    /* 1. �������ش��� */
    if (USART_GetITStatus(USART3, USART_IT_ORE) != RESET)
    {
        USART_ClearITPendingBit(USART3, USART_IT_ORE);
        (void)USART_ReceiveData(USART3); // ��ȡDR�Ĵ�����������־
    }
    
    /* 2. ���������ж� */
    if (USART_GetITStatus(USART3, USART_IT_RXNE) != RESET)
    {
        tmp = USART_ReceiveData(USART3);
        
        /* ��黺�����ռ� */
        if (g_sta.len < (ATK_MB026_UART_RX_BUF_SIZE - 1))
        {
            TIM_SetCounter(TIM2, 0); // ���ó�ʱ��ʱ��
            
            /* ����ǵ�һ���ֽڣ�������ʱ��ʱ�� */
            if (g_sta.len == 0)
            {
                TIM_Cmd(TIM2, ENABLE);
            }
            
            /* �洢���յ����ֽ� */
            g_uart_rx_frame[g_sta.len] = tmp;
            g_sta.len++;
        }
        else
        {
            /* ������������� */
            g_sta.len = 0;
            g_uart_rx_frame[g_sta.len] = tmp;
            g_sta.len++;
        }
    }
    
    /* 3. ���������ж� */
    if (USART_GetITStatus(USART3, USART_IT_TXE) != RESET)
    {
        if (tx_head != tx_tail)
        {
            /* ���ͻ������е����� */
            USART_SendData(USART3, tx_buf[tx_tail]);
            tx_tail = (tx_tail + 1) % TX_BUF_SIZE;
        }
        else
        {
            /* ���ͻ�����Ϊ�գ����÷����ж� */
            USART_ITConfig(USART3, USART_IT_TXE, DISABLE);
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
        /* ����жϱ�־ */
        TIM_ClearITPendingBit(TIM2, TIM_IT_Update);
        
        /* ���ö�ʱ�� */
        TIM_Cmd(TIM2, DISABLE);
        
        /* ����֡������ɱ�־ */
        g_sta.finsh = 1;
        
        /* ��ѡ�����������������ϱ� */
        static uint8_t report_counter = 0;
        report_counter++;
        if (report_counter >= 40) {
            report_counter = 0;
            // �������������ϱ��߼�
        }
    }
}

/**
 * @brief ͨ��USART3�������ݣ���������
 * @param data Ҫ���͵�����
 * @param len ���ݳ���
 */
void usart3_send_data(const uint8_t *data, uint16_t len)
{
    for (uint16_t i = 0; i < len; i++) {
        tx_buf[tx_head] = data[i];
        tx_head = (tx_head + 1) % TX_BUF_SIZE;
    }
    
    // ���÷����ж�
    USART_ITConfig(USART3, USART_IT_TXE, ENABLE);
}



