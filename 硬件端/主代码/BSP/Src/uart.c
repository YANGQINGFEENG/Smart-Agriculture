/**
 ****************************************************************************************************
 * @file        uart.c
 * @author      Embedded System Team
 * @version     V2.0.0
 * @date        2026-04-13
 * @brief       串口驱动实现 - DMA传输、环形缓冲区
 ****************************************************************************************************
 */

#include "uart.h"
#include <stdarg.h>
#include <stdio.h>
#include <string.h>

/* ==================================== 静态变量 ==================================== */

/* 调试串口缓冲区 */
static uint8_t g_debug_rx_buf[UART_RX_BUF_SIZE];
static uint8_t g_debug_tx_buf[UART_TX_BUF_SIZE];

/* WiFi串口缓冲区 */
static uint8_t g_wifi_rx_buf[UART_RX_BUF_SIZE];
static uint8_t g_wifi_tx_buf[UART_TX_BUF_SIZE];
static uint8_t g_wifi_dma_tx_buf[DMA_BUFFER_SIZE];

/* WiFi串口状态 */
static uart_state_t g_wifi_uart_state;

/* ==================================== 环形缓冲区实现 ==================================== */

void ring_buffer_init(ring_buffer_t *rb, uint8_t *buf, uint16_t size)
{
    rb->buf = buf;
    rb->size = size;
    rb->head = 0;
    rb->tail = 0;
}

uint16_t ring_buffer_write(ring_buffer_t *rb, const uint8_t *data, uint16_t len)
{
    uint16_t written = 0;
    uint16_t available;
    
    while (written < len) {
        available = ring_buffer_available_space(rb);
        if (available == 0) break;
        
        uint16_t to_write = (len - written) < available ? (len - written) : available;
        
        for (uint16_t i = 0; i < to_write; i++) {
            rb->buf[rb->head] = data[written + i];
            rb->head = (rb->head + 1) % rb->size;
        }
        written += to_write;
    }
    
    return written;
}

uint16_t ring_buffer_read(ring_buffer_t *rb, uint8_t *buf, uint16_t max_len)
{
    uint16_t read = 0;
    uint16_t available = ring_buffer_available_data(rb);
    
    uint16_t to_read = (max_len < available) ? max_len : available;
    
    for (uint16_t i = 0; i < to_read; i++) {
        buf[i] = rb->buf[rb->tail];
        rb->tail = (rb->tail + 1) % rb->size;
    }
    
    return to_read;
}

uint16_t ring_buffer_available_space(ring_buffer_t *rb)
{
    if (rb->head >= rb->tail) {
        return rb->size - (rb->head - rb->tail) - 1;
    } else {
        return rb->tail - rb->head - 1;
    }
}

uint16_t ring_buffer_available_data(ring_buffer_t *rb)
{
    if (rb->head >= rb->tail) {
        return rb->head - rb->tail;
    } else {
        return rb->size - (rb->tail - rb->head);
    }
}

void ring_buffer_flush(ring_buffer_t *rb)
{
    rb->head = 0;
    rb->tail = 0;
}

/* ==================================== 调试串口实现 ==================================== */

void debug_uart_init(void)
{
    GPIO_InitTypeDef GPIO_InitStructure;
    USART_InitTypeDef USART_InitStructure;
    NVIC_InitTypeDef NVIC_InitStructure;
    
    /* 使能时钟 */
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_USART1 | RCC_APB2Periph_GPIOA, ENABLE);
    
    /* 配置TX引脚 */
    GPIO_InitStructure.GPIO_Pin = GPIO_Pin_9;
    GPIO_InitStructure.GPIO_Speed = GPIO_Speed_50MHz;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_AF_PP;
    GPIO_Init(GPIOA, &GPIO_InitStructure);
    
    /* 配置RX引脚 */
    GPIO_InitStructure.GPIO_Pin = GPIO_Pin_10;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_IN_FLOATING;
    GPIO_Init(GPIOA, &GPIO_InitStructure);
    
    /* 配置USART */
    USART_InitStructure.USART_BaudRate = DEBUG_USART_BAUDRATE;
    USART_InitStructure.USART_WordLength = USART_WordLength_8b;
    USART_InitStructure.USART_StopBits = USART_StopBits_1;
    USART_InitStructure.USART_Parity = USART_Parity_No;
    USART_InitStructure.USART_HardwareFlowControl = USART_HardwareFlowControl_None;
    USART_InitStructure.USART_Mode = USART_Mode_Rx | USART_Mode_Tx;
    USART_Init(USART1, &USART_InitStructure);
    
    /* 使能USART */
    USART_Cmd(USART1, ENABLE);
    
    /* 配置中断 */
    NVIC_InitStructure.NVIC_IRQChannel = USART1_IRQn;
    NVIC_InitStructure.NVIC_IRQChannelPreemptionPriority = 3;
    NVIC_InitStructure.NVIC_IRQChannelSubPriority = 3;
    NVIC_InitStructure.NVIC_IRQChannelCmd = ENABLE;
    NVIC_Init(&NVIC_InitStructure);
    
    USART_ITConfig(USART1, USART_IT_RXNE, ENABLE);
}

void debug_uart_send_byte(uint8_t ch)
{
    while ((USART1->SR & USART_FLAG_TXE) == 0);
    USART1->DR = ch;
}

void debug_uart_send_string(const char *str)
{
    while (*str) {
        debug_uart_send_byte((uint8_t)*str++);
    }
}

void debug_uart_printf(const char *fmt, ...)
{
    char buf[128];
    va_list ap;
    
    va_start(ap, fmt);
    vsnprintf(buf, sizeof(buf), fmt, ap);
    va_end(ap);
    
    debug_uart_send_string(buf);
}

/* ==================================== WiFi串口实现 ==================================== */

static void wifi_uart_dma_start(void);

void wifi_uart_init(void)
{
    GPIO_InitTypeDef GPIO_InitStructure;
    USART_InitTypeDef USART_InitStructure;
    DMA_InitTypeDef DMA_InitStructure;
    NVIC_InitTypeDef NVIC_InitStructure;
    
    /* 初始化状态结构 */
    ring_buffer_init(&g_wifi_uart_state.rx_ring, g_wifi_rx_buf, UART_RX_BUF_SIZE);
    ring_buffer_init(&g_wifi_uart_state.tx_ring, g_wifi_tx_buf, UART_TX_BUF_SIZE);
    g_wifi_uart_state.tx_dma_active = 0;
    g_wifi_uart_state.dma_tx_buf = g_wifi_dma_tx_buf;
    
    /* 使能时钟 */
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOB | RCC_APB2Periph_AFIO, ENABLE);
    RCC_APB1PeriphClockCmd(RCC_APB1Periph_USART3 | RCC_AHBPeriph_DMA1, ENABLE);
    
    /* 配置TX引脚 */
    GPIO_InitStructure.GPIO_Pin = GPIO_Pin_10;
    GPIO_InitStructure.GPIO_Speed = GPIO_Speed_50MHz;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_AF_PP;
    GPIO_Init(GPIOB, &GPIO_InitStructure);
    
    /* 配置RX引脚 */
    GPIO_InitStructure.GPIO_Pin = GPIO_Pin_11;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_IN_FLOATING;
    GPIO_Init(GPIOB, &GPIO_InitStructure);
    
    /* 配置USART */
    USART_InitStructure.USART_BaudRate = WIFI_USART_BAUDRATE;
    USART_InitStructure.USART_WordLength = USART_WordLength_8b;
    USART_InitStructure.USART_StopBits = USART_StopBits_1;
    USART_InitStructure.USART_Parity = USART_Parity_No;
    USART_InitStructure.USART_HardwareFlowControl = USART_HardwareFlowControl_None;
    USART_InitStructure.USART_Mode = USART_Mode_Rx | USART_Mode_Tx;
    USART_Init(USART3, &USART_InitStructure);
    
    /* 配置DMA TX */
    DMA_DeInit(DMA1_Channel2);
    DMA_InitStructure.DMA_PeripheralBaseAddr = (uint32_t)&USART3->DR;
    DMA_InitStructure.DMA_MemoryBaseAddr = (uint32_t)g_wifi_dma_tx_buf;
    DMA_InitStructure.DMA_DIR = DMA_DIR_PeripheralDST;
    DMA_InitStructure.DMA_BufferSize = 0;
    DMA_InitStructure.DMA_PeripheralInc = DMA_PeripheralInc_Disable;
    DMA_InitStructure.DMA_MemoryInc = DMA_MemoryInc_Enable;
    DMA_InitStructure.DMA_PeripheralDataSize = DMA_PeripheralDataSize_Byte;
    DMA_InitStructure.DMA_MemoryDataSize = DMA_MemoryDataSize_Byte;
    DMA_InitStructure.DMA_Mode = DMA_Mode_Normal;
    DMA_InitStructure.DMA_Priority = DMA_Priority_High;
    DMA_InitStructure.DMA_M2M = DMA_M2M_Disable;
    DMA_Init(DMA1_Channel2, &DMA_InitStructure);
    
    USART_DMACmd(USART3, USART_DMAReq_Tx, ENABLE);
    
    /* 配置USART中断 */
    NVIC_InitStructure.NVIC_IRQChannel = USART3_IRQn;
    NVIC_InitStructure.NVIC_IRQChannelPreemptionPriority = 1;
    NVIC_InitStructure.NVIC_IRQChannelSubPriority = 1;
    NVIC_InitStructure.NVIC_IRQChannelCmd = ENABLE;
    NVIC_Init(&NVIC_InitStructure);
    
    /* 配置DMA中断 */
    NVIC_InitStructure.NVIC_IRQChannel = DMA1_Channel2_IRQn;
    NVIC_InitStructure.NVIC_IRQChannelPreemptionPriority = 1;
    NVIC_InitStructure.NVIC_IRQChannelSubPriority = 0;
    NVIC_Init(&NVIC_InitStructure);
    DMA_ITConfig(DMA1_Channel2, DMA_IT_TC, ENABLE);
    
    USART_ITConfig(USART3, USART_IT_RXNE, ENABLE);
    USART_Cmd(USART3, ENABLE);
}

static void wifi_uart_dma_start(void)
{
    if (g_wifi_uart_state.tx_dma_active) {
        return;
    }
    
    uint16_t available = ring_buffer_available_data(&g_wifi_uart_state.tx_ring);
    if (available == 0) {
        return;
    }
    
    uint16_t to_send = (available < DMA_BUFFER_SIZE) ? available : DMA_BUFFER_SIZE;
    
    /* 从环形缓冲区读取数据到DMA缓冲区 */
    ring_buffer_read(&g_wifi_uart_state.tx_ring, g_wifi_uart_state.dma_tx_buf, to_send);
    
    /* 配置并启动DMA */
    DMA_Cmd(DMA1_Channel2, DISABLE);
    DMA_SetCurrDataCounter(DMA1_Channel2, to_send);
    g_wifi_uart_state.tx_dma_active = 1;
    DMA_Cmd(DMA1_Channel2, ENABLE);
}

sys_error_t wifi_uart_send(const uint8_t *data, uint16_t len)
{
    uint16_t written = ring_buffer_write(&g_wifi_uart_state.tx_ring, data, len);
    
    if (written < len) {
        return SYS_NO_MEMORY;
    }
    
    if (!g_wifi_uart_state.tx_dma_active) {
        wifi_uart_dma_start();
    }
    
    return SYS_OK;
}

sys_error_t wifi_uart_send_string(const char *str)
{
    return wifi_uart_send((const uint8_t *)str, strlen(str));
}

sys_error_t wifi_uart_printf(const char *fmt, ...)
{
    char buf[128];
    va_list ap;
    
    va_start(ap, fmt);
    int len = vsnprintf(buf, sizeof(buf), fmt, ap);
    va_end(ap);
    
    if (len <= 0) {
        return SYS_ERROR;
    }
    
    return wifi_uart_send((const uint8_t *)buf, len);
}

uint16_t wifi_uart_receive(uint8_t *buf, uint16_t max_len)
{
    return ring_buffer_read(&g_wifi_uart_state.rx_ring, buf, max_len);
}

uint16_t wifi_uart_available(void)
{
    return ring_buffer_available_data(&g_wifi_uart_state.rx_ring);
}

void wifi_uart_rx_flush(void)
{
    ring_buffer_flush(&g_wifi_uart_state.rx_ring);
}

uint16_t wifi_uart_get_frame(uint8_t *buf, uint16_t buf_size, uint32_t timeout)
{
    tick_t start = sys_get_tick();
    uint16_t idx = 0;
    
    while (!sys_is_timed_out(start, timeout)) {
        if (wifi_uart_available() > 0) {
            uint8_t ch;
            wifi_uart_receive(&ch, 1);
            
            if (idx < buf_size - 1) {
                buf[idx++] = ch;
            }
            
            /* 简单的帧检测：检测换行或超时 */
            if (ch == '\n') {
                buf[idx] = '\0';
                return idx;
            }
        }
    }
    
    /* 超时，但可能有部分数据 */
    if (idx > 0) {
        buf[idx] = '\0';
    }
    
    return idx;
}

/* ==================================== 中断处理函数 ==================================== */

void USART1_IRQHandler(void)
{
    if (USART_GetITStatus(USART1, USART_IT_RXNE) != RESET) {
        (void)USART_ReceiveData(USART1);
        USART_ClearITPendingBit(USART1, USART_IT_RXNE);
    }
}

void USART3_IRQHandler(void)
{
    if (USART_GetITStatus(USART3, USART_IT_ORE) != RESET) {
        USART_ClearITPendingBit(USART3, USART_IT_ORE);
        (void)USART_ReceiveData(USART3);
    }
    
    if (USART_GetITStatus(USART3, USART_IT_RXNE) != RESET) {
        uint8_t ch = USART_ReceiveData(USART3);
        ring_buffer_write(&g_wifi_uart_state.rx_ring, &ch, 1);
    }
}

void DMA1_Channel2_IRQHandler(void)
{
    if (DMA_GetITStatus(DMA1_IT_TC2) != RESET) {
        DMA_ClearITPendingBit(DMA1_IT_TC2);
        
        g_wifi_uart_state.tx_dma_active = 0;
        
        /* 检查是否还有数据需要发送 */
        if (ring_buffer_available_data(&g_wifi_uart_state.tx_ring) > 0) {
            wifi_uart_dma_start();
        }
    }
}
