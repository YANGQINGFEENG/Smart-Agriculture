/**
 ****************************************************************************************************
 * @file        uart.h
 * @author      Embedded System Team
 * @version     V2.0.0
 * @date        2026-04-13
 * @brief       串口驱动头文件 - 支持DMA传输、环形缓冲区
 ****************************************************************************************************
 */

#ifndef __UART_H
#define __UART_H

#include "stm32f10x.h"
#include "sys_config.h"
#include "system.h"

#ifdef __cplusplus
extern "C" {
#endif

/* ==================================== 类型定义 ==================================== */

/* 环形缓冲区结构 */
typedef struct {
    uint8_t *buf;
    uint16_t size;
    volatile uint16_t head;
    volatile uint16_t tail;
} ring_buffer_t;

/* 串口状态结构 */
typedef struct {
    ring_buffer_t rx_ring;
    ring_buffer_t tx_ring;
    volatile uint8_t tx_dma_active;
    uint8_t *dma_tx_buf;
} uart_state_t;

/* ==================================== 函数声明 - 调试串口 ==================================== */

/**
 * @brief  初始化调试串口
 * @retval 无
 */
void debug_uart_init(void);

/**
 * @brief  调试串口发送一个字节
 * @param  ch: 要发送的字节
 * @retval 无
 */
void debug_uart_send_byte(uint8_t ch);

/**
 * @brief  调试串口发送字符串
 * @param  str: 要发送的字符串
 * @retval 无
 */
void debug_uart_send_string(const char *str);

/**
 * @brief  调试串口printf函数
 * @param  fmt: 格式化字符串
 * @retval 无
 */
void debug_uart_printf(const char *fmt, ...);

/* ==================================== 函数声明 - WiFi串口 ==================================== */

/**
 * @brief  初始化WiFi串口（带DMA）
 * @retval 无
 */
void wifi_uart_init(void);

/**
 * @brief  WiFi串口发送数据（非阻塞）
 * @param  data: 数据指针
 * @param  len: 数据长度
 * @retval SYS_OK: 成功
 */
sys_error_t wifi_uart_send(const uint8_t *data, uint16_t len);

/**
 * @brief  WiFi串口发送字符串（非阻塞）
 * @param  str: 字符串
 * @retval SYS_OK: 成功
 */
sys_error_t wifi_uart_send_string(const char *str);

/**
 * @brief  WiFi串口printf函数（非阻塞）
 * @param  fmt: 格式化字符串
 * @retval SYS_OK: 成功
 */
sys_error_t wifi_uart_printf(const char *fmt, ...);

/**
 * @brief  从WiFi串口读取数据
 * @param  buf: 接收缓冲区
 * @param  max_len: 最大读取长度
 * @retval 实际读取的字节数
 */
uint16_t wifi_uart_receive(uint8_t *buf, uint16_t max_len);

/**
 * @brief  检查WiFi串口是否有可读数据
 * @retval 可读数据字节数
 */
uint16_t wifi_uart_available(void);

/**
 * @brief  清空WiFi串口接收缓冲区
 * @retval 无
 */
void wifi_uart_rx_flush(void);

/**
 * @brief  等待并获取完整的AT命令响应帧
 * @param  buf: 输出缓冲区
 * @param  buf_size: 缓冲区大小
 * @param  timeout: 超时时间（毫秒）
 * @retval 帧长度，0表示超时
 */
uint16_t wifi_uart_get_frame(uint8_t *buf, uint16_t buf_size, uint32_t timeout);

/* ==================================== 函数声明 - 环形缓冲区 ==================================== */

/**
 * @brief  初始化环形缓冲区
 * @param  rb: 环形缓冲区指针
 * @param  buf: 数据缓冲区
 * @param  size: 缓冲区大小
 * @retval 无
 */
void ring_buffer_init(ring_buffer_t *rb, uint8_t *buf, uint16_t size);

/**
 * @brief  向环形缓冲区写入数据
 * @param  rb: 环形缓冲区指针
 * @param  data: 数据指针
 * @param  len: 数据长度
 * @retval 实际写入的字节数
 */
uint16_t ring_buffer_write(ring_buffer_t *rb, const uint8_t *data, uint16_t len);

/**
 * @brief  从环形缓冲区读取数据
 * @param  rb: 环形缓冲区指针
 * @param  buf: 输出缓冲区
 * @param  max_len: 最大读取长度
 * @retval 实际读取的字节数
 */
uint16_t ring_buffer_read(ring_buffer_t *rb, uint8_t *buf, uint16_t max_len);

/**
 * @brief  获取环形缓冲区可用空间
 * @param  rb: 环形缓冲区指针
 * @retval 可用空间字节数
 */
uint16_t ring_buffer_available_space(ring_buffer_t *rb);

/**
 * @brief  获取环形缓冲区数据量
 * @param  rb: 环形缓冲区指针
 * @retval 数据字节数
 */
uint16_t ring_buffer_available_data(ring_buffer_t *rb);

/**
 * @brief  清空环形缓冲区
 * @param  rb: 环形缓冲区指针
 * @retval 无
 */
void ring_buffer_flush(ring_buffer_t *rb);

#ifdef __cplusplus
}
#endif

#endif
