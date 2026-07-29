/*
//�������ҳ�Ʒ
//����ϵ�п�����Ӧ�ó���
//��ע΢�Ź��ںţ����ҵ���
//���ҿ������������� www.DoYoung.net/YT 
//������ѿ����н�ѧ��Ƶ�����ؼ������ϣ�������������
//�������ݾ��� ����������ҳ www.doyoung.net
*/

/*
���޸���־��
1-201708221422 ����RCCʱ�ӵ����ú�����
*/

#include "sys.h"
#include "stm32f10x_rcc.h"
#include "stm32f10x_pwr.h"
#include "misc.h"

void NVIC_Configuration(void) {
    NVIC_PriorityGroupConfig(NVIC_PriorityGroup_2);  // ����NVIC�жϷ���2:2λ��ռ���ȼ���2λ��Ӧ���ȼ�
}

/*********************************************************************************************
 * �������� www.DoYoung.net
 * ���ҵ��� www.DoYoung.net/YT 
*********************************************************************************************/

/**
 * @brief       �����ж�������ƫ�Ƶ�ַ
 * @param       baseaddr: ��ַ
 * @param       offset: ƫ����(������0, ����0X100�ı���)
 * @retval      ��
 */
void sys_nvic_set_vector_table(uint32_t baseaddr, uint32_t offset)
{
    NVIC_SetVectorTable(baseaddr, offset);  // ʹ�ñ�׼�⺯������������ƫ��
}

/**
 * @brief       ִ��: WFIָ��(ִ�����ָ�����͹���״̬, �ȴ��жϻ���)
 * @param       ��
 * @retval      ��
 */
void sys_wfi_set(void)
{
    __WFI();  // CMSIS��׼ָ��
}

/**
 * @brief       �ر������ж�(���ǲ�����fault��NMI�ж�)
 * @param       ��
 * @retval      ��
 */
void sys_intx_disable(void)
{
    __disable_irq();  // CMSIS��׼ָ��
}

/**
 * @brief       ���������ж�
 * @param       ��
 * @retval      ��
 */
void sys_intx_enable(void)
{
    __enable_irq();  // CMSIS��׼ָ��
}

/**
 * @brief       ����ջ����ַ
 * @note        ���ĺ�X, ����MDK��, ʵ����û�����
 * @param       addr: ջ����ַ
 * @retval      ��
 */
void sys_msr_msp(uint32_t addr)
{
    __set_MSP(addr);  // CMSIS��׼����
}

/**
 * @brief       �������ģʽ
 * @param       ��
 * @retval      ��
 */
void sys_standby(void)
{
    RCC_APB1PeriphClockCmd(RCC_APB1Periph_PWR, ENABLE);  // ʹ��PWRʱ��
    PWR_WakeUpPinCmd(ENABLE);                            // ʹ�ܻ�������
    PWR_EnterSTANDBYMode();                              // �������ģʽ
}

/**
 * @brief       ϵͳ����λ
 * @param       ��
 * @retval      ��
 */
void sys_soft_reset(void)
{
    NVIC_SystemReset();  // CMSIS��׼����
}

/**
 * @brief       ϵͳʱ�ӳ�ʼ������
 * @param       plln: PLL��Ƶϵ��(PLL��Ƶ), ȡֵ��Χ: 2~16
 * @retval      ��
 */
void sys_stm32_clock_init(uint32_t plln)
{
    ErrorStatus HSEStartUpStatus = ERROR;
    
    /* ��λRCC���� */
    RCC_DeInit();
    
    /* ʹ��HSE */
    RCC_HSEConfig(RCC_HSE_ON);
    
    /* �ȴ�HSE���� */
    HSEStartUpStatus = RCC_WaitForHSEStartUp();
    
    if (HSEStartUpStatus == SUCCESS)
    {
        /* ����HCLK��PCLK2��PCLK1Ԥ��Ƶ */
        RCC_HCLKConfig(RCC_SYSCLK_Div1);   // HCLK = SYSCLK
        RCC_PCLK2Config(RCC_HCLK_Div1);    // PCLK2 = HCLK
        RCC_PCLK1Config(RCC_HCLK_Div2);    // PCLK1 = HCLK/2
        
        /* ����PLLʱ��Դ����Ƶϵ�� */
        RCC_PLLConfig(RCC_PLLSource_HSE_Div1, plln);
        
        /* ʹ��PLL */
        RCC_PLLCmd(ENABLE);
        
        /* �ȴ�PLL���� */
        while (RCC_GetFlagStatus(RCC_FLAG_PLLRDY) == RESET);
        
        /* ����PLLΪϵͳʱ��Դ */
        RCC_SYSCLKConfig(RCC_SYSCLKSource_PLLCLK);
        
        /* �ȴ�PLL��Ϊϵͳʱ��Դ */
        while (RCC_GetSYSCLKSource() != 0x08);
    }
    else
    {
        /* HSE����ʧ�ܣ����򽫿������� */
        while (1);
    }
    
    /* ����FLASH��ʱ����Ϊ2 */
    FLASH_SetLatency(FLASH_Latency_2);
    
    /* ʹ��Ԥȡָ���� */
    FLASH_PrefetchBufferCmd(FLASH_PrefetchBuffer_Enable);
}

GPIO_InitTypeDef GPIO_InitStructure;
USART_InitTypeDef USART_InitStructure;
NVIC_InitTypeDef NVIC_InitStructure;
