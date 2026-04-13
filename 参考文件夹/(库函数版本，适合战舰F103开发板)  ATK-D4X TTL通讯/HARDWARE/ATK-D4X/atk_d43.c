#include "sys.h"
#include "delay.h"
#include "usart.h"
#include <stdlib.h>
#include "uart2.h"
#include "atk_d43.h"
#include "RingBuffer.h"
#include "string.h"

/**
 * ****************************************************************************
 * @file            dtu.c
 * @author          正点原子团队（ALIENTEK）
 * @version         V1.0
 * @data            2025/9/17
 * @brief           DTU驱动代码
 * @copyright       Copyright (c) 2020-2032, 广州市星翼电子科技有限公司
 * ****************************************************************************
 * @attention       
 * 
 * 实验平台：正点原子STM32F103开发板    +   正点原子ATK-D4X（4G Cat1 DTU产品）
 * 在线视频:www.yuanzige.com
 * 技术论坛:www.openedv.com
 * 公司网址:www.alientek.com
 * 购买地址:openedv.taobao.com
 * 
 * 修改说明
 * V1.0 20200414
 * 第一次发布
 * ****************************************************************************
*/

extern RingBuffer *p_uart2_rxbuf;

static uint8_t dtu_rxcmdbuf[DTU_RX_CMD_BUF_SIZE]; /*处理DTU相关数据缓存*/

/**
 * @brief       发送数据到DTU
 * 
 * @param       data:   需要发送数据的缓存地址
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
 * @brief       发送命令到DTU并进行数据校验
 * 
 * @param       cmd     :   需要发送的AT指令
 * @param       ask     :   需要校验的应答数据
 * @param       timeout :   AT指令校验超时时间，单位：100ms
 * 
 * @return      1  :   校验ask数据成功
 *              0  :   DTU返回OK
 *             -1  :   DTU返回ERROR
 *             -2  :   发送AT指令校验超时
 */
static int send_cmd_to_dtu(char *cmd, char *ask, uint32_t timeout)
{
    uint32_t rx_len = 0;

    /*初始化缓存数据*/
    memset(dtu_rxcmdbuf, 0, DTU_RX_CMD_BUF_SIZE);
    RingBuffer_Reset(p_uart2_rxbuf);

    /*发送AT指令到DTU*/
    send_data_to_dtu((uint8_t *)cmd, strlen(cmd));

    /*等待DTU应答AT指令结果*/
    while (1)
    {
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

        if (RingBuffer_Len(p_uart2_rxbuf) > 0)
        {
            RingBuffer_Out(p_uart2_rxbuf, &dtu_rxcmdbuf[rx_len++], 1); //从串口缓存中读一个字节

            if (rx_len >= DTU_RX_CMD_BUF_SIZE) /*接收应答数据超长，返回ERROR*/
            {
                return -1;
            }
        }
        else
        {
            timeout--;

            if (timeout == 0)
            {
                return -2;
            }

            delay_ms(100);
        }
    }
}

/**
 * @brief       发送命令并接收数据，直到超时或 100ms 内无新数据
 * 
 * @param       cmd     :   需要发送的AT指令
 * @param       timeout :   超时时间（单位：ms）
 * 
 * @return      uint8_t*: 返回接收到的数据缓冲区地址
 *                        如果超时未接收到数据，返回 NULL
 */
static uint8_t *send_cmd_to_receive(char *cmd, uint32_t timeout)
{
    uint32_t rx_len = 0;
    uint32_t elapsed_time = 0;
    uint32_t idle_time = 0; 

    /*初始化缓存数据*/
    memset(dtu_rxcmdbuf, 0, DTU_RX_CMD_BUF_SIZE);
    RingBuffer_Reset(p_uart2_rxbuf);
    
    /*发送AT指令到DTU*/
    send_data_to_dtu((uint8_t *)cmd, strlen(cmd));    
    
    /* 开始接收数据 */
    while (elapsed_time < timeout)
    {
        /* 如果串口缓冲区有数据 */
        if (RingBuffer_Len(p_uart2_rxbuf) > 0)
        {
            RingBuffer_Out(p_uart2_rxbuf, &dtu_rxcmdbuf[rx_len++], 1);
        
            if (rx_len >= DTU_RX_CMD_BUF_SIZE)
            {
                break;
            }
    
            /* 数据到达，重置空闲时间 */
            idle_time = 0;
        }
        else
        {
            /* 如果没有数据，增加空闲时间 */
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
    if (res == -1) /*返回ERRRO表示DTU已经处于配置状态*/
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
 * @brief       DTU自动上报URC信息处理函数:处理+ATK ERROR信息
 * 
 * @param       data    :   接收到DTU的URC数据缓存
 * @param       len     :   URC数据长度
 * 
 * @return      无
 */
static void dtu_urc_atk_error(const char *data, uint32_t len)
{
    printf("\r\nURC :   dtu_urc_atk_error\r\n");
}

/**
 * @brief       DTU自动上报URC信息处理函数:处理Please check SIM Card信息
 * 
 * @param       data    :   接收到DTU的URC数据缓存
 * @param       len     :   URC数据长度
 * 
 * @return      无
 */
static void dtu_urc_error_sim(const char *data, uint32_t len)
{
    printf("\r\nURC :   dtu_urc_error_sim\r\n");
}

/**
 * @brief       DTU自动上报URC信息处理函数:处理Please check GPRS信息
 * 
 * @param       data    :   接收到DTU的URC数据缓存
 * @param       len     :   URC数据长度
 * 
 * @return      无
 */
static void dtu_urc_error_gprs(const char *data, uint32_t len)
{
    printf("\r\nURC :   dtu_urc_error_gprs\r\n");
}

/**
 * @brief       DTU自动上报URC信息处理函数:处理Please check CSQ信息
 * 
 * @param       data    :   接收到DTU的URC数据缓存
 * @param       len     :   URC数据长度
 * 
 * @return      无
 */
static void dtu_urc_error_csq(const char *data, uint32_t len)
{
    printf("\r\nURC :   dtu_urc_error_csq\r\n");
}

/**
 * @brief       DTU自动上报URC信息处理函数:处理Please check MQTT Parameter信息
 * 
 * @param       data    :   接收到DTU的URC数据缓存
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
       
        {"+ATK ERROR:",                         dtu_urc_atk_error},         /*DTU存在问题，需要联系技术支持进行确认*/
        {"Please check SIM Card !!!\r\n",       dtu_urc_error_sim},         /*DTU未检测到手机卡,请检查手机卡是否正确插入*/
        {"Please check GPRS !!!\r\n",           dtu_urc_error_gprs},        /*请检查SIM卡是否欠费*/
        {"Please check CSQ !!!\r\n",            dtu_urc_error_csq},         /*请检查天线是否正确接入，并确保天线位置的正确性*/
        {"Please check MQTT Parameter !!!\r\n", dtu_urc_error_mqtt},        /*MQTT参数有误*/
};

/**
 * @brief       处理DTU主动上报的URC信息数据，注意：串口每接收一个字节数据，都需要通过函数入口传输进来
 * 
 * @param       ch    :   串口接收的一个字节数据
 * 
 * @return      无
 */
void dtu_get_urc_info(uint8_t ch)
{
    static uint8_t ch_last = 0;
    static uint32_t rx_len = 0;
    int i;

    /*接收DTU数据*/
    dtu_rxcmdbuf[rx_len++] = ch;
    if (rx_len >= DTU_RX_CMD_BUF_SIZE)
    { /*超长处理*/
        ch_last = 0;
        rx_len = 0;
        memset(dtu_rxcmdbuf, 0, DTU_RX_CMD_BUF_SIZE);
    }

    /*处理DTU的URC数据*/
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
    
    /* 1. 串口相关参数配置：默认不更改，若需更改需要在更改后重新设置开发板与D4X通信的波特率 */
    {5, "AT+UART\r\n",          "AT+UART=\"115200\",\"1\",\"8\",\"NONE\"\r\n"},
    {5, "AT+UARTLT\r\n",          "AT+UARTLT=\"1024\",\"50\"\r\n"},
    
    /* 2.透传指令相关参数配置 */
    {5, "AT+CMDKEY\r\n",          "AT+CMDKEY=\"ALIENTEK\"\r\n"},
    {5, "AT+UARTAT\r\n",          "AT+UARTAT=\"OFF\"\r\n"},
    {5, "AT+NETAT\r\n",          "AT+NETAT=\"ON\"\r\n"},
    
    /* 3.指令回显 */
    {5, "AT+R\r\n",              "AT+R=\"ON\"\r\n"},
    
    /* 4.SIM卡配置 */
    {5, "AT+APN\r\n",              "AT+APN=\"AUTO\",\"\",\"\"\r\n"},
    
    /* 5.启动提示信息 + 标识 */
    {5, "AT+START\r\n",          "AT+START=\"ATK-D4X\"\r\n"},
    {5, "AT+USER\r\n",          "AT+USER=\"ALIENTEK\"\r\n"},
    
    /* 6.重启时间参数配置 */
    {5, "AT+RSTIM\r\n",          "AT+RSTIM=\"1200\"\r\n"},
    {5, "AT+LINKRSTM\r\n",       "AT+LINKRSTM=\"120\"\r\n"},
    
    /* 7.自动更新 */
    {5, "AT+AUTOUP\r\n",          "AT+AUTOUP=\"ON\"\r\n"},
    
};

static const _dtu_atcmd_st dtu_net_param_info[] = {

    /*1.选择工作模式为：网络透传模式 */
    {5, "AT+WORK\r\n",          "AT+WORK=\"NET\"\r\n"},

    /*2.配置网络透传模式的工作参数*/
    {5, "AT+LINK1EN\r\n",       "AT+LINK1EN=\"ON\"\r\n"},
    
    {5, "AT+LINK1\r\n",         "AT+LINK1=\"TCP\",\"8.135.10.183\",\"34195\"\r\n"},
    {5, "AT+LINK1MD\r\n",       "AT+LINK1MD=\"LONG\"\r\n"},
    {5, "AT+LINK1TM\r\n",       "AT+LINK1TM=\"5\"\r\n"},

    {5, "AT+LINK2EN\r\n",       "AT+LINK2EN=\"OFF\"\r\n"},
    {5, "AT+LINK3EN\r\n",       "AT+LINK3EN=\"OFF\"\r\n"},
    {5, "AT+LINK4EN\r\n",       "AT+LINK4EN=\"OFF\"\r\n"},
        
    {5, "AT+SENDFAST\r\n",      "AT+SENDFAST=\"ON\"\r\n"},

    /*3.配置心跳包功能：默认打开         注意：强烈建议开启心跳包功能！！！*/
    {5, "AT+HRTEN\r\n",         "AT+HRTEN=\"ON\"\r\n"},
    {5, "AT+HRTDT\r\n",         "AT+HRTDT=\"414C49454E54454B2D4852544454\"\r\n"},
    {5, "AT+HRTTM\r\n",         "AT+HRTTM=\"120\"\r\n"},

    /*4.配置注册包功能：默认关闭 */
    {5, "AT+REGEN\r\n",         "AT+REGEN=\"OFF\"\r\n"},
    {5, "AT+REGDT\r\n",         "AT+REGDT=\"414C49454E54454B2D5245474454\"\r\n"},
    {5, "AT+REGMD\r\n",         "AT+REGMD=\"LINK\"\r\n"},
    {5, "AT+REGTP\r\n",         "AT+REGTP=\"IMEI\"\r\n"},

    /*5.其他参数功能配置*/
};

static const _dtu_atcmd_st dtu_http_param_info[] = {

    /*1.选择工作模式为：HTTP透传模式*/
    {5, "AT+WORK\r\n",          "AT+WORK=\"HTTP\"\r\n"},

    /*2.配置HTTP透传模式的工作参数*/
    {5, "AT+HTTPMD\r\n",        "AT+HTTPMD=\"GET\"\r\n"},
    {5, "AT+HTTPURL\r\n",       "AT+HTTPURL=\"https://cloud.alientek.com/testfordtu?data=\"\r\n"},
    {5, "AT+HTTPTM\r\n",        "AT+HTTPTM=\"10\"\r\n"},
    {5, "AT+HTTPHD\r\n",        "AT+HTTPHD=\"Connection:close\"\r\n"},
    {5, "AT+HTTPHDFLT\r\n",        "AT+HTTPHDFLT=\"OFF\"\r\n"},

    /*3.其他参数功能配置*/
};

static const _dtu_atcmd_st dtu_mqtt_param_info[] = {

    /*1.选择工作模式为：MQTT透传模式*/
    {5, "AT+WORK\r\n",          "AT+WORK=\"MQTT\"\r\n"},

    /*2.配置MQTT透传模式的工作参数*/
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

    /*3.其他参数功能配置*/
};

static const _dtu_atcmd_st dtu_aliyun_param_info[] = {

    /*1.选择工作模式为：阿里云透传模式*/
    {5, "AT+WORK\r\n",          "AT+WORK=\"ALIYUN\"\r\n"},

    /*2.配置阿里云透传模式的工作参数*/
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

    /*3.其他参数功能配置*/
};

static const _dtu_atcmd_st dtu_onenet_param_info[] = {

    /*1.选择工作模式为：OneNET透传模式*/
    {5, "AT+WORK\r\n",          "AT+WORK=\"ONENET\"\r\n"},

    /*2.配置OneNET透传模式的工作参数*/
    {5, "AT+ONEDI\r\n",         "AT+ONEDI=\"12345\"\r\n"},                              /*设备ID*/
    {5, "AT+ONEPI\r\n",         "AT+ONEPI=\"1234567890\"\r\n"},                         /*产品ID*/
    
    {5, "AT+ONEKEY\r\n",        "AT+ONEKEY=\"12345678901234567890\"\r\n"},              /*设备密钥*/
    {5, "AT+ONEIP\r\n",         "AT+ONEIP=\"mqtt.heclouds.com\",\"1883\"\r\n"},         /*服务器地址默认*/
        
    {5, "AT+ONESUB1\r\n",       "AT+ONESUB1=\"0\",\"atk/sub1\",\"0\"\r\n"},             /*若开启主题，主题必须正确，否则连接会失败*/
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
        
    /*3.其他参数功能配置*/
};

static const _dtu_atcmd_st dtu_yuanziyun_param_info[] = {

    /*1.选择工作模式为：原子云透传模式*/
    {5, "AT+WORK\r\n",          "AT+WORK=\"YUANZIYUN\"\r\n"},

    /*2.配置原子云透传模式的工作参数（0：旧版   1：新版）*/
    /*注意：DTU连接新版原子云后会绑定IMEI，若想连接其他原子云上的传感器需删除前面绑定的原子云传感器，否则新原子云传感器无法连接成功*/
    {5, "AT+SVRLINK\r\n",       "AT+SVRLINK=\"1\"\r\n"},
    {5, "AT+SVRNUM\r\n",        "AT+SVRNUM=\"19678652400876093448\"\r\n"},
    {5, "AT+SVRKEY\r\n",        "AT+SVRKEY=\"12345678\"\r\n"},

    /*3.其他参数功能配置*/
};


static const _dtu_atcmd_st dtu_collect_disable_param_info[] = {
    
    /* 1.选择采集模式为：关闭 */
    {5, "AT+TASKMD\r\n",          "AT+TASKMD=\"OFF\"\r\n"},
    
};

static const _dtu_atcmd_st dtu_collect_trans_poll_param_info[] = {
    
    /* 1.选择采集模式为：自定义轮询 */
    {5, "AT+TASKMD\r\n",          "AT+TASKMD=\"TRANS\"\r\n"},
    
    /* 2.配置采集的轮询周期和间隔 */
    {5, "AT+TASKTIME\r\n",       "AT+TASKTIME=\"10\",\"1000\"\r\n"},
    
    /* 3.配置特定主题分发：关闭 */
    {5, "AT+TASKDIST\r\n",       "AT+TASKDIST=\"0\",\"<%d>\"\r\n"},
    
    /* 4.写入自定义轮询的数据：最大支持80条，顺序是AT+TRANSCMD1、AT+TRANSCMD2、...、AT+TRANSCMD80 */
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

    /* 5.配置自定义轮询数量：根据 步骤4 实际数量配置 */
    {5, "AT+TRANSPOLLNUM\r\n",     "AT+TRANSPOLLNUM=\"10\"\r\n"},
    
};

static const _dtu_atcmd_st dtu_collect_modbus_user_param_info[] = {
    
    /* 1.选择采集模式为：Modbus自定义 */
    {5, "AT+TASKMD\r\n",          "AT+TASKMD=\"USER\"\r\n"},
    
    /* 2.配置采集的轮询周期和间隔 */
    {5, "AT+TASKTIME\r\n",       "AT+TASKTIME=\"5\",\"1000\"\r\n"},
    
    /* 3.配置json单次数据最大打包数量 */
    {5, "AT+TASKCOMBNUM\r\n",     "AT+TASKCOMBNUM=\"20\"\r\n"},
    
    /* 4.配置上传json数据的设备名称 */
    {5, "AT+TASKDEV\r\n",         "AT+TASKDEV=\"D4X-1\"\r\n"},
    /*AT+MODBUSCMD1 ~ AT+MODBUSCMD8 为标准Modbus协议*/    
    /* 5.写入Modbus轮询的数据：最大支持80条，顺序是AT+MODBUSCMD1、AT+MODBUSCMD2、...、AT+MODBUSCMD80 */
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
    
//  /* AT+MODBUSCMD9 为TIME（当前时间）上报， AT+MODBUSCMD10 为HAND（手写固定内容（20字节内））上报 */ 
//	{5, "AT+MODBUSCMD9\r\n",   	"AT+MODBUSCMD9=\"TIME\",\"0\",\"Now_Time\",\"0\",\"0\",\"0\",\"0\",\"0\",\"0\",\"0\"\r\n"},
//	{5, "AT+MODBUSCMD10\r\n",   "AT+MODBUSCMD10=\"HAND\",\"Sevice is D4X\",\"Name\",\"0\",\"0\",\"0\",\"0\",\"0\",\"0\",\"0\"\r\n"},
    
    /* 6.配置Modbus轮询数量：根据 步骤5 实际数量配置 */
    {5, "AT+MODBUSPOLLNUM\r\n", "AT+MODBUSPOLLNUM=\"10\"\r\n"},      
    
};


static const _dtu_atcmd_st dtu_collect_modbus_ali_param_info[] = {
    
    /* 1.选择采集模式为：Modbus阿里云（物模型） */
    {5, "AT+TASKMD\r\n",          "AT+TASKMD=\"ALI\"\r\n"},
    
    /* 2.配置采集的轮询周期和间隔 */
    {5, "AT+TASKTIME\r\n",       "AT+TASKTIME=\"10\",\"1000\"\r\n"},    
    
    /* 3.配置json单次数据最大打包数量 */
    {5, "AT+TASKCOMBNUM\r\n",     "AT+TASKCOMBNUM=\"20\"\r\n"},
    
    /* 4.写入Modbus轮询的数据：最大支持80条，顺序是AT+MODBUSCMD1、AT+MODBUSCMD2、...、AT+MODBUSCMD80 */
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

    /* 5.配置Modbus轮询数量：根据 步骤4 实际数量配置 */
    {5, "AT+MODBUSPOLLNUM\r\n", "AT+MODBUSPOLLNUM=\"10\"\r\n"},    
    
};


static const _dtu_atcmd_st dtu_collect_modbus_onenet_param_info[] = {
    
    /* 1.选择采集模式为：Modbus OneNET（物模型） */
    {5, "AT+TASKMD\r\n",          "AT+TASKMD=\"ONENET\"\r\n"},
    
    /* 2.配置采集的轮询周期和间隔 */
    {5, "AT+TASKTIME\r\n",       "AT+TASKTIME=\"10\",\"1000\"\r\n"},
    
    /* 3.配置json单次数据最大打包数量 */
    {5, "AT+TASKCOMBNUM\r\n",     "AT+TASKCOMBNUM=\"20\"\r\n"},    

    /* 4.写入Modbus轮询的数据：最大支持80条，顺序是AT+MODBUSCMD1、AT+MODBUSCMD2、...、AT+MODBUSCMD80 */
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

    /* 5.配置Modbus轮询数量：根据 步骤4 实际数量配置 */
    {5, "AT+MODBUSPOLLNUM\r\n", "AT+MODBUSPOLLNUM=\"10\"\r\n"},    
    
};


/**
 * @brief       配置DTU工作参数
 * 
 * @param       work_param      :   工作模式相关AT指令参数
 * @param       num             :   需要配置的AT指令参数数量
 * 
 * @return      0  :    所有参数配置成功
 *              n  :    第几个参数配置失败：1-n
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

        if (res == 1) /*如果DTU内部参数和需要配置的参数一致，不需要重复去配置*/
        {
            continue;
        }
        else /*DTU内部参数与配置参数不一致，需要更新DTU内部参数*/
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
 * @arg            DTU_COLLECT_TRANS,        1,    自定义透传采集功能
 * @arg            DTU_COLLECT_MODBUS_USER 2,  Modbus自定义采集
 * @arg            DTU_COLLECT_MODBUS_ALI  3,  Modbus阿里云采集（物模型）
 * @arg            DTU_COLLECT_MODBUS_ONENET 4,Modbus OneNET采集（物模型）
 *
 * @return      0   :   初始化成功
 *             -1   :   进入配置状态失败
 *               -2    :    DTU基础信息配置失败
 *             -3   :   DTU工作参数配置失败
 *               -4    :    DTU数据采集配置失败
 *             -5   :   DTU进入透传状态失败
 */
int dtu_config_init(_dtu_work_mode_eu work_mode, _dtu_collect_mode_eu collect_mode)
{
    int res;
    int try_cnt = 3;
    
    /* 1.DTU进入配置状态：最大尝试次数try_cnt */
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
    
    
    /* 2.配置DTU基础功能信息 */
    res = dtu_config_work_param((_dtu_atcmd_st *)&dtu_basic_conf_param_info, sizeof(dtu_basic_conf_param_info) / sizeof(_dtu_atcmd_st));
    if( res != 0 )
    {
        return -2;
    }
    

    /* 3.配置DTU的工作参数 */
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
    
    
    /* 4.配置DTU的数据采集参数 */
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
 * @brief       发送短信示例
 * @param       phone : 手机号码
 * @param       sms_msg: 短信内容,只能是英文，不支持中文短信
 * @retval       1 : 短信发送OK，0：短信发送错误
 */

int dtu_send_sms(char *phone, char *sms_msg)
{
    #define DTU_SMS_SEND_BUF_MAX    (1024)
    static char dtu_sms_buf[1024];

    int res;
    int ret = 0;
    int try_cnt = 3;
    
    /* 1.DTU进入配置状态：最大尝试次数try_cnt */
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
 *                -2     : 重启指令执行失败
 */
int dtu_power_reset(void)
{
    int res;
    int try_cnt = 3;
    
    /* 1.DTU进入配置状态：最大尝试次数try_cnt */
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
    
        
    /* 2.DTU重启指令 */
    res = send_cmd_to_dtu("AT+PWR\r\n", "OK", 5);
    if (res < 0)
    {
        return -2;
    }        
        
    return 0;
}


/**
 * @brief       DTU基站定位（需购买次数）
 * 
 * @param[out]  data_buffer : 调用者提供的缓冲区，用于存储定位返回的数据
 * @param[in]   buffer_size : 缓冲区大小（单位：字节）
 * 
 * @return      int         : 返回错误码或成功标志
 *                0         : 定位信息返回成功
 *               -1         : 进入配置状态失败
 *               -2         : 定位指令执行失败或缓冲区不足
 *               -3         : 进入透传状态失败
 */

int dtu_base_station_location_info(uint8_t *data_buffer, uint32_t buffer_size)
{
    int res;
    int try_cnt = 3;

    /* 1.DTU进入配置状态：最大尝试次数try_cnt */
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
    
    
    /* 2.DTU 基站定位指令 */
    uint8_t *data = send_cmd_to_receive("AT+LOC\r\n", 10000);
    if(data == NULL)
    {
        return -2;
    }
    
    /* 写入缓冲区 */
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
 * @brief       下面是设备状态信息查询的内容，用于查询当前D4X设备当前工作模式/运行状态等内容，无特殊情况无需修改（通过按键触发，与其他函数无冲突）
 */

// 定义数据结构来存储解析后的信息
typedef struct 
{
    char work_mode[16];         // 工作模式
    struct 
    {
        char enable[4];            // 是否打开该通道
        char mode[8];            // 运行模式
        char server_addr[64];    // 服务器地址
        char port[16];            // 服务器端口
        char state[4];            // 运行状态
    } socket[4];
    char collect[16];             // 数据采集状态
} device_state_t;


/**
 * @brief       进入配置模式，支持重试
 * 
 * @param[in]   max_retry : 最大重试次数
 * 
 * @return      int       : 返回错误码或成功标志
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
 * @return      int   : 返回错误码或成功标志
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


/**
 * @brief       查询设备的连接状态
 * 
 * @param[out]  state : 设备状态结构体，用于存储连接状态
 * 
 * @return      int   : 返回错误码或成功标志
 *                0   : 查询成功
 */
static int query_connection_status(device_state_t *state) 
{
    uint8_t *data = send_cmd_to_receive("AT+SOCKETLINK\r\n", 5000);

    // NET模式有4个通道，其他模式只有1个通道
    int socket_count = (strcmp(state->work_mode, "NET") == 0) ? 4 : 1;

    for (int i = 0; i < socket_count; i++) 
    {
        char key[16];
        sprintf(key, "+SOCKETLINK%d:", i + 1);

        char *state_str = strstr((char *)data, key);
        if (state_str != NULL) 
        {
            char *state_val_start = strstr(state_str, "\"") + 1;
            char *state_val_end = strstr(state_val_start, "\"");
            if (state_val_end != NULL) 
            {
                *state_val_end = '\0';
            }

            strcpy(state->socket[i].state, state_val_start);
        } 
        else 
        {
            strcpy(state->socket[i].state, "OFF");
        }

    }

    return 0;
}


/**
 * @brief       查询设备的服务器地址
 * 
 * @param[out]  state : 设备状态结构体，用于存储服务器地址
 * 
 * @return      int   : 返回错误码或成功标志
 *                0   : 查询成功
 */
static int query_server_address(device_state_t *state) 
{
    if (strcmp(state->work_mode, "NET") == 0) 
    {
        for (int i = 0; i < 4; i++) 
        {
            char cmd[16];
            sprintf(cmd, "AT+LINK%d\r\n", i + 1);
            uint8_t *data = send_cmd_to_receive(cmd, 5000);


            char *mode_start = strstr((char *)data, "\"") + 1;
            char *mode_end = strstr(mode_start, "\"");
            if (mode_end != NULL) 
            {
                *mode_end = '\0';
            }

            char *server_start = strstr(mode_end + 1, "\"") + 1;
            char *server_end = strstr(server_start, "\"");
            if (server_end != NULL) 
            {
                *server_end = '\0';
            }

            char *port_start = strstr(server_end + 1, "\"") + 1;
            char *port_end = strstr(port_start, "\"");
            if (port_end != NULL) 
            {
                *port_end = '\0';
            }

            strcpy(state->socket[i].mode, mode_start);
            strcpy(state->socket[i].server_addr, server_start);
            strcpy(state->socket[i].port, port_start);

            
            sprintf(cmd, "AT+LINK%dEN\r\n", i + 1);
            data = send_cmd_to_receive(cmd, 5000);

            char *enable = strstr((char *)data, "\"") + 1;
            strncpy(state->socket[i].enable, enable, 3);
            state->socket[i].enable[3] = '\0';

        }
    } 
    else if (strcmp(state->work_mode, "MQTT") == 0) 
    {
        uint8_t *data = send_cmd_to_receive("AT+MQTTIP\r\n", 5000);

        char *server = strstr((char *)data, "\"") + 1;
        char *server_end = strchr(server, '\"');
        if (server_end != NULL) 
        {
            *server_end = '\0';
        }
        
        strcpy(state->socket[0].server_addr, server);

        char *port_start = strchr(server_end + 1, '"') + 1;
        char *port_end = strchr(port_start, '"');
        if (port_end != NULL) 
        {
            *port_end = '\0';
        }
        
        strcpy(state->socket[0].port, port_start);
        strcpy(state->socket[0].mode, "MQTT");
        strcpy(state->socket[0].enable, "ON");

    }
    else if (strcmp(state->work_mode, "HTTP") == 0) 
    {
        uint8_t *data = send_cmd_to_receive("AT+HTTPMD\r\n", 5000);
        
        char *method = strstr((char *)data, "\"") + 1;
        char *method_end = strstr(method, "\"");
        if (method_end != NULL) 
        {
            *method_end = '\0';
        }
        sscanf(method, "%s", state->socket[0].mode);

        data = send_cmd_to_receive("AT+HTTPURL\r\n", 5000);
        
        char *url_start = strstr((char *)data, "\"") + 1;
        char *url_end = strstr(url_start, "\"");
        if (url_end != NULL) 
        {
            *url_end = '\0';
        }

        strcpy(state->socket[0].server_addr, url_start);
        strcpy(state->socket[0].enable, "ON");

    } 
    else if (strcmp(state->work_mode, "ALIYUN") == 0 || strcmp(state->work_mode, "ONENET") == 0 || strcmp(state->work_mode, "RNDIS") == 0) 
    {
        strcpy(state->socket[0].mode, state->work_mode);
        strcpy(state->socket[0].enable, "ON");

    } 
    else if (strcmp(state->work_mode, "YUANZIYUN") == 0) 
    {
        uint8_t *data = send_cmd_to_receive("AT+SVRLINK\r\n", 5000);

        char *link = strstr((char *)data, "\"") + 1;
        if (strcmp(link, "1") == 0) 
        {
            strcpy(state->socket[0].mode, "New");
        } 
        else 
        {
            strcpy(state->socket[0].mode, "Old");
        }
        strcpy(state->socket[0].enable, "ON");

    }

    return 0;
}


/**
 * @brief       查询设备的数据采集状态
 * 
 * @param[out]  state : 设备状态结构体，用于存储数据采集状态
 * 
 * @return      int   : 返回错误码或成功标志
 *                0   : 查询成功
 */
static int query_data_collection_status(device_state_t *state) 
{
    uint8_t *data = send_cmd_to_receive("AT+TASKMD\r\n", 5000);
    
    char *collect_state = strstr((char *)data, "\"") + 1;
    char *collect_end = strstr(collect_state, "\"");
    
    if (collect_end != NULL) 
    {
        *collect_end = '\0';
    }

    strcpy(state->collect, collect_state);

    return 0;
}


/**
 * @brief       组合设备状态信息
 * 
 * @param[in]   state       : 设备状态结构体
 * @param[out]  data_buffer : 调用者提供的缓冲区，用于存储组合后的设备状态信息
 * 
 * @return      int         : 返回错误码或成功标志
 *                0         : 组合成功
 */
static int compose_device_state(device_state_t *state, uint8_t *data_buffer) 
{
    char *ptr = (char *)data_buffer;

    // 打印工作模式
    ptr += sprintf(ptr, "\nwork_mode: %s\n", state->work_mode);

    // NET模式下打印四个socket信息
    if (strcmp(state->work_mode, "NET") == 0) 
    {
        for (int i = 0; i < 4; i++) 
        {
            ptr += sprintf(ptr, 
                "\nSocket %d:\n"
                "  Enable: \t%s\n"
                "  Mode: \t%s\n"
                "  Server Addr: \t%s\n"
                "  Port: \t%s\n"
                "  Run State: \t%s\n"
                "  Collect: \t%s\n",
                i + 1,
                state->socket[i].enable,
                state->socket[i].mode,
                state->socket[i].server_addr,
                state->socket[i].port,
                state->socket[i].state,
                state->collect);
        }
    } 
    // MQTT模式下打印socket信息
    else if (strcmp(state->work_mode, "MQTT") == 0) 
    {
        ptr += sprintf(ptr,
            "\nSocket:\n"
            "  Enable: \t%s\n"
            "  Mode: \t%s\n"
            "  Server Addr: \t%s\n"
            "  Port: \t%s\n"
            "  Run State: \t%s\n"
            "  Collect: \t%s\n",
            state->socket[0].enable,
            state->socket[0].mode,
            state->socket[0].server_addr,
            state->socket[0].port,
            state->socket[0].state,
            state->collect);
    } 
    // HTTP模式下打印socket信息
    else if (strcmp(state->work_mode, "HTTP") == 0) 
    {
        ptr += sprintf(ptr,
            "\nSocket:\n"
            "  Enable: \t%s\n"
            "  Mode: \t%s\n"
            "  Server Addr: \t%s\n"
            "  Run State: \t%s\n"
            "  Collect: \t%s\n",
            state->socket[0].enable,
            state->socket[0].mode,
            state->socket[0].server_addr,
            state->socket[0].state,
            state->collect);
    } 
    // 其它模式下打印socket信息
    else 
    {
        ptr += sprintf(ptr,
            "\nSocket:\n"
            "  Enable: \t%s\n"
            "  Mode: \t%s\n"
            "  Run State: \t%s\n"
            "  Collect: \t%s\n",
            state->socket[0].enable,
            state->socket[0].mode,
            state->socket[0].state,
            state->collect);    
    }

    return 0;
}




/**
 * @brief       设备状态信息查询主函数
 * 
 * @param[out]  data_buffer : 调用者提供的缓冲区，用于存储设备状态信息
 * @param[in]   buffer_size : 缓冲区大小（单位：字节）
 * 
 * @return      int         : 返回错误码或成功标志
 *                0         : 查询成功
 *               -1         : 进入配置状态失败
 *               -2         : 查询失败
 *               -3         : 进入透传状态失败
 */
int dtu_device_state_work_info(uint8_t *data_buffer, uint32_t buffer_size) 
{
    device_state_t state;
    
    /* 1. 进入配置模式 */
    int res = dtu_enter_configmode_retry(3);
    if (res != 0) 
    {
        return -1;
    }

    /* 2. 查询工作模式 */
    res = query_work_mode(&state);
    if (res != 0) 
    {
        return -2;
    }

    /* 3. 查询连接状态 */
    res = query_connection_status(&state);
    if (res != 0) 
    {
        return -2;
    }

    /* 4. 查询服务器地址 */
    res = query_server_address(&state);
    if (res != 0) 
    {
        return -2;
    }

    /* 5. 查询数据采集状态 */
    res = query_data_collection_status(&state);
    if (res != 0) 
    {
        return -2;
    }

    /* 6. 组合设备状态信息 */
    res = compose_device_state(&state, data_buffer);
    if (res != 0) 
    {
        return -2;
    }

    /* 7.DTU进入透传状态 */
    res = dtu_enter_transfermode();
    if( res != 0 )
    {
        return -3;
    }    
    
    return 0;
}

