#include "usart.h"

/* ���ʹ��OS,����������ͷ�ļ����� */
#if SYS_SUPPORT_OS
#include "includes.h"  /* OS ʹ�� */
#endif

/******************************************************************************************/
/* �������´���, ֧��printf����, ������Ҫѡ��use MicroLIB */

#if 1
#if (__ARMCC_VERSION >= 6010050)  /* ʹ��AC6������ʱ */
__asm(".global __use_no_semihosting\n\t");  /* ������ʹ�ð�����ģʽ */
__asm(".global __ARM_use_no_argv \n\t");    /* AC6����Ҫ����main����Ϊ�޲�����ʽ�����򲿷����̿��ܳ��ְ�����ģʽ */

#else
/* ʹ��AC5������ʱ, Ҫ�����ﶨ��__FILE �� ��ʹ�ð�����ģʽ */
#pragma import(__use_no_semihosting)

struct __FILE
{
    int handle;
};

#endif

/* ��ʹ�ð�����ģʽ��������Ҫ�ض���_ttywrch��_sys_exit��_sys_command_string����,��ͬʱ����AC6��AC5ģʽ */
int _ttywrch(int ch)
{
    ch = ch;
    return ch;
}

/* ����_sys_exit()�Ա���ʹ�ð�����ģʽ */
void _sys_exit(int x)
{
    x = x;
}

char *_sys_command_string(char *cmd, int len)
{
    return NULL;
}

/* FILE �� stdio.h���涨��. */
FILE __stdout;

/* �ض���fputc����, printf�������ջ�ͨ������fputc����ַ��������� */
int fputc(int ch, FILE *f)
{
    while ((USART1->SR & USART_FLAG_TXE) == 0);  /* �ȴ���һ���ַ�������� */
    USART1->DR = (uint8_t)ch;                   /* ��Ҫ���͵��ַ� ch д�뵽DR�Ĵ��� */
    return ch;
}
#endif

/* ���ջ���, ���USART_REC_LEN���ֽ�. */
uint8_t g_usart_rx_buf[USART_REC_LEN];

/*  ����״̬
 *  bit15��      ������ɱ�־
 *  bit14��      ���յ�0x0d
 *  bit13~0��    ���յ�����Ч�ֽ���Ŀ
*/
uint16_t g_usart_rx_sta = 0;

uint8_t g_rx_buffer[RXBUFFERSIZE];  /* ���ڽ��ջ��� */

extern GPIO_InitTypeDef GPIO_InitStructure;
extern USART_InitTypeDef USART_InitStructure;
extern NVIC_InitTypeDef NVIC_InitStructure;

/**
 * @brief       ����X��ʼ������
 * @param       baudrate: ������, �����Լ���Ҫ���ò�����ֵ
 * @note        ע��: ����������ȷ��ʱ��Դ, ���򴮿ڲ����ʾͻ������쳣.
 *              �����USART��ʱ��Դ��sys_stm32_clock_init()�������Ѿ����ù���.
 * @retval      ��
 */
void usart_init(uint32_t baudrate)
{
    /* ʹ��GPIO��USARTʱ�� */
    USART_TX_GPIO_CLK_ENABLE();
    USART_RX_GPIO_CLK_ENABLE();
    USART_UX_CLK_ENABLE();

    /* ����USART TX���� */
    GPIO_InitStructure.GPIO_Pin = USART_TX_GPIO_PIN;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_AF_PP;
    GPIO_InitStructure.GPIO_Speed = GPIO_Speed_50MHz;
    GPIO_Init(USART_TX_GPIO_PORT, &GPIO_InitStructure);

    /* ����USART RX���� */
    GPIO_InitStructure.GPIO_Pin = USART_RX_GPIO_PIN;
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_IPD;
    GPIO_Init(USART_RX_GPIO_PORT, &GPIO_InitStructure);

    /* ����USART */
    USART_InitStructure.USART_BaudRate = baudrate;
    USART_InitStructure.USART_WordLength = USART_WordLength_8b;
    USART_InitStructure.USART_StopBits = USART_StopBits_1;
    USART_InitStructure.USART_Parity = USART_Parity_No;
    USART_InitStructure.USART_HardwareFlowControl = USART_HardwareFlowControl_None;
    USART_InitStructure.USART_Mode = USART_Mode_Rx | USART_Mode_Tx;
    USART_Init(USART_UX, &USART_InitStructure);

    /* ʹ��USART */
    USART_Cmd(USART_UX, ENABLE);

    /* �����ж����ȼ���ʹ���ж� */
    NVIC_InitStructure.NVIC_IRQChannel = USART_UX_IRQn;
    NVIC_InitStructure.NVIC_IRQChannelPreemptionPriority = 3;
    NVIC_InitStructure.NVIC_IRQChannelSubPriority = 3;
    NVIC_InitStructure.NVIC_IRQChannelCmd = ENABLE;
    NVIC_Init(&NVIC_InitStructure);

    /* ʹ��USART�ж� */
    USART_ITConfig(USART_UX, USART_IT_RXNE, ENABLE);
}

/**
 * @brief       ����1�жϷ�����
 * @param       ��
 * @retval      ��
 */
void USART1_IRQHandler(void)
{
    uint8_t ch;

    if (USART_GetITStatus(USART1, USART_IT_RXNE) != RESET)
    {
        ch = USART_ReceiveData(USART1);

        if ((g_usart_rx_sta & 0x8000) == 0)  /* ����δ��� */
        {
            if (g_usart_rx_sta & 0x4000)     /* ���յ���0x0d */
            {
                if (ch != 0x0a)
                {
                    g_usart_rx_sta = 0;      /* ���մ���,���¿�ʼ */
                }
                else
                {
                    g_usart_rx_sta |= 0x8000; /* ��������� */
                }
            }
            else
            {
                if (ch == 0x0d)
                {
                    g_usart_rx_sta |= 0x4000;
                }
                else
                {
                    g_usart_rx_buf[g_usart_rx_sta & 0x3FFF] = ch;
                    g_usart_rx_sta++;
                    if (g_usart_rx_sta > (USART_REC_LEN - 1))
                    {
                        g_usart_rx_sta = 0;  /* �������ݴ���,���¿�ʼ���� */
                    }
                }
            }
        }
    }
}




