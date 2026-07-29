/**
 * @file    atk_mb026.c
 * @brief   ATK-MB026 WiFi模块驱动实现文件
 * @details 实现ATK-MB026 WiFi模块的初始化和控制功能
 * @author  Smart Agriculture Team
 * @date    2026-04-11
 * @version 1.0.0
 * @note    基于STM32F103微控制器
 */

#include "atk_mb026.h"
#include "delay.h"

/* ==================== 内部函数 ==================== */

/**
 * @brief   ATK-MB026硬件初始化
 * @details 初始化复位引脚
 */
static void atk_mb026_hw_init(void)
{
    GPIO_InitTypeDef GPIO_InitStructure;

    RCC_APB2PeriphClockCmd(ATK_MB026_RST_GPIO_CLK, ENABLE);

    GPIO_InitStructure.GPIO_Pin = ATK_MB026_RST_GPIO_PIN;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_Out_PP;
    GPIO_InitStructure.GPIO_Speed = GPIO_Speed_50MHz;
    GPIO_Init(ATK_MB026_RST_GPIO_PORT, &GPIO_InitStructure);
}

/* ==================== 函数实现 ==================== */

/**
 * @brief   ATK-MB026硬件复位
 */
void atk_mb026_hw_reset(void)
{
    ATK_MB026_RST(0);
    delay_ms(100);
    ATK_MB026_RST(1);
    delay_ms(500);
}

/**
 * @brief   ATK-MB026发送AT指令
 * @param   cmd AT指令
 * @param   ack 期望的应答
 * @param   timeout 超时时间（毫秒）
 * @return  ATK_MB026_EOK: 成功
 *          ATK_MB026_ETIMEOUT: 超时
 */
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

/**
 * @brief   ATK-MB026初始化
 * @param   baudrate UART波特率
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
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

/**
 * @brief   ATK-MB026恢复出厂设置
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
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

/**
 * @brief   ATK-MB026 AT指令测试
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
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

/**
 * @brief   ATK-MB026设置系统提示信息
 * @param   mode 模式（1: 关闭，2: 开启，3: 详细）
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
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

/**
 * @brief   ATK-MB026蓝牙初始化
 * @param   mode 模式（1: 关闭，2: 客户端，3: 服务器）
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
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

/**
 * @brief   ATK-MB026 GATTS服务配置
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
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

/**
 * @brief   ATK-MB026 GATTS服务全部开启
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
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

/**
 * @brief   ATK-MB026获取本机设备地址
 * @param   buf 存储地址的缓冲区
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
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

/**
 * @brief   ATK-MB026设置本机设备地址类型
 * @param   mode 地址类型（1: 公共地址，2: 随机地址）
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
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

/**
 * @brief   ATK-MB026获取本机设备广播参数
 * @param   buf 存储广播参数的缓冲区
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
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

/**
 * @brief   ATK-MB026设置广播参数
 * @param   adv_int_min 广播间隔最小值
 * @param   adv_int_max 广播间隔最大值
 * @param   adv_type 广播类型
 * @param   own_addr_type 本机地址类型
 * @param   channel_map 广播信道映射
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
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

/**
 * @brief   ATK-MB026设置广播数据
 * @param   adv_data 广播数据
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
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

/**
 * @brief   ATK-MB026自定义设置广播数据
 * @param   dev_name 设备名称
 * @param   uuid UUID
 * @param   manufacturer_data 制造商数据
 * @param   include_power 是否包含发射功率
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
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

/**
 * @brief   ATK-MB026开始Bluetooth LE广播
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
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

/**
 * @brief   ATK-MB026设置Bluetooth LE SPP配置
 * @param   cfg_enable 配置使能
 * @param   tx_service_index 发送服务索引
 * @param   tx_char_index 发送特征索引
 * @param   rx_service_index 接收服务索引
 * @param   rx_char_index 接收特征索引
 * @param   auto_conn 自动连接
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
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

/**
 * @brief   ATK-MB026进入Bluetooth LE SPP模式
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
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

/**
 * @brief   获取ATK-MB026连接状态
 * @return  连接状态
 */
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

/**
 * @brief   设置ATK-MB026工作模式
 * @param   mode 模式（1: Station模式，2: SoftAP模式，3: SoftAP+Station模式）
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
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

/**
 * @brief   ATK-MB026软件复位
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
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

/**
 * @brief   ATK-MB026设置回显模式
 * @param   cfg 配置（0: 关闭，1: 开启）
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
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

/**
 * @brief   ATK-MB026连接WIFI
 * @param   ssid WIFI名称
 * @param   pwd WIFI密码
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
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

/**
 * @brief   ATK-MB026获取IP地址
 * @param   buf 存储IP地址的缓冲区
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
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

/**
 * @brief   ATK-MB026连接TCP服务器
 * @param   server_ip 服务器IP地址
 * @param   server_port 服务器端口
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_connect_tcp_server(char *server_ip, char *server_port)
{
    uint8_t ret;
    char cmd[64];
    uint8_t *response = NULL;
    
    printf("\r\n[TCP] 连接 %s:%s\r\n", server_ip, server_port);
    
    delay_ms(500);
    
    atk_mb026_uart_rx_restart();
    delay_ms(100);
    
    atk_mb026_send_at_cmd("AT+CIPCLOSE", "OK", 2000);
    delay_ms(500);
    
    ret = atk_mb026_send_at_cmd("AT+CIPMUX=0", "OK", 2000);
    if (ret != ATK_MB026_EOK)
    {
        printf("[TCP] 单连接模式失败，等待...\r\n");
        delay_ms(1000);
        atk_mb026_send_at_cmd("AT+CIPCLOSE", "OK", 2000);
        delay_ms(500);
        atk_mb026_send_at_cmd("AT+CIPMUX=0", "OK", 2000);
    }
    
    sprintf(cmd, "AT+CIPSTART=\"TCP\",\"%s\",%s", server_ip, server_port);
    
    atk_mb026_uart_rx_restart();
    atk_mb026_uart_printf("%s\r\n", cmd);
    
    uint32_t timeout = 8000;
    while (timeout > 0)
    {
        response = atk_mb026_uart_rx_get_frame();
        if (response != NULL)
        {
            if (strstr((const char *)response, "CONNECT") != NULL ||
                strstr((const char *)response, "OK") != NULL)
            {
                printf("[TCP] 连接成功\r\n");
                return ATK_MB026_EOK;
            }
            else if (strstr((const char *)response, "ERROR") != NULL ||
                     strstr((const char *)response, "FAIL") != NULL ||
                     strstr((const char *)response, "busy") != NULL)
            {
                printf("[TCP] 连接失败: %s\r\n", (char *)response);
                return ATK_MB026_ERROR;
            }
            else if (strstr((const char *)response, "ALREADY CONNECTED") != NULL)
            {
                printf("[TCP] 已连接\r\n");
                return ATK_MB026_EOK;
            }
            atk_mb026_uart_rx_restart();
        }
        timeout--;
        delay_ms(1);
    }
    
    printf("[TCP] 连接超时\r\n");
    return ATK_MB026_ETIMEOUT;
}

/**
 * @brief   ATK-MB026进入透传模式
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
uint8_t atk_mb026_enter_unvarnished(void)
{
    uint8_t ret1, ret2;
    uint8_t retry_count = 0;
    const uint8_t max_retries = 3;

    // 重试机制
    while (retry_count < max_retries)
    {
        printf("[DEBUG] 尝试进入透传模式 (第%d次)...\r\n", retry_count + 1);
        
        // 先检查连接状态
        printf("[DEBUG] 检查连接状态...\r\n");
        ret1 = atk_mb026_send_at_cmd("AT+CIPSTATUS", "STATUS:3", 1000);
        if (ret1 != ATK_MB026_EOK)
        {
            printf("[WARNING] 连接状态检查失败，错误码: %d\r\n", ret1);
            delay_ms(1000);
            retry_count++;
            continue;
        }
        printf("[SUCCESS] 连接状态正常\r\n");
        
        // 发送AT+CIPMODE=1指令
        printf("[DEBUG] 发送AT+CIPMODE=1指令...\r\n");
        ret1 = atk_mb026_send_at_cmd("AT+CIPMODE=1", "OK", 1000);
        if (ret1 != ATK_MB026_EOK)
        {
            printf("[ERROR] AT+CIPMODE=1指令失败! 错误码: %d\r\n", ret1);
            delay_ms(1000);
            retry_count++;
            continue;
        }
        printf("[SUCCESS] AT+CIPMODE=1指令成功\r\n");
        
        // 等待一段时间确保模式切换完成
        delay_ms(500);
        
        // 发送AT+CIPSEND指令
        printf("[DEBUG] 发送AT+CIPSEND指令...\r\n");
        ret2 = atk_mb026_send_at_cmd("AT+CIPSEND", ">", 1000);
        if (ret2 != ATK_MB026_EOK)
        {
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

/**
 * @brief   ATK-MB026退出透传模式
 */
void atk_mb026_exit_unvarnished(void)
{
    atk_mb026_uart_printf("+++");
}

/**
 * @brief   ATK-MB026连接原子云服务器
 * @param   id 设备ID
 * @param   pwd 设备密码
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
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

/**
 * @brief   ATK-MB026连接新版原子云服务器
 * @param   id 设备ID
 * @param   pwd 设备密码
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
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

/**
 * @brief   ATK-MB026断开原子云服务器连接
 * @return  ATK_MB026_EOK: 成功
 *          其他: 失败
 */
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

/**
 * @brief   ATK-MB026 Ping测试
 * @param   ip 目标IP地址
 * @return  ATK_MB026_EOK: Ping成功
 *          ATK_MB026_ETIMEOUT: Ping超时
 *          ATK_MB026_ERROR: Ping失败
 * @note    用于测试网络连通性，结果会打印到串口
 */
uint8_t atk_mb026_ping(char *ip)
{
    char cmd[64];
    uint8_t *response = NULL;
    
    printf("\r\n[PING] ========== Ping测试开始 ==========\r\n");
    printf("[PING] 目标IP: %s\r\n", ip);
    
    sprintf(cmd, "AT+PING=\"%s\"", ip);
    
    printf("[PING] 发送命令: %s\r\n", cmd);
    
    atk_mb026_uart_rx_restart();
    atk_mb026_uart_printf("%s\r\n", cmd);
    
    uint32_t timeout = 10000;
    while (timeout > 0)
    {
        response = atk_mb026_uart_rx_get_frame();
        if (response != NULL)
        {
            printf("[PING] 收到响应: %s\r\n", (char *)response);
            
            if (strstr((const char *)response, "+PING:") != NULL)
            {
                char *ping_result = strstr((const char *)response, "+PING:");
                printf("[PING] Ping结果: %s\r\n", ping_result);
                
                if (strstr((const char *)response, "timeout") != NULL ||
                    strstr((const char *)response, "TIMEOUT") != NULL)
                {
                    printf("[PING] ========== Ping超时 ==========\r\n\r\n");
                    return ATK_MB026_ETIMEOUT;
                }
                
                printf("[PING] ========== Ping成功 ==========\r\n\r\n");
                return ATK_MB026_EOK;
            }
            else if (strstr((const char *)response, "ERROR") != NULL)
            {
                printf("[PING] ========== Ping失败 (ERROR) ==========\r\n\r\n");
                return ATK_MB026_ERROR;
            }
            else if (strstr((const char *)response, "OK") != NULL)
            {
                printf("[PING] ========== Ping成功 (OK) ==========\r\n\r\n");
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
    
    printf("[PING] ========== Ping超时 (无响应) ==========\r\n\r\n");
    return ATK_MB026_ETIMEOUT;
}
