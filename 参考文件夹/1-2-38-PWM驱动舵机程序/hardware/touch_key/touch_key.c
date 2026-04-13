

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
1-201708202312 ������


*/



#include "touch_key.h"

void TOUCH_KEY_Init(void){ //����������ʼ��
	GPIO_InitTypeDef  GPIO_InitStructure; //����GPIO�ĳ�ʼ��ö�ٽṹ	
	EXTI_InitTypeDef EXTI_InitStructure; //����EXTI�ĳ�ʼ��ö�ٽṹ
	NVIC_InitTypeDef NVIC_InitStructure; //����NVIC�ĳ�ʼ��ö�ٽṹ
	
	RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA | RCC_APB2Periph_GPIOB | RCC_APB2Periph_GPIOC | RCC_APB2Periph_GPIOD | RCC_APB2Periph_GPIOE | RCC_APB2Periph_AFIO, ENABLE); //APB2����GPIOʱ��ʹ��      
    
	// ��ʼ��GPIO
    GPIO_InitStructure.GPIO_Pin = TOUCH_KEY_A | TOUCH_KEY_B | TOUCH_KEY_C | TOUCH_KEY_D; //ѡ��˿�                        
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_IPU; //ѡ��IO�ӿڹ�����ʽ //��������       
	GPIO_Init(TOUCH_KEYPORT,&GPIO_InitStructure);		
	
	// ��ʼ��EXTI
	GPIO_EXTILineConfig(GPIO_PortSourceGPIOA, GPIO_PinSource0); // TOUCH_KEY_A ��Ӧ EXTI0
	GPIO_EXTILineConfig(GPIO_PortSourceGPIOA, GPIO_PinSource1); // TOUCH_KEY_B ��Ӧ EXTI1
	
	EXTI_InitStructure.EXTI_Line = EXTI_Line0 | EXTI_Line1; // ѡ��EXTI0��EXTI1
	EXTI_InitStructure.EXTI_Mode = EXTI_Mode_Interrupt; // �������ж���ʽ
	EXTI_InitStructure.EXTI_Trigger = EXTI_Trigger_Falling; // ��½���ж�
	EXTI_InitStructure.EXTI_LineCmd = ENABLE; // ʹ��EXTI
	EXTI_Init(&EXTI_InitStructure);
	
	// ��ʼ��NVIC
	NVIC_InitStructure.NVIC_IRQChannel = EXTI0_IRQn; // ��ӦEXTI0��中断通道
	NVIC_InitStructure.NVIC_IRQChannelPreemptionPriority = 0x02; // ��ռ���ȼ�
	NVIC_InitStructure.NVIC_IRQChannelSubPriority = 0x02; // ��Ӧע���ȼ�
	NVIC_InitStructure.NVIC_IRQChannelCmd = ENABLE; // ʹ��中断通道
	NVIC_Init(&NVIC_InitStructure);
	
	NVIC_InitStructure.NVIC_IRQChannel = EXTI1_IRQn; // ��ӦEXTI1��中断通道
	NVIC_Init(&NVIC_InitStructure);
}
 

/*********************************************************************************************
 * �������� www.DoYoung.net
 * ���ҵ��� www.DoYoung.net/YT 
*********************************************************************************************/



/*
ѡ��IO�ӿڹ�����ʽ��
GPIO_Mode_AIN ģ������
GPIO_Mode_IN_FLOATING ��������
GPIO_Mode_IPD ��������
GPIO_Mode_IPU ��������
GPIO_Mode_Out_PP �������
GPIO_Mode_Out_OD ��©���
GPIO_Mode_AF_PP �����������
GPIO_Mode_AF_OD ���ÿ�©���
*/
