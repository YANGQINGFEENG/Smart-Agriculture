#include "sys.h"
#include "delay.h"
#include "usart.h"
#include <stdlib.h>
#include "Serial2.h"
#include "atk_d43.h"
#include "atk_mb026_uart.h"
#include "string.h"

/**
 * ****************************************************************************
 * @file            atk_d43.c
 * @author          正点原子团队(ALIENTEK)
 * @version         V1.0
 * @data            2026-04-18
 * @brief           DTU通信模块
 * @copyright       Copyright (c) 2020-2032, 广州市星翼电子科技有限公司
 * ****************************************************************************
 * @attention       
 * 
 * 实现平台: 正点原子STM32F103系列开发板    +   正点原子ATK-D4X系列4G Cat1 DTU模块
 * 视频教程:www.yuanzige.com
 * 论坛:www.openedv.com
 * 公司网址:www.alientek.com
 * 淘宝店铺:openedv.taobao.com
 * 
 * 修改记录
 * V1.0 20260418
 * 第一次修改
 * ****************************************************************************
*/

static uint8_t dtu_rxcmdbuf[DTU_RX_CMD_BUF_SIZE]; /*存储DTU返回的命令数据*/

/**
 * @brief       发送数据到DTU
 * 
 * @param       data:   需要发送的数据的首地址
 * @param       size:   发送数据大小
 * 
 * @return      无
 * 
*/
void send_data_to_dtu(uint8_t *data, uint32_t size)
{
    usart2_send_data(data, size);
}

/**
 * @brief       发送命令到DTU并等待验证
 * 
 * @param       cmd     :   需要发送的AT命令
 * @param       ask     :   需要验证的响应字符串
 * @param       timeout :   AT命令验证超时时间，单位：100ms
 * 
 * @return      1  :   验证ask数据成功
 *              0  :   DTU返回OK
 *             -1  :   DTU返回ERROR
 *             -2  :   发送AT命令验证超时
 */
static int send_cmd_to_dtu(char *cmd, char *ask, uint32_t timeout)
{
    uint32_t rx_len = 0;

    /*初始化接收缓存*/
    memset(dtu_rxcmdbuf, 0, DTU_RX_CMD_BUF_SIZE);
    atk_mb026_uart_rx_restart();

    /*发送AT命令到DTU*/
    send_data_to_dtu((uint8_t *)cmd, strlen(cmd));

    /*等待DTU应答AT命令*/
    while (1)
    {
        uint8_t *rx_data = atk_mb026_uart_rx_get_frame();
        if (rx_data)
        {
            strcat((char *)dtu_rxcmdbuf, (char *)rx_data);
            atk_mb026_uart_rx_restart();
        }

        if (strstr((char *)dtu_rxcmdbuf, ask) != NULL)
        {
            return 1;
        }
        else if (strstr((char *)dtu_rxcmdbuf, "OK") != NULL)
        {
            return 0;
        }
        else if (strstr((char *)dtu_rxcmdbuf, "ERROR") != NULL)
        {
            return -1;
        }

        timeout--;
        if (timeout == 0)
        {
            return -2;
        }

        delay_ms(100);
    }
}

/**
 * @brief       发送命令并接收数据，直到超时（100ms）后停止
 * 
 * @param       cmd     :   需要发送的AT命令
 * @param       timeout :   超时时间（单位：ms）
 * 
 * @return      uint8_t*: 返回接收到的数据缓冲区首地址
 *                        若超时未接收到数据，返回 NULL
 */
static uint8_t *send_cmd_to_receive(char *cmd, uint32_t timeout)
{
    uint32_t rx_len = 0;
    uint32_t elapsed_time = 0;
    uint32_t idle_time = 0; 

    /*初始化接收缓存*/
    memset(dtu_rxcmdbuf, 0, DTU_RX_CMD_BUF_SIZE);
    atk_mb026_uart_rx_restart();
    
    /*发送AT命令到DTU*/
    send_data_to_dtu((uint8_t *)cmd, strlen(cmd));    
    
    /* 开始接收数据 */
    while (elapsed_time < timeout)
    {
        /* 检查接收缓冲区数据 */
        uint8_t *rx_data = atk_mb026_uart_rx_get_frame();
        if (rx_data)
        {
            uint16_t data_len = atk_mb026_uart_rx_get_frame_len();
            if (rx_len + data_len < DTU_RX_CMD_BUF_SIZE)
            {
                memcpy(&dtu_rxcmdbuf[rx_len], rx_data, data_len);
                rx_len += data_len;
            }
            else
            {
                break;
            }
            atk_mb026_uart_rx_restart();
            
            /* 有数据到来，重置空闲时间 */
            idle_time = 0;
        }
        else
        {
            /* 没有数据，增加空闲时间 */
            idle_time += 5;
            if (rx_len > 0 && idle_time >= 100)
            {
                break;
            }        
        }
        
        delay_ms(5);
        elapsed_time += 5;
    }
    
    if (rx_len == 0)
    {
        return NULL;
    }
    
    return dtu_rxcmdbuf;
}




/**
 * @brief       DTU进入配置状态
 * 
 * @param       无
 * 
 * @return      0  :    成功进入配置状态
 *             -1  :    进入配置状态失败
 */
static int dtu_enter_configmode(void)
{
    int res;

    /* 1.发送+++准备进入配置状态 */
    res = send_cmd_to_dtu("+++", "atk", 5);
    if (res == -1) /*返回ERRRO表示DTU已经在配置状态*/
    {
        return 0;
    }

    /* 2.发送atk确认进入配置状态 */
    res = send_cmd_to_dtu("atk", "OK", 5);
    if (res == -2)
    {
        return -1;
    }

    return 0;
}

/**
 * @brief       DTU进入透传状态
 * 
 * @param       无
 * 
 * @return      0  :    成功进入透传状态
 *             -1  :    进入透传状态失败
 */
static int dtu_enter_transfermode(void)
{
    if (send_cmd_to_dtu("ATO\r\n", "OK", 5) >= 0)
    {
        return 0;
    }

    return -1;
}

/**
 * @brief       DTU自动上报URC信息处理函数:收到+ATK ERROR信息
 * 
 * @param       data    :   收到的DTU的URC数据
 * @param       len     :   URC数据长度
 * 
 * @return      无
 */
static void dtu_urc_atk_error(const char *data, uint32_t len)
{
    printf("\r\nURC :   dtu_urc_atk_error\r\n");
}

/**
 * @brief       DTU自动上报URC信息处理函数:收到Please check SIM Card信息
 * 
 * @param       data    :   收到的DTU的URC数据
 * @param       len     :   URC数据长度
 * 
 * @return      无
 */
static void dtu_urc_error_sim(const char *data, uint32_t len)
{
    printf("\r\nURC :   dtu_urc_error_sim\r\n");
}

/**
 * @brief       DTU自动上报URC信息处理函数:收到Please check GPRS信息
 * 
 * @param       data    :   收到的DTU的URC数据
 * @param       len     :   URC数据长度
 * 
 * @return      无
 */
static void dtu_urc_error_gprs(const char *data, uint32_t len)
{
    printf("\r\nURC :   dtu_urc_error_gprs\r\n");
}

/**
 * @brief       DTU自动上报URC信息处理函数:收到Please check CSQ信息
 * 
 * @param       data    :   收到的DTU的URC数据
 * @param       len     :   URC数据长度
 * 
 * @return      无
 */
static void dtu_urc_error_csq(const char *data, uint32_t len)
{
    printf("\r\nURC :   dtu_urc_error_csq\r\n");
}

/**
 * @brief       DTU自动上报URC信息处理函数:收到Please check MQTT Parameter信息
 * 
 * @param       data    :   收到的DTU的URC数据
 * @param       len     :   URC数据长度
 * 
 * @return      无
 */
static void dtu_urc_error_mqtt(const char *data, uint32_t len)
{
    printf("\r\nURC :   dtu_urc_error_mqtt\r\n");
}

typedef struct
{
    const char *urc_info;                         /*DTU自动上报的URC信息*/
    void (*func)(const char *data, uint32_t len); /*回调处理函数*/
} _dtu_urc_st;

#define DTU_ATK_D4X_URC_SIZE 5
static _dtu_urc_st DTU_ATK_D4X_URC[DTU_ATK_D4X_URC_SIZE] =
    {
        
        {"+ATK ERROR:",                         dtu_urc_atk_error},         /*DTU出现错误，需要联系技术支持或检查AT命令是否正确*/
        {"Please check SIM Card !!!\r\n",       dtu_urc_error_sim},         /*DTU未检测到手机卡,请检查手机卡是否正确安装*/
        {"Please check GPRS !!!\r\n",           dtu_urc_error_gprs},        /*请检查SIM卡是否欠费*/
        {"Please check CSQ !!!\r\n",            dtu_urc_error_csq},         /*请检查天线是否正确安装，在信号弱的地方使用*/
        {"Please check MQTT Parameter !!!\r\n", dtu_urc_error_mqtt},        /*MQTT参数错误*/
};

/**
 * @brief       处理DTU自动上报的URC信息数据，注意：每接收一个字节的数据，都需要调用此函数在串口中断中处理
 * 
 * @param       ch    :   正在收到的一个字节数据
 * 
 * @return      无
 */
void dtu_get_urc_info(uint8_t ch)
{
    static uint8_t ch_last = 0;
    static uint32_t rx_len = 0;
    int i;

    /*存储DTU数据*/
    dtu_rxcmdbuf[rx_len++] = ch;
    if (rx_len >= DTU_RX_CMD_BUF_SIZE)
    { /*防止溢出*/
        ch_last = 0;
        rx_len = 0;
        memset(dtu_rxcmdbuf, 0, DTU_RX_CMD_BUF_SIZE);
    }

    /*检测DTU的URC信息*/
    if ((ch_last == '\r') && (ch == '\n'))
    {
        for (i = 0; i < DTU_ATK_D4X_URC_SIZE; i++)
        {
            if (strstr((char *)dtu_rxcmdbuf, DTU_ATK_D4X_URC[i].urc_info) == (char *)dtu_rxcmdbuf)
            {
                DTU_ATK_D4X_URC[i].func((char *)dtu_rxcmdbuf, strlen((char *)dtu_rxcmdbuf));
            }
        }

        ch_last = 0;
        rx_len = 0;
        memset(dtu_rxcmdbuf, 0, DTU_RX_CMD_BUF_SIZE);
    }

    ch_last = ch;
}

static const _dtu_atcmd_st dtu_basic_conf_param_info[] = {
    
    /* 1. 通信波特率配置，默认波特率115200，用户可根据需要在下面的数组修改每个D4X通信的波特率 */
    {5, "AT+UART\r\n",          "AT+UART=\"115200\",\"1\",\"8\",\"NONE\"\r\n"},
    {5, "AT+UARTLT\r\n",          "AT+UARTLT=\"1024\",\"50\"\r\n"},
    
    /* 2.透传命令键值配置 */
    {5, "AT+CMDKEY\r\n",          "AT+CMDKEY=\"ALIENTEK\"\r\n"},
    {5, "AT+UARTAT\r\n",          "AT+UARTAT=\"OFF\"\r\n"},
    {5, "AT+NETAT\r\n",          "AT+NETAT=\"ON\"\r\n"},
    
    /* 3.重启配置 */
    {5, "AT+R\r\n",              "AT+R=\"ON\"\r\n"},
    
    /* 4.SIM卡配置 */
    {5, "AT+APN\r\n",              "AT+APN=\"AUTO\",\"\",\"\"\r\n"},
    
    /* 5.设备标识信息 + 名称 */
    {5, "AT+START\r\n",          "AT+START=\"ATK-D4X\"\r\n"},
    {5, "AT+USER\r\n",          "AT+USER=\"ALIENTEK\"\r\n"},
    
    /* 6.心跳时间配置 */
    {5, "AT+RSTIM\r\n",          "AT+RSTIM=\"1200\"\r\n"},
    {5, "AT+LINKRSTM\r\n",       "AT+LINKRSTM=\"120\"\r\n"},
    
    /* 7.自动上报 */
    {5, "AT+AUTOUP\r\n",          "AT+AUTOUP=\"ON\"\r\n"},
    
};

static const _dtu_atcmd_st dtu_net_param_info[] = {

    /*1.选择工作模式为网络透传模式 */
    {5, "AT+WORK\r\n",          "AT+WORK=\"NET\"\r\n"},

    /*2.配置网络透传模式的连接参数*/
    {5, "AT+LINK1EN\r\n",       "AT+LINK1EN=\"ON\"\r\n"},
    
    {5, "AT+LINK1\r\n",         "AT+LINK1=\"TCP\",\"8.135.10.183\",\"34195\"\r\n"},
    {5, "AT+LINK1MD\r\n",       "AT+LINK1MD=\"LONG\"\r\n"},
    {5, "AT+LINK1TM\r\n",       "AT+LINK1TM=\"5\"\r\n"},

    {5, "AT+LINK2EN\r\n",       "AT+LINK2EN=\"OFF\"\r\n"},
    {5, "AT+LINK3EN\r\n",       "AT+LINK3EN=\"OFF\"\r\n"},
    {5, "AT+LINK4EN\r\n",       "AT+LINK4EN=\"OFF\"\r\n"},
        
    {5, "AT+SENDFAST\r\n",      "AT+SENDFAST=\"ON\"\r\n"},

    /*3.配置心跳包功能，默认开启         注意：强烈建议开启心跳包功能，否则可能会*/
    {5, "AT+HRTEN\r\n",         "AT+HRTEN=\"ON\"\r\n"},
    {5, "AT+HRTDT\r\n",         "AT+HRTDT=\"414C49454E54454B2D4852544454\"\r\n"},
    {5, "AT+HRTTM\r\n",         "AT+HRTTM=\"120\"\r\n"},

    /*4.配置注册包功能，默认关闭 */
    {5, "AT+REGEN\r\n",         "AT+REGEN=\"OFF\"\r\n"},
    {5, "AT+REGDT\r\n",         "AT+REGDT=\"414C49454E54454B2D5245474454\"\r\n"},
    {5, "AT+REGMD\r\n",         "AT+REGMD=\"LINK\"\r\n"},
    {5, "AT+REGTP\r\n",         "AT+REGTP=\"IMEI\"\r\n"},

    /*5.配置完成标志*/
};

static const _dtu_atcmd_st dtu_http_param_info[] = {

    /*1.选择工作模式为HTTP透传模式*/
    {5, "AT+WORK\r\n",          "AT+WORK=\"HTTP\"\r\n"},

    /*2.配置HTTP透传模式的连接参数*/
    {5, "AT+HTTPMD\r\n",        "AT+HTTPMD=\"GET\"\r\n"},
    {5, "AT+HTTPURL\r\n",       "AT+HTTPURL=\"https://cloud.alientek.com/testfordtu?data=\"\r\n"},
    {5, "AT+HTTPTM\r\n",        "AT+HTTPTM=\"10\"\r\n"},
    {5, "AT+HTTPHD\r\n",        "AT+HTTPHD=\"Connection:close\"\r\n"},
    {5, "AT+HTTPHDFLT\r\n",        "AT+HTTPHDFLT=\"OFF\"\r\n"},

    /*3.配置完成标志*/
};

static const _dtu_atcmd_st dtu_mqtt_param_info[] = {

    /*1.选择工作模式为MQTT透传模式*/
    {5, "AT+WORK\r\n",          "AT+WORK=\"MQTT\"\r\n"},

    /*2.配置MQTT透传模式的连接参数*/
    {5, "AT+MQTTCD\r\n",        "AT+MQTTCD=\"alientek\"\r\n"},
    {5, "AT+MQTTUN\r\n",        "AT+MQTTUN=\"admin\"\r\n"},
    {5, "AT+MQTTPW\r\n",        "AT+MQTTPW=\"password\"\r\n"},
    {5, "AT+MQTTIP\r\n",        "AT+MQTTIP=\"broker.emqx.io\",\"1883\"\r\n"},
    {5, "AT+MQTTSUB1\r\n",      "AT+MQTTSUB1=\"1\",\"atk/sub1\",\"0\"\r\n"},
    {5, "AT+MQTTSUB2\r\n",      "AT+MQTTSUB2=\"0\",\"atk/sub2\",\"0\"\r\n"},
    {5, "AT+MQTTSUB3\r\n",      "AT+MQTTSUB3=\"0\",\"atk/sub3\",\"0\"\r\n"},
    {5, "AT+MQTTSUB4\r\n",      "AT+MQTTSUB4=\"0\",\"atk/sub4\",\"0\"\r\n"},
    {5, "AT+MQTTPUB1\r\n",      "AT+MQTTPUB1=\"1\",\"atk/pub1\",\"0\",\"0\"\r\n"},
    {5, "AT+MQTTPUB2\r\n",      "AT+MQTTPUB2=\"0\",\"atk/pub2\",\"0\",\"0\"\r\n"},
    {5, "AT+MQTTPUB3\r\n",      "AT+MQTTPUB3=\"0\",\"atk/pub3\",\"0\",\"0\"\r\n"},
    {5, "AT+MQTTPUB4\r\n",      "AT+MQTTPUB4=\"0\",\"atk/pub4\",\"0\",\"0\"\r\n"},
    {5, "AT+MQTTFLT\r\n",       "AT+MQTTFLT=\"ON\"\r\n"},
    {5, "AT+MQTTDIST\r\n",      "AT+MQTTDIST=\"0\",\"<%d>\"\r\n"},
    {5, "AT+MQTTWILL\r\n",      "AT+MQTTWILL=\"0\",\"device/last_will\",\"offline\",\"0\",\"0\"\r\n"},
    {5, "AT+MQTTCON\r\n",       "AT+MQTTCON=\"1\",\"300\"\r\n"},

    /*3.配置完成标志*/
};

static const _dtu_atcmd_st dtu_aliyun_param_info[] = {

    /*1.选择工作模式为阿里云透传模式*/
    {5, "AT+WORK\r\n",          "AT+WORK=\"ALIYUN\"\r\n"},

    /*2.配置阿里云透传模式的连接参数*/
    {5, "AT+ALIPK\r\n",         "AT+ALIPK=\"ProductKey\"\r\n"},
    {5, "AT+ALIDS\r\n",         "AT+ALIDS=\"DeviceSecret\"\r\n"},
    {5, "AT+ALIDN\r\n",         "AT+ALIDN=\"DeviceName\"\r\n"},
    {5, "AT+ALIRI\r\n",         "AT+ALIRI=\"cn-shanghai\"\r\n"},
    {5, "AT+ALISUB1\r\n",       "AT+ALISUB1=\"1\",\"atk/sub1\",\"0\"\r\n"},
    {5, "AT+ALISUB2\r\n",       "AT+ALISUB2=\"0\",\"atk/sub2\",\"0\"\r\n"},
    {5, "AT+ALISUB3\r\n",       "AT+ALISUB3=\"0\",\"atk/sub3\",\"0\"\r\n"},
    {5, "AT+ALISUB4\r\n",       "AT+ALISUB4=\"0\",\"atk/sub4\",\"0\"\r\n"},
    {5, "AT+ALIPUB1\r\n",       "AT+ALIPUB1=\"1\",\"atk/pub1\",\"0\",\"0\"\r\n"},
    {5, "AT+ALIPUB2\r\n",       "AT+ALIPUB2=\"0\",\"atk/pub2\",\"0\",\"0\"\r\n"},
    {5, "AT+ALIPUB3\r\n",       "AT+ALIPUB3=\"0\",\"atk/pub3\",\"0\",\"0\"\r\n"},
    {5, "AT+ALIPUB4\r\n",       "AT+ALIPUB4=\"0\",\"atk/pub4\",\"0\",\"0\"\r\n"},
    {5, "AT+ALIFLT\r\n",        "AT+ALIFLT=\"ON\"\r\n"},
    {5, "AT+ALIDIST\r\n",       "AT+ALIDIST=\"0\",\"<%d>\"\r\n"},
    {5, "AT+ALIWILL\r\n",       "AT+ALIWILL=\"0\",\"device/last_will\",\"offline\",\"0\",\"0\"\r\n"},
    {5, "AT+ALICON\r\n",        "AT+ALICON=\"1\",\"300\"\r\n"},
        
    /*3.配置完成标志*/
};

static const _dtu_atcmd_st dtu_onenet_param_info[] = {

    /*1.选择工作模式为OneNET透传模式*/
    {5, "AT+WORK\r\n",          "AT+WORK=\"ONENET\"\r\n"},

    /*2.配置OneNET透传模式的连接参数*/
    {5, "AT+ONEDI\r\n",         "AT+ONEDI=\"12345\"\r\n"},                              /*设备ID*/
    {5, "AT+ONEPI\r\n",         "AT+ONEPI=\"1234567890\"\r\n"},                         /*产品ID*/
    
    {5, "AT+ONEKEY\r\n",        "AT+ONEKEY=\"12345678901234567890\"\r\n"},              /*设备密钥*/
    {5, "AT+ONEIP\r\n",         "AT+ONEIP=\"mqtt.heclouds.com\",\"1883\"\r\n"},         /*服务器地址默认*/
        
    {5, "AT+ONESUB1\r\n",       "AT+ONESUB1=\"0\",\"atk/sub1\",\"0\"\r\n"},             /*订阅主题，订阅成功才会收到数据，否则订阅失败*/
    {5, "AT+ONESUB2\r\n",       "AT+ONESUB2=\"0\",\"atk/sub2\",\"0\"\r\n"},
    {5, "AT+ONESUB3\r\n",       "AT+ONESUB3=\"0\",\"atk/sub3\",\"0\"\r\n"},
    {5, "AT+ONESUB4\r\n",       "AT+ONESUB4=\"0\",\"atk/sub4\",\"0\"\r\n"},
    {5, "AT+ONEPUB1\r\n",       "AT+ONEPUB1=\"0\",\"atk/pub1\",\"0\",\"0\"\r\n"},
    {5, "AT+ONEPUB2\r\n",       "AT+ONEPUB2=\"0\",\"atk/pub2\",\"0\",\"0\"\r\n"},
    {5, "AT+ONEPUB3\r\n",       "AT+ONEPUB3=\"0\",\"atk/pub3\",\"0\",\"0\"\r\n"},
    {5, "AT+ONEPUB4\r\n",       "AT+ONEPUB4=\"0\",\"atk/pub4\",\"0\",\"0\"\r\n"},        
    {5, "AT+ONEFLT\r\n",        "AT+ONEFLT=\"ON\"\r\n"},
    {5, "AT+ONEDIST\r\n",       "AT+ONEDIST=\"0\",\"<%d>\"\r\n"},
    {5, "AT+ONEWILL\r\n",       "AT+ONEWILL=\"0\",\"device/last_will\",\"offline\",\"0\",\"0\"\r\n"},
    {5, "AT+ONECON\r\n",        "AT+ONECON=\"1\",\"300\"\r\n"},        
        
    /*3.配置完成标志*/
};

static const _dtu_atcmd_st dtu_yuanziyun_param_info[] = {

    /*1.选择工作模式为原子云透传模式*/
    {5, "AT+WORK\r\n",          "AT+WORK=\"YUANZIYUN\"\r\n"},

    /*2.配置原子云透传模式的连接参数（0：旧版本  1：新版本）*/
    /*注意：DTU使用新版本原子云必须IMEI号对应，如果原子云平台的设备列表没有当前DTU的IMEI号则会连接失败，必须在原子云平台添加当前DTU的IMEI号才能连接成功*/
    {5, "AT+SVRLINK\r\n",       "AT+SVRLINK=\"1\"\r\n"},
    {5, "AT+SVRNUM\r\n",        "AT+SVRNUM=\"19678652400876093448\"\r\n"},
    {5, "AT+SVRKEY\r\n",        "AT+SVRKEY=\"12345678\"\r\n"},

    /*3.配置完成标志*/
};


static const _dtu_atcmd_st dtu_collect_disable_param_info[] = {
    
    /* 1.选择采集模式为关闭 */
    {5, "AT+TASKMD\r\n",          "AT+TASKMD=\"OFF\"\r\n"},
    
};

static const _dtu_atcmd_st dtu_collect_trans_poll_param_info[] = {
    
    /* 1.选择采集模式为自动透传采集 */
    {5, "AT+TASKMD\r\n",          "AT+TASKMD=\"TRANS\"\r\n"},
    
    /* 2.配置采集时间间隔和超时 */
    {5, "AT+TASKTIME\r\n",       "AT+TASKTIME=\"10\",\"1000\"\r\n"},
    
    /* 3.配置分发格式，默认关闭 */
    {5, "AT+TASKDIST\r\n",       "AT+TASKDIST=\"0\",\"<%d>\"\r\n"},
    
    /* 4.写入自动透传采集的命令，最多支持80条命令按顺序AT+TRANSCMD1到AT+TRANSCMD2到...到AT+TRANSCMD80 */
    {5, "AT+TRANSCMD1\r\n",     "AT+TRANSCMD1=\"010300000001840A\"\r\n"},
    {5, "AT+TRANSCMD2\r\n",     "AT+TRANSCMD2=\"010300010001D5CA\"\r\n"},
    {5, "AT+TRANSCMD3\r\n",     "AT+TRANSCMD3=\"01030002000125CA\"\r\n"},
    {5, "AT+TRANSCMD4\r\n",     "AT+TRANSCMD4=\"010300030001740A\"\r\n"},
    {5, "AT+TRANSCMD5\r\n",     "AT+TRANSCMD5=\"010300040001C5CB\"\r\n"},
    {5, "AT+TRANSCMD6\r\n",     "AT+TRANSCMD6=\"010300050001940B\"\r\n"},
    {5, "AT+TRANSCMD7\r\n",     "AT+TRANSCMD7=\"010300060001640B\"\r\n"},
    {5, "AT+TRANSCMD8\r\n",     "AT+TRANSCMD8=\"01030007000135CB\"\r\n"},
    {5, "AT+TRANSCMD9\r\n",     "AT+TRANSCMD9=\"01030008000105C8\"\r\n"},
    {5, "AT+TRANSCMD10\r\n",     "AT+TRANSCMD10=\"0103000900015408\"\r\n"},

    /* 5.配置自动透传采集命令数量，共10 实际有效命令 */
    {5, "AT+TRANSPOLLNUM\r\n",     "AT+TRANSPOLLNUM=\"10\"\r\n"},
    
};

static const _dtu_atcmd_st dtu_collect_modbus_user_param_info[] = {
    
    /* 1.选择采集模式为Modbus自动采集 */
    {5, "AT+TASKMD\r\n",          "AT+TASKMD=\"USER\"\r\n"},
    
    /* 2.配置采集时间间隔和超时 */
    {5, "AT+TASKTIME\r\n",       "AT+TASKTIME=\"5\",\"1000\"\r\n"},
    
    /* 3.配置json组合采集数量 */
    {5, "AT+TASKCOMBNUM\r\n",     "AT+TASKCOMBNUM=\"20\"\r\n"},
    
    /* 4.配置上传json数据的设备名称 */
    {5, "AT+TASKDEV\r\n",         "AT+TASKDEV=\"D4X-1\"\r\n"},
    /*AT+MODBUSCMD1 ~ AT+MODBUSCMD8 为标准Modbus协议*/    
    /* 5.写入Modbus采集的命令，最多支持80条命令按顺序AT+MODBUSCMD1到AT+MODBUSCMD2到...到AT+MODBUSCMD80 */
    {5, "AT+MODBUSCMD1\r\n",       "AT+MODBUSCMD1=\"RTU\",\"0\",\"cmd1\",\"1\",\"03\",\"0\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD2\r\n",       "AT+MODBUSCMD2=\"RTU\",\"0\",\"cmd2\",\"1\",\"03\",\"1\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD3\r\n",       "AT+MODBUSCMD3=\"RTU\",\"0\",\"cmd3\",\"1\",\"03\",\"2\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD4\r\n",       "AT+MODBUSCMD4=\"RTU\",\"0\",\"cmd4\",\"1\",\"03\",\"3\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD5\r\n",       "AT+MODBUSCMD5=\"RTU\",\"0\",\"cmd5\",\"1\",\"03\",\"4\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD6\r\n",       "AT+MODBUSCMD6=\"RTU\",\"0\",\"cmd6\",\"1\",\"03\",\"5\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD7\r\n",       "AT+MODBUSCMD7=\"RTU\",\"0\",\"cmd7\",\"1\",\"03\",\"6\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD8\r\n",       "AT+MODBUSCMD8=\"RTU\",\"0\",\"cmd8\",\"1\",\"03\",\"7\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD9\r\n",       "AT+MODBUSCMD9=\"RTU\",\"0\",\"cmd9\",\"1\",\"03\",\"8\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD10\r\n",      "AT+MODBUSCMD10=\"RTU\",\"0\",\"cmd10\",\"1\",\"03\",\"9\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    
//  /* AT+MODBUSCMD9 为TIME类型(当前时间)上报命令  AT+MODBUSCMD10 为HAND类型(手动写入固定数据，20字节长，可上报) */ 
//	{5, "AT+MODBUSCMD9\r\n",    	"AT+MODBUSCMD9=\"TIME\",\"0\",\"Now_Time\",\"0\",\"0\",\"0\",\"0\",\"0\",\"0\",\"0\"\r\n"},
//	{5, "AT+MODBUSCMD10\r\n",   "AT+MODBUSCMD10=\"HAND\",\"Sevice is D4X\",\"Name\",\"0\",\"0\",\"0\",\"0\",\"0\",\"0\",\"0\"\r\n"},
    
    /* 6.配置Modbus采集命令数量，共10 实际有效命令 */
    {5, "AT+MODBUSPOLLNUM\r\n", "AT+MODBUSPOLLNUM=\"10\"\r\n"},      
    
};


static const _dtu_atcmd_st dtu_collect_modbus_ali_param_info[] = {
    
    /* 1.选择采集模式为Modbus阿里云(模板) */
    {5, "AT+TASKMD\r\n",          "AT+TASKMD=\"ALI\"\r\n"},
    
    /* 2.配置采集时间间隔和超时 */
    {5, "AT+TASKTIME\r\n",       "AT+TASKTIME=\"10\",\"1000\"\r\n"},    
    
    /* 3.配置json组合采集数量 */
    {5, "AT+TASKCOMBNUM\r\n",     "AT+TASKCOMBNUM=\"20\"\r\n"},
    
    /* 4.写入Modbus采集的命令，最多支持80条命令按顺序AT+MODBUSCMD1到AT+MODBUSCMD2到...到AT+MODBUSCMD80 */
    {5, "AT+MODBUSCMD1\r\n",       "AT+MODBUSCMD1=\"RTU\",\"0\",\"cmd1\",\"1\",\"03\",\"0\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD2\r\n",       "AT+MODBUSCMD2=\"RTU\",\"0\",\"cmd2\",\"1\",\"03\",\"1\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD3\r\n",       "AT+MODBUSCMD3=\"RTU\",\"0\",\"cmd3\",\"1\",\"03\",\"2\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD4\r\n",       "AT+MODBUSCMD4=\"RTU\",\"0\",\"cmd4\",\"1\",\"03\",\"3\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD5\r\n",       "AT+MODBUSCMD5=\"RTU\",\"0\",\"cmd5\",\"1\",\"03\",\"4\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD6\r\n",       "AT+MODBUSCMD6=\"RTU\",\"0\",\"cmd6\",\"1\",\"03\",\"5\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD7\r\n",       "AT+MODBUSCMD7=\"RTU\",\"0\",\"cmd7\",\"1\",\"03\",\"6\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD8\r\n",       "AT+MODBUSCMD8=\"RTU\",\"0\",\"cmd8\",\"1\",\"03\",\"7\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD9\r\n",       "AT+MODBUSCMD9=\"RTU\",\"0\",\"cmd9\",\"1\",\"03\",\"8\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD10\r\n",   "AT+MODBUSCMD10=\"RTU\",\"0\",\"cmd10\",\"1\",\"03\",\"9\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},

    /* 5.配置Modbus采集命令数量，共10 实际有效命令 */
    {5, "AT+MODBUSPOLLNUM\r\n", "AT+MODBUSPOLLNUM=\"10\"\r\n"},    
    
};


static const _dtu_atcmd_st dtu_collect_modbus_onenet_param_info[] = {
    
    /* 1.选择采集模式为Modbus OneNET采集(模板) */
    {5, "AT+TASKMD\r\n",          "AT+TASKMD=\"ONENET\"\r\n"},
    
    /* 2.配置采集时间间隔和超时 */
    {5, "AT+TASKTIME\r\n",       "AT+TASKTIME=\"10\",\"1000\"\r\n"},
    
    /* 3.配置json组合采集数量 */
    {5, "AT+TASKCOMBNUM\r\n",     "AT+TASKCOMBNUM=\"20\"\r\n"},    

    /* 4.写入Modbus采集的命令，最多支持80条命令按顺序AT+MODBUSCMD1到AT+MODBUSCMD2到...到AT+MODBUSCMD80 */
    {5, "AT+MODBUSCMD1\r\n",       "AT+MODBUSCMD1=\"RTU\",\"0\",\"cmd1\",\"1\",\"03\",\"0\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD2\r\n",       "AT+MODBUSCMD2=\"RTU\",\"0\",\"cmd2\",\"1\",\"03\",\"1\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD3\r\n",       "AT+MODBUSCMD3=\"RTU\",\"0\",\"cmd3\",\"1\",\"03\",\"2\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD4\r\n",       "AT+MODBUSCMD4=\"RTU\",\"0\",\"cmd4\",\"1\",\"03\",\"3\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD5\r\n",       "AT+MODBUSCMD5=\"RTU\",\"0\",\"cmd5\",\"1\",\"03\",\"4\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD6\r\n",       "AT+MODBUSCMD6=\"RTU\",\"0\",\"cmd6\",\"1\",\"03\",\"5\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD7\r\n",       "AT+MODBUSCMD7=\"RTU\",\"0\",\"cmd7\",\"1\",\"03\",\"6\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD8\r\n",       "AT+MODBUSCMD8=\"RTU\",\"0\",\"cmd8\",\"1\",\"03\",\"7\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD9\r\n",       "AT+MODBUSCMD9=\"RTU\",\"0\",\"cmd9\",\"1\",\"03\",\"8\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},
    {5, "AT+MODBUSCMD10\r\n",   "AT+MODBUSCMD10=\"RTU\",\"0\",\"cmd10\",\"1\",\"03\",\"9\",\"uint16_AB\",\"1\",\"int\",\"0\"\r\n"},

    /* 5.配置Modbus采集命令数量，共10 实际有效命令 */
    {5, "AT+MODBUSPOLLNUM\r\n", "AT+MODBUSPOLLNUM=\"10\"\r\n"},    
    
};


/**
 * @brief       配置DTU工作参数
 * 
 * @param       work_param      :   工作模式的AT命令参数
 * @param       num             :   需要配置的AT命令参数个数
 * 
 * @return      0  :    所有参数配置成功
 *              n  :    第n个参数配置失败(1-n)
 */
static int dtu_config_work_param(_dtu_atcmd_st *work_param, uint8_t num)
{
    int i;
    int res = 0;

    for (i = 0; i < num; i++)
    {
        res = send_cmd_to_dtu((work_param + i)->read_cmd,
                              (work_param + i)->write_cmd + strlen((work_param + i)->read_cmd) - 1,
                              work_param[i].timeout);

        if (res == 1) /*如果DTU内部已经是我们需要配置的参数一致，则不需要重复去配置*/
        {
            continue;
        }
        else /*DTU内部不是我们需要设置的参数一致，则需要配置DTU内部参数*/
        {
            res = send_cmd_to_dtu((work_param + i)->write_cmd,
                                  "OK",
                                  (work_param + i)->timeout);

            if (res < 0)
            {
                return i+1;
            }
        }
    }

    return 0;
}

/**
 * @brief       初始化DTU的工作信息
 * 
 * @param       work_mode       :   DTU工作模式
 *  @arg        DTU_WORKMODE_NET,       0,  网络透传模式
 *  @arg        DTU_WORKMODE_HTTP,      1,  http透传模式
 *  @arg        DTU_WORKMODE_MQTT,      2,  mqtt透传模式
 *  @arg        DTU_WORKMODE_ALIYUN,    3,  阿里云透传模式
 *  @arg        DTU_WORKMODE_ONENET,    4,  OneNET透传模式
 *  @arg        DTU_WORKMODE_YUANZIYUN, 5,  原子云透传模式
 * 
 *@param        collect_mode     :    数据采集模式
 * @arg            DTU_COLLECT_OFF,        0,    关闭采集功能
 * @arg            DTU_COLLECT_TRANS,        1,    自动透传采集功能
 * @arg            DTU_COLLECT_MODBUS_USER 2,  Modbus自动采集
 * @arg            DTU_COLLECT_MODBUS_ALI  3,  Modbus阿里云采集功能(模板)
 * @arg            DTU_COLLECT_MODBUS_ONENET 4,Modbus OneNET采集功能(模板)
 *
 * @return      0   :   初始化成功
 *             -1   :   进入配置状态失败
 *               -2    :    DTU基本信息配置失败
 *             -3   :   DTU工作模式配置失败
 *               -4    :    DTU数据采集配置失败
 *             -5   :   DTU进入透传状态失败
 */
int dtu_config_init(_dtu_work_mode_eu work_mode, _dtu_collect_mode_eu collect_mode)
{
    int res;
    int try_cnt = 3;
    
    /* 1.DTU进入配置状态，最多尝试try_cnt */
    while( try_cnt > 0 )
    {
        res = dtu_enter_configmode();
        if ( res == 0 )
        {
            break;
        }
        
        delay_ms(500);
        try_cnt--;
    }
    if( try_cnt <= 0)
    {
        return -1;
    }
    
    
    /* 2.配置DTU基本工作信息 */
    res = dtu_config_work_param((_dtu_atcmd_st *)&dtu_basic_conf_param_info, sizeof(dtu_basic_conf_param_info) / sizeof(_dtu_atcmd_st));
    if( res != 0 )
    {
        return -2;
    }
    

    /* 3.配置DTU的工作模式 */
    switch (work_mode)
    {
        case DTU_WORKMODE_NET:
        {
            res = dtu_config_work_param((_dtu_atcmd_st *)&dtu_net_param_info, sizeof(dtu_net_param_info) / sizeof(_dtu_atcmd_st));
            break;
        }
        case DTU_WORKMODE_HTTP:
        {
            res = dtu_config_work_param((_dtu_atcmd_st *)&dtu_http_param_info, sizeof(dtu_http_param_info) / sizeof(_dtu_atcmd_st));
            break;
        }
        case DTU_WORKMODE_MQTT:
        {
            res = dtu_config_work_param((_dtu_atcmd_st *)&dtu_mqtt_param_info, sizeof(dtu_mqtt_param_info) / sizeof(_dtu_atcmd_st));
            break;
        }
        case DTU_WORKMODE_ALIYUN:
        {
            res = dtu_config_work_param((_dtu_atcmd_st *)&dtu_aliyun_param_info, sizeof(dtu_aliyun_param_info) / sizeof(_dtu_atcmd_st));
            break;
        }
        case DTU_WORKMODE_ONENET:
        {
            res = dtu_config_work_param((_dtu_atcmd_st *)&dtu_onenet_param_info, sizeof(dtu_onenet_param_info) / sizeof(_dtu_atcmd_st));
            break;
        }
        case DTU_WORKMODE_YUANZIYUN:
        {
            res = dtu_config_work_param((_dtu_atcmd_st *)&dtu_yuanziyun_param_info, sizeof(dtu_yuanziyun_param_info) / sizeof(_dtu_atcmd_st));
            break;
        }
        default:
        {
            break;
        }
    }

    if( res != 0 )
    {
        return -3;
    }
    
    
    /* 4.配置DTU的数据采集功能 */
    switch(collect_mode)
    {
        case DTU_COLLECT_OFF:
        {
            res = dtu_config_work_param((_dtu_atcmd_st *)&dtu_collect_disable_param_info, sizeof(dtu_collect_disable_param_info) / sizeof(_dtu_atcmd_st));
            break;
        }
        case DTU_COLLECT_TRANS:
        {
            res = dtu_config_work_param((_dtu_atcmd_st *)&dtu_collect_trans_poll_param_info, sizeof(dtu_collect_trans_poll_param_info) / sizeof(_dtu_atcmd_st));
            break;
        }
        case DTU_COLLECT_MODBUS_USER:
        {
            res = dtu_config_work_param((_dtu_atcmd_st *)&dtu_collect_modbus_user_param_info, sizeof(dtu_collect_modbus_user_param_info) / sizeof(_dtu_atcmd_st));
            break;
        }
        case DTU_COLLECT_MODBUS_ALI:
        {
            res = dtu_config_work_param((_dtu_atcmd_st *)&dtu_collect_modbus_ali_param_info, sizeof(dtu_collect_modbus_ali_param_info) / sizeof(_dtu_atcmd_st));
            break;
        }
        case DTU_COLLECT_MODBUS_ONENET:
        {
            res = dtu_config_work_param((_dtu_atcmd_st *)&dtu_collect_modbus_onenet_param_info, sizeof(dtu_collect_modbus_onenet_param_info) / sizeof(_dtu_atcmd_st));
            break;
        }
        default:
        {
            break;
        }
    }
    if( res != 0 )
    {
        return -4;
    }
    

    /*3.DTU进入透传状态*/
    res = dtu_enter_transfermode();
    if( res != 0 )
    {
        return -5;
    }

    return 0;
}





/**
 * @brief       发送短信功能
 * @param       phone : 手机号码
 * @param       sms_msg: 短信内容,只支持英文，不支持中文短信
 * @retval       1 : 发送短信OK,0:发送短信失败
 */

int dtu_send_sms(char *phone, char *sms_msg)
{
    #define DTU_SMS_SEND_BUF_MAX    (1024)
    static char dtu_sms_buf[1024];

    int res;
    int ret = 0;
    int try_cnt = 3;
    
    /* 1.DTU进入配置状态，最多尝试try_cnt */
    while( try_cnt > 0 )
    {
        res = dtu_enter_configmode();
        if ( res == 0 )
        {
            break;
        }
    
        delay_ms(500);
        try_cnt--;
    }
    if( try_cnt <= 0)
    {
        return -1;
    }

    snprintf(dtu_sms_buf, DTU_SMS_SEND_BUF_MAX, "AT+SMSEND=\"%s\",\"%s\"\r\n", phone, sms_msg);

    /* 2.DTU发送短信 */
    res = send_cmd_to_dtu(dtu_sms_buf, "SMSEND OK", 100);
    if( res == 1 )
    {
        ret = 1;
    }

    /*3.DTU进入透传状态*/
    res = dtu_enter_transfermode();
    if( res != 0 )
    {
        return -3;
    }

    return ret;
}


/**
 * @brief       DTU设备重启
 * @return      0     : 设备重启成功
 *                -1     : 进入配置状态失败
 *                -2     : 重启命令执行失败
 */
int dtu_power_reset(void)
{
    int res;
    int try_cnt = 3;
    
    /* 1.DTU进入配置状态，最多尝试try_cnt */
    while(try_cnt > 0)
    {
        res = dtu_enter_configmode();
        if ( res == 0 )
        {
            break;
        }
        
        delay_ms(500);
        try_cnt--;            
    }
    if( try_cnt <= 0)
    {
        return -1;
    }
    
        
    /* 2.DTU重启命令 */
    res = send_cmd_to_dtu("AT+PWR\r\n", "OK", 5);
    if (res < 0)
    {
        return -2;
    }        
        
    return 0;
}


/**
 * @brief       DTU基站定位信息查询功能
 * 
 * @param[out]  data_buffer : 用户提供的缓冲区，用于存储定位返回的信息
 * @param[in]   buffer_size : 缓冲区大小，单位：字节
 * 
 * @return      int         : 返回查询结果标志
 *                0         : 定位信息查询成功
 *               -1         : 进入配置状态失败
 *               -2         : 定位命令执行失败或超时
 *               -3         : 进入透传状态失败
 */

int dtu_base_station_location_info(uint8_t *data_buffer, uint32_t buffer_size)
{
    int res;
    int try_cnt = 3;

    /* 1.DTU进入配置状态，最多尝试try_cnt */
    while(try_cnt > 0)
    {
        res = dtu_enter_configmode();
        if ( res == 0 )
        {
            break;
        }
        
        delay_ms(500);
        try_cnt--;            
    }
    if( try_cnt <= 0)
    {
        return -1;
    }
    
    
    /* 2.DTU 基站定位命令 */
    uint8_t *data = send_cmd_to_receive("AT+LOC\r\n", 10000);
    if(data == NULL)
    {
        return -2;
    }
    
    /* 写入返回数据 */
    uint32_t data_size = strlen((char *)data) + 1;
    if (data_size > buffer_size)
    {
        return -2;
    }
    memcpy(data_buffer, data, data_size);


    /*3.DTU进入透传状态*/
    res = dtu_enter_transfermode();
    if( res != 0 )
    {
        return -3;
    }
    
    return 0;
}




/**
 * @brief       设备状态信息查询功能，用于查询当前D4X设备当前工作模式/网络状态等信息，用户可根据需要修改，通过USART2串口调试助手发送相应的指令即可
 */

// 状态数据结构，存储设备状态信息
typedef struct 
{
    char work_mode[16];         // 工作模式
    struct 
    {
        char enable[4];            // 是否开启该连接
        char mode[8];            // 连接模式
        char server_addr[64];    // 服务器地址
        char port[16];            // 服务器端口
        char state[4];            // 连接状态
    } socket[4];
    char collect[16];             // 数据采集状态
} device_state_t;


/**
 * @brief       进入配置模式，支持重试
 * 
 * @param[in]   max_retry : 最大重试次数
 * 
 * @return      int       : 返回操作结果标志
 *                0       : 进入配置模式成功
 *               -1       : 进入配置模式失败
 */
static int dtu_enter_configmode_retry(int max_retry) 
{
    int try_cnt = max_retry;
    int res;
    
    while (try_cnt > 0) 
    {
        res = dtu_enter_configmode();
        if (res == 0) 
        {
            return 0;
        }
        
        delay_ms(500);
        try_cnt--;
    }
    
    return -1;
}


/**
 * @brief       查询设备的工作模式
 * 
 * @param[out]  state : 设备状态结构体，用于存储工作模式
 * 
 * @return      int   : 返回查询结果标志
 *                0   : 查询成功
 *               -1   : 查询失败
 */
static int query_work_mode(device_state_t *state) 
{
    uint8_t *data = send_cmd_to_receive("AT+WORK\r\n", 5000);
    
    if (strstr((char *)data, "+WORK:\"NET\"") != NULL) 
    {
        strcpy(state->work_mode, "NET");
    } 
    else if (strstr((char *)data, "+WORK:\"MQTT\"") != NULL) 
    {
        strcpy(state->work_mode, "MQTT");
    } 
    else if (strstr((char *)data, "+WORK:\"HTTP\"") != NULL) 
    {
        strcpy(state->work_mode, "HTTP");
    } 
    else if (strstr((char *)data, "+WORK:\"ALIYUN\"") != NULL) 
    {
        strcpy(state->work_mode, "ALIYUN");
    } 
    else if (strstr((char *)data, "+WORK:\"ONENET\"") != NULL) 
    {
        strcpy(state->work_mode, "ONENET");
    } 
    else if (strstr((char *)data, "+WORK:\"RNDIS\"") != NULL) 
    {
        strcpy(state->work_mode, "RNDIS");
    } 
    else if (strstr((char *)data, "+WORK:\"YUANZIYUN\"") != NULL) 
    {
        strcpy(state->work_mode, "YUANZIYUN");
    } 
    else 
    {
        return -1;
    }
    
    return 0;
}
