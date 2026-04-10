/**
 ****************************************************************************************************
 * @file        atk_mb026.c
 * @author      ����ԭ���Ŷ�(ALIENTEK)
 * @version     V1.0
 * @date        2024-11-28
 * @brief       ATK_MB026ģ����������
 * @license     Copyright (c) 2020-2032, �������������ӿƼ����޹�˾
 ****************************************************************************************************
 * @attention
 *
 * ʵ��ƽ̨:����ԭ�� M48Z-M3��Сϵͳ��STM32F103��
 * ������Ƶ:www.yuanzige.com
 * ������̳:www.openedv.com
 * ��˾��ַ:www.alientek.com
 * �����ַ:openedv.taobao.com
 *
 ****************************************************************************************************
 */

#include "atk_mb026.h"
#include "delay.h"

static void atk_mb026_hw_init(void)
{
    GPIO_InitTypeDef GPIO_InitStructure;

    RCC_APB2PeriphClockCmd(ATK_MB026_RST_GPIO_CLK, ENABLE);

    GPIO_InitStructure.GPIO_Pin = ATK_MB026_RST_GPIO_PIN;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_Out_PP;
    GPIO_InitStructure.GPIO_Speed = GPIO_Speed_50MHz;
    GPIO_Init(ATK_MB026_RST_GPIO_PORT, &GPIO_InitStructure);
}

void atk_mb026_hw_reset(void)
{
    ATK_MB026_RST(0);
    delay_ms(100);
    ATK_MB026_RST(1);
    delay_ms(500);
}

uint8_t atk_mb026_send_at_cmd(char *cmd, char *ack, uint32_t timeout)
{
    uint8_t *ret = NULL;

    atk_mb026_uart_rx_restart();
    atk_mb026_uart_printf("%s\r\n", cmd);

    if ((ack == NULL) || (timeout == 0))
    {
        return ATK_MB026_EOK;
    }
    else
    {
        while (timeout > 0)
        {
            ret = atk_mb026_uart_rx_get_frame();
            if (ret != NULL)
            {
                if (strstr((const char *)ret, ack) != NULL)
                {
                    return ATK_MB026_EOK;
                }
                else
                {
                    atk_mb026_uart_rx_restart();
                }
            }
            timeout--;
            delay_ms(1);
        }

        return ATK_MB026_ETIMEOUT;
    }
}

uint8_t atk_mb026_init(uint32_t baudrate)
{
    atk_mb026_hw_init();
    atk_mb026_hw_reset();
    atk_mb026_uart_init(baudrate);

    if (atk_mb026_at_test() != ATK_MB026_EOK)
    {
        return ATK_MB026_ERROR;
    }

    return ATK_MB026_EOK;
}

uint8_t atk_mb026_restore(void)
{
    uint8_t ret;

    ret = atk_mb026_send_at_cmd("AT+RESTORE", "ready", 3000);

    if (ret == ATK_MB026_EOK)
    {
        return ATK_MB026_EOK;
    }
    else
    {
        return ATK_MB026_ERROR;
    }
}

uint8_t atk_mb026_at_test(void)
{
    uint8_t ret;
    uint8_t i;

    for (i = 0; i < 10; i++)
    {
        ret = atk_mb026_send_at_cmd("AT", "OK", 500);
        if (ret == ATK_MB026_EOK)
        {
            return ATK_MB026_EOK;
        }
    }

    return ATK_MB026_ERROR;
}

uint8_t atk_mb026_at_sysmsg(uint8_t mode)
{
    uint8_t ret;

    switch (mode)
    {
        case 1:
            ret = atk_mb026_send_at_cmd("AT+SYSMSG=0", "OK", 500);
            break;
        case 2:
            ret = atk_mb026_send_at_cmd("AT+SYSMSG=2", "OK", 500);
            break;
        case 3:
            ret = atk_mb026_send_at_cmd("AT+SYSMSG=4", "OK", 500);
            break;
        default:
            return ATK_MB026_EINVAL;
    }

    if (ret == ATK_MB026_EOK)
    {
        return ATK_MB026_EOK;
    }
    else
    {
        return ATK_MB026_ERROR;
    }
}

uint8_t atk_mb026_ble_init(uint8_t mode)
{
    uint8_t ret;

    switch (mode)
    {
        case 1:
            ret = atk_mb026_send_at_cmd("AT+BLEINIT=0", "OK", 500);
            break;
        case 2:
            ret = atk_mb026_send_at_cmd("AT+BLEINIT=1", "OK", 500);
            break;
        case 3:
            ret = atk_mb026_send_at_cmd("AT+BLEINIT=2", "OK", 500);
            break;
        default:
            return ATK_MB026_EINVAL;
    }

    if (ret == ATK_MB026_EOK)
    {
        return ATK_MB026_EOK;
    }
    else
    {
        return ATK_MB026_ERROR;
    }
}

uint8_t atk_mb026_ble_gatts(void)
{
    uint8_t ret;

    ret = atk_mb026_send_at_cmd("AT+BLEGATTSSRVCRE", "OK", 1000);

    if (ret == ATK_MB026_EOK)
    {
        return ATK_MB026_EOK;
    }
    else
    {
        return ATK_MB026_ERROR;
    }
}

uint8_t atk_mb026_ble_gattssrvstart(void)
{
    uint8_t ret;

    ret = atk_mb026_send_at_cmd("AT+BLEGATTSSRVSTART", "OK", 1000);

    if (ret == ATK_MB026_EOK)
    {
        return ATK_MB026_EOK;
    }
    else
    {
        return ATK_MB026_ERROR;
    }
}

uint8_t atk_mb026_get_addr(char *buf)
{
    uint8_t ret;
    char *p_start;
    char *p_end;

    ret = atk_mb026_send_at_cmd("AT+BLEADDR?", "OK", 500);
    if (ret != ATK_MB026_EOK)
    {
        return ATK_MB026_ERROR;
    }

    p_start = strstr((const char *)atk_mb026_uart_rx_get_frame(), "\"");
    p_end = strstr(p_start + 1, "\"");
    *p_end = '\0';
    sprintf(buf, "%s", p_start + 1);

    return ATK_MB026_EOK;
}

uint8_t atk_mb026_set_addr(uint8_t mode)
{
    uint8_t ret;

    switch (mode)
    {
        case 1:
            ret = atk_mb026_send_at_cmd("AT+BLEADDR=0", "OK", 500);
            break;
        case 2:
            ret = atk_mb026_send_at_cmd("AT+BLEADDR=1", "OK", 500);
            break;
        default:
            return ATK_MB026_EINVAL;
    }

    if (ret == ATK_MB026_EOK)
    {
        return ATK_MB026_EOK;
    }
    else
    {
        return ATK_MB026_ERROR;
    }
}

uint8_t atk_mb026_get_advparam(char *buf)
{
    uint8_t ret;
    char *p_start;
    char *p_end;

    ret = atk_mb026_send_at_cmd("AT+BLEADVPARAM?", "OK", 500);
    if (ret != ATK_MB026_EOK)
    {
        return ATK_MB026_ERROR;
    }

    p_start = strstr((const char *)atk_mb026_uart_rx_get_frame(), "\"");
    p_end = strstr(p_start + 1, "\"");
    *p_end = '\0';
    sprintf(buf, "%s", p_start + 1);

    return ATK_MB026_EOK;
}

uint8_t atk_mb026_set_advparam(char *adv_int_min, char *adv_int_max, char *adv_type, char *own_addr_type, char *channel_map)
{
    uint8_t ret;
    char cmd[64];

    sprintf(cmd, "AT+BLEADVPARAM=\"%s\",\"%s\",\"%s\",\"%s\",\"%s\"", adv_int_min, adv_int_max, adv_type, own_addr_type, channel_map);
    ret = atk_mb026_send_at_cmd(cmd, "OK", 10000);

    if (ret == ATK_MB026_EOK)
    {
        return ATK_MB026_EOK;
    }
    else
    {
        return ATK_MB026_ERROR;
    }
}

uint8_t atk_mb026_set_advdata(char *adv_data)
{
    uint8_t ret;
    char cmd[64];

    sprintf(cmd, "AT+BLEADVDATA=\"%s\"", adv_data);
    ret = atk_mb026_send_at_cmd(cmd, "OK", 10000);

    if (ret == ATK_MB026_EOK)
    {
        return ATK_MB026_EOK;
    }
    else
    {
        return ATK_MB026_ERROR;
    }
}

uint8_t atk_mb026_set_advdataex(char *dev_name, char *uuid, char *manufacturer_data, uint16_t include_power)
{
    uint8_t ret;
    char cmd[80];

    sprintf(cmd, "AT+BLEADVDATAEX=\"%s\",\"%s\",\"%s\",%d", dev_name, uuid, manufacturer_data, include_power);
    ret = atk_mb026_send_at_cmd(cmd, "OK", 1000);

    delay_ms(500);
    if (ret == ATK_MB026_EOK)
    {
        return ATK_MB026_EOK;
    }
    else
    {
        return ATK_MB026_ERROR;
    }
}

uint8_t atk_mb026_advstart(void)
{
    uint8_t ret;

    ret = atk_mb026_send_at_cmd("AT+BLEADVSTART", "OK", 500);

    if (ret == ATK_MB026_EOK)
    {
        return ATK_MB026_EOK;
    }
    else
    {
        return ATK_MB026_ERROR;
    }
}

uint8_t atk_mb026_set_sppcfg(uint16_t cfg_enable, uint16_t tx_service_index, uint16_t tx_char_index, uint16_t rx_service_index, uint16_t rx_char_index, uint16_t auto_conn)
{
    uint8_t ret;
    char cmd[30];

    sprintf(cmd, "AT+BLESPPCFG=%d,%d,%d,%d,%d,%d", cfg_enable, tx_service_index, tx_char_index, rx_service_index, rx_char_index, auto_conn);
    ret = atk_mb026_send_at_cmd(cmd, "OK", 1000);

    if (ret != ATK_MB026_EOK)
    {
        return ATK_MB026_ERROR;
    }

    return ATK_MB026_EOK;
}

uint8_t atk_mb026_lespp(void)
{
    uint8_t ret;

    ret = atk_mb026_send_at_cmd("AT+BLESPP", "OK", 1000);
    if (ret == ATK_MB026_EOK)
    {
        return ATK_MB026_EOK;
    }
    else
    {
        return ATK_MB026_ERROR;
    }
}

atk_mb026_conn_sta_t atk_mb026_get_conn_sta(void)
{
    uint8_t *recv_len;

    recv_len = atk_mb026_uart_rx_get_frame();

    if (strstr((char *)recv_len, "+BLECONN") != NULL)
    {
        printf("\r\n Connected!\r\n");

        return ATK_MB026_CONNECTED;
    }

    if (strstr((char *)recv_len, "+BLEDISCONN") != NULL)
    {
        printf("\r\n Not connected!\r\n");

        return ATK_MB026_DISCONNECTED;
    }

    return ATK_MB026_DATA;
}

uint8_t atk_mb026_set_mode(uint8_t mode)
{
    uint8_t ret;

    switch (mode)
    {
        case 1:
            ret = atk_mb026_send_at_cmd("AT+CWMODE=1", "OK", 500);
            break;
        case 2:
            ret = atk_mb026_send_at_cmd("AT+CWMODE=2", "OK", 500);
            break;
        case 3:
            ret = atk_mb026_send_at_cmd("AT+CWMODE=3", "OK", 500);
            break;
        default:
            return ATK_MB026_EINVAL;
    }

    if (ret == ATK_MB026_EOK)
    {
        return ATK_MB026_EOK;
    }
    else
    {
        return ATK_MB026_ERROR;
    }
}

uint8_t atk_mb026_sw_reset(void)
{
    uint8_t ret;

    ret = atk_mb026_send_at_cmd("AT+RST", "OK", 500);
    if (ret == ATK_MB026_EOK)
    {
        delay_ms(1000);
        return ATK_MB026_EOK;
    }
    else
    {
        return ATK_MB026_ERROR;
    }
}

uint8_t atk_mb026_ate_config(uint8_t cfg)
{
    uint8_t ret;

    switch (cfg)
    {
        case 0:
            ret = atk_mb026_send_at_cmd("ATE0", "OK", 500);
            break;
        case 1:
            ret = atk_mb026_send_at_cmd("ATE1", "OK", 500);
            break;
        default:
            return ATK_MB026_EINVAL;
    }

    if (ret == ATK_MB026_EOK)
    {
        return ATK_MB026_EOK;
    }
    else
    {
        return ATK_MB026_ERROR;
    }
}

uint8_t atk_mb026_join_ap(char *ssid, char *pwd)
{
    uint8_t ret;
    char cmd[64];

    sprintf(cmd, "AT+CWJAP=\"%s\",\"%s\"", ssid, pwd);
    ret = atk_mb026_send_at_cmd(cmd, "WIFI GOT IP", 10000);

    if (ret == ATK_MB026_EOK)
    {
        return ATK_MB026_EOK;
    }
    else
    {
        return ATK_MB026_ERROR;
    }
}

uint8_t atk_mb026_get_ip(char *buf)
{
    uint8_t ret;
    char *p_start;
    char *p_end;

    ret = atk_mb026_send_at_cmd("AT+CIFSR", "OK", 500);
    if (ret != ATK_MB026_EOK)
    {
        return ATK_MB026_ERROR;
    }

    p_start = strstr((const char *)atk_mb026_uart_rx_get_frame(), "\"");
    p_end = strstr(p_start + 1, "\"");
    *p_end = '\0';
    sprintf(buf, "%s", p_start + 1);

    return ATK_MB026_EOK;
}

uint8_t atk_mb026_connect_tcp_server(char *server_ip, char *server_port)
{
    uint8_t ret;
    char cmd[64];
    
    // 设置为单连接模式，透传模式必须在单连接下工作
    printf("[DEBUG] 设置单连接模式...\r\n");
    ret = atk_mb026_send_at_cmd("AT+CIPMUX=0", "OK", 1000);
    if (ret != ATK_MB026_EOK) {
        printf("[ERROR] 设置单连接模式失败! 错误码: %d\r\n", ret);
        return ATK_MB026_ERROR;
    }
    printf("[SUCCESS] 单连接模式设置成功\r\n");
    
    sprintf(cmd, "AT+CIPSTART=\"TCP\",\"%s\",%s", server_ip, server_port);
    ret = atk_mb026_send_at_cmd(cmd, "CONNECT", 5000);
    if (ret == ATK_MB026_EOK)
    {
        return ATK_MB026_EOK;
    }
    else
    {
        return ATK_MB026_ERROR;
    }
}


uint8_t atk_mb026_enter_unvarnished(void)
{
    uint8_t ret1, ret2;
    uint8_t retry_count = 0;
    const uint8_t max_retries = 3;

    /* 重试机制 */
    while (retry_count < max_retries) {
        printf("[DEBUG] 尝试进入透传模式 (第%d次)...\r\n", retry_count + 1);
        
        /* 先检查连接状态 */
        printf("[DEBUG] 检查连接状态...\r\n");
        ret1 = atk_mb026_send_at_cmd("AT+CIPSTATUS", "STATUS:3", 1000);
        if (ret1 != ATK_MB026_EOK) {
            printf("[WARNING] 连接状态检查失败，错误码: %d\r\n", ret1);
            delay_ms(1000);
            retry_count++;
            continue;
        }
        printf("[SUCCESS] 连接状态正常\r\n");
        
        /* 发送AT+CIPMODE=1指令 */
        printf("[DEBUG] 发送AT+CIPMODE=1指令...\r\n");
        ret1 = atk_mb026_send_at_cmd("AT+CIPMODE=1", "OK", 1000);
        if (ret1 != ATK_MB026_EOK) {
            printf("[ERROR] AT+CIPMODE=1指令失败! 错误码: %d\r\n", ret1);
            delay_ms(1000);
            retry_count++;
            continue;
        }
        printf("[SUCCESS] AT+CIPMODE=1指令成功\r\n");
        
        /* 等待一段时间确保模式切换完成 */
        delay_ms(500);
        
        /* 发送AT+CIPSEND指令 */
        printf("[DEBUG] 发送AT+CIPSEND指令...\r\n");
        ret2 = atk_mb026_send_at_cmd("AT+CIPSEND", ">", 1000);
        if (ret2 != ATK_MB026_EOK) {
            printf("[ERROR] AT+CIPSEND指令失败! 错误码: %d\r\n", ret2);
            delay_ms(1000);
            retry_count++;
            continue;
        }
        printf("[SUCCESS] AT+CIPSEND指令成功，进入透传模式\r\n");
        
        return ATK_MB026_EOK;
    }
    
    printf("[ERROR] 进入透传模式失败，已重试%d次\r\n", max_retries);
    return ATK_MB026_ERROR;
}

void atk_mb026_exit_unvarnished(void)
{
    atk_mb026_uart_printf("+++");
}

uint8_t atk_mb026_connect_atkcld(char *id, char *pwd)
{
    uint8_t ret;
    char cmd[64];

    sprintf(cmd, "AT+ATKCLDSTA=\"%s\",\"%s\"", id, pwd);
    ret = atk_mb026_send_at_cmd(cmd, "CLOUD CONNECTED", 10000);
    if (ret == ATK_MB026_EOK)
    {
        return ATK_MB026_EOK;
    }
    else
    {
        return ATK_MB026_ERROR;
    }
}

uint8_t atk_mb026_connect_atknewcld(char *id, char *pwd)
{
    uint8_t ret;
    char cmd[64];

    sprintf(cmd, "AT+ATKNEWCLDSTA=\"%s\",\"%s\"", id, pwd);
    ret = atk_mb026_send_at_cmd(cmd, "CLOUD CONNECTED", 10000);
    if (ret == ATK_MB026_EOK)
    {
        return ATK_MB026_EOK;
    }
    else
    {
        return ATK_MB026_ERROR;
    }
}

uint8_t atk_mb026_disconnect_atkcld(void)
{
    uint8_t ret;

    ret = atk_mb026_send_at_cmd("AT+ATKCLDCLS", "CLOUD DISCONNECT", 500);
    if (ret == ATK_MB026_EOK)
    {
        return ATK_MB026_EOK;
    }
    else
    {
        return ATK_MB026_ERROR;
    }
}



