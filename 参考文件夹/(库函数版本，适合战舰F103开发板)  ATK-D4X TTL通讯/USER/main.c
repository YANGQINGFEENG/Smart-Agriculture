#include "led.h"
#include "delay.h"
#include "key.h"
#include "sys.h"
#include "usart.h"
#include "uart2.h"
#include "RingBuffer.h"
#include "atk_d43.h"
#include "string.h"

/**
 * ****************************************************************************
 * @file            main.c
 * @author          ����ԭ���Ŷӣ�ALIENTEK��
 * @version         V1.0
 * @data            2020-04-14
 * @brief           main��������
 * @copyright       Copyright (c) 2020-2032, �������������ӿƼ����޹�˾
 * ****************************************************************************
 * @attention       
 * 
 * ʵ��ƽ̨������ԭ��STM32F103������    +   ����ԭ��ATK-M750/ATK-M751��4G DTU��Ʒ��
 * ������Ƶ:www.yuanzige.com
 * ������̳:www.openedv.com
 * ��˾��ַ:www.alientek.com
 * �����ַ:openedv.taobao.com
 * 
 * �޸�˵��
 * V1.0 20200414
 * ��һ�η���
 * ****************************************************************************
*/

#define DTU_TEST_DATA "ALIENTEK ATK-D4X TEST"

#define DTU_NETDATA_RX_BUF     (1024)
#define UART1_RX_BUF_SIZE     (1024)

static uint32_t dtu_rxlen = 0;
static uint8_t dtu_rxbuf[DTU_NETDATA_RX_BUF];

static uint8_t uart1_rxbuf[UART1_RX_BUF_SIZE];  // ���ڴ洢UART1���յ�������
static uint32_t uart1_rxlen = 0;               // UART1�������ݵĳ���

RingBuffer *p_uart2_rxbuf;

int main(void)
{
    int ret;
    uint32_t timeout = 0;
    uint8_t buf;
    uint8_t key;

    NVIC_PriorityGroupConfig(NVIC_PriorityGroup_2); /*����NVIC�жϷ���2:2λ��ռ���ȼ���2λ��Ӧ���ȼ�*/

    delay_init();                                   /*��ʱ������ʼ��*/
    LED_Init();                                     /*LED�˿ڳ�ʼ��*/
    KEY_Init();                                     /* ������ʼ�� */
    my_mem_init(SRAMIN);                            /*��ʼ���ڴ��*/

    p_uart2_rxbuf = RingBuffer_Malloc(1024);        /*���ڴ���з���1K���ڴ������3����DTU����*/

    uart_init(115200);                              /*����1��ʼ����������Ϊ115200*/

  /*  ��DTUͨѶ��RS485��ʼ����������Ϊ115200
        �ر�ע�⣺��DTUͨѶ�Ĵ��ڣ����ڲ�������DTU���ڱ���һ��,�����޷�����ͨѶ������������*/
    uart2_init(115200);

    /*
          @param       work_mode       :   DTU����ģʽ
        *  @arg        DTU_WORKMODE_NET,         ����͸��ģʽ
        *  @arg        DTU_WORKMODE_HTTP,        http͸��ģʽ
        *  @arg        DTU_WORKMODE_MQTT,        mqtt͸��ģʽ
        *  @arg        DTU_WORKMODE_ALIYUN,      ������͸��ģʽ
        *  @arg        DTU_WORKMODE_ONENET,      OneNET͸��ģʽ
        *  @arg        DTU_WORKMODE_YUANZIYUN,   ԭ������͸��ģʽ���°�+�ɰ棩
        
        
        *@param        collect_mode     :    ���ݲɼ�ģʽ
        * @arg            DTU_COLLECT_OFF,        0,    �رղɼ�����
        * @arg            DTU_COLLECT_TRANS,        1,    �Զ���͸���ɼ�����
        * @arg            DTU_COLLECT_MODBUS_USER 2,  Modbus�Զ���ɼ�
        * @arg            DTU_COLLECT_MODBUS_ALI  3,  Modbus�����Ʋɼ�����ģ�ͣ�
        * @arg            DTU_COLLECT_MODBUS_ONENET 4,Modbus OneNET�ɼ�����ģ�ͣ�

        ˵����ÿ��ģʽ����Ҫ���в������ã�����atk_d4x.c�ļ����ҵ����¶��������Ӧ�Ĳ����޸ķ���ʹ�ã�Ĭ�ϲ�������֤�������������ݣ�����
        ����������dtu_basic_conf_param_info
        ����ģʽ��dtu_net_param_info/dtu_http_param_info/dtu_mqtt_param_info/dtu_aliyun_param_info/dtu_onenet_param_info/dtu_yuanziyun_param_info
        ���ݲɼ���dtu_collect_disable_param_info/dtu_collect_trans_poll_param_info/dtu_collect_modbus_user_param_info/dtu_collect_modbus_ali_param_info/dtu_collect_modbus_onenet_param_info
    */
    printf("\r\n=======================================\r\n");
    printf("ATK-D4X TTL Communication Test\r\n");
    printf("=======================================\r\n");

    printf("Initializing system...\r\n");
    printf("Initializing delay timer...\r\n");
    printf("Initializing LED...\r\n");
    printf("Initializing KEY...\r\n");
    printf("Initializing memory...\r\n");
    printf("Initializing ring buffer...\r\n");
    printf("Initializing UART1...\r\n");
    printf("Initializing UART2...\r\n");
    printf("Initializing DTU...\r\n");
    printf("Wait for Cat1 DTU to start, wait 15s.... \r\n");
    
    while( timeout <= 10 )   /* �ȴ�Cat1 DTU��������Ҫ�ȴ�5-6s�������� */
    {
        printf("Attempt %d: Configuring DTU...\r\n", timeout+1);
        ret = dtu_config_init(DTU_WORKMODE_NET, DTU_COLLECT_OFF);    /*��ʼ��DTU������Ϣ*/
        if( ret == 0 )
        {
            printf("DTU configuration successful!\r\n");
            break;
        }
        else
        {
            printf("DTU configuration failed, error code: %d\r\n", ret);
        }
        timeout++;
        delay_ms(1000);
    }
            
    while(timeout <= 10)        /* ����������ɺ���Ҫ���� */
    {
        ret = dtu_power_reset();
        if( ret == 0 )
            break;
        timeout++;
        delay_ms(1000);                        
    }
            
    if(timeout <= 10)                /* �ٴεȴ�Cat1 DTU��������Ҫ�ȴ�5-6s�������� */
    {
        delay_ms(5000);
    }

    while( timeout > 10 )   /* ��ʱ */
    {
        printf("**************************************************************************\r\n");
        printf("ATK-DTU Init Fail ...\r\n");
        printf("�밴�����²�����м��:\r\n");
        printf("1.ʹ�õ�����λ�������������DTU�ܷ񵥶���������\r\n");
        printf("2.���DTU���ڲ�����STM32ͨѶ�Ĵ��ڲ����Ƿ�һ��\r\n");
        printf("3.���DTU��STM32���ڵĽ����Ƿ���ȷ\r\n");
        printf("4.����������ָ���Ƿ�����");
        printf("5.���DTU�����Ƿ�������DTU�Ƽ�ʹ��12V/1A��Դ���磬��Ҫʹ��USB��5V��ģ�鹩�磡��\r\n");
        printf("**************************************************************************\r\n\r\n");
        delay_ms(3000);
    }
    printf("Cat1 DTU Init Successs \r\n"); 
    dtu_rxlen = 0;
    RingBuffer_Reset(p_uart2_rxbuf);
    /*  
        DTU����͸��״̬�󣬾Ϳ��԰���������ͨ����ʹ�ã�����ȷ����1.Ӳ��������� 2.���ڲ�����DTU�ı���һ��
        ע�⣺DTUÿ���ϵ���Ҫһ����ʱ�䣬�ڵȴ����ӹ����У�MCU������DTU�������ݲ�������DTU�У��ȵ�������������ϣ�DTU���Զ������ݻ�������ȫ��ת�����������ϡ�
    */
    while (1)
    {
        if (RingBuffer_Len(p_uart2_rxbuf) > 0)          /*���յ�DTU���͹����ķ���������*/
        {
            RingBuffer_Out(p_uart2_rxbuf, &buf, 1);
            dtu_rxbuf[dtu_rxlen++] = buf;
            dtu_get_urc_info(buf);                      /*����DTU�ϱ���URC��Ϣ*/
            if (dtu_rxlen >= DTU_NETDATA_RX_BUF)        /*���ջ������*/
            {
                usart1_send_data(dtu_rxbuf, dtu_rxlen); /*���յ���DTU���������������ݣ�ת�������Դ���1���*/
                memset(dtu_rxbuf, 0x00, sizeof(dtu_rxbuf));
                dtu_rxlen = 0;
            }
        }
        else
        {
            if (dtu_rxlen > 0)
            {
                usart1_send_data(dtu_rxbuf, dtu_rxlen); /*���յ���DTU���������������ݣ�ת�������Դ���1���*/
                memset(dtu_rxbuf, 0x00, sizeof(dtu_rxbuf));
                dtu_rxlen = 0;
            }
            LED0 = !LED0;
            delay_ms(100);
        }
        
        /* ����UART1���յ������ݲ�ͨ��UART2ת�� */
        uart1_rxlen = uart1_receive_data(uart1_rxbuf, sizeof(uart1_rxbuf));
        if (uart1_rxlen > 0)
        {
            send_data_to_dtu(uart1_rxbuf, uart1_rxlen);
            uart1_rxlen = 0;
        }
        key = KEY_Scan(0);
        switch(key)
        {
            case KEY0_PRES:
            {
                /*�����������ʽ��������Ҫ�����޸Ķ�Ӧ�����ݸ�ʽ������ֻ�������̲���ʹ��*/
                send_data_to_dtu((uint8_t *)DTU_TEST_DATA, strlen(DTU_TEST_DATA));
                
                break;
            }
            case KEY1_PRES:
            {
                /* �豸״̬��Ϣ��ѯ */
                memset(dtu_rxbuf, 0x00, DTU_NETDATA_RX_BUF);
                ret = dtu_device_state_work_info(dtu_rxbuf, DTU_NETDATA_RX_BUF);
                if (ret == 0)
                {
                    usart1_send_data(dtu_rxbuf, strlen((char *)dtu_rxbuf));
                }
                break;
            }
            default:
            {
                break;
            }
        }
    }
}
