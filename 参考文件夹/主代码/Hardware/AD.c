//#include "stm32f10x.h"                  // Device header

//void AD_Init(void)
//{
//	RCC_APB2PeriphClockCmd(RCC_APB2Periph_ADC1, ENABLE);
//	RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE);
//	
//	RCC_ADCCLKConfig(RCC_PCLK2_Div6);
//	
//	GPIO_InitTypeDef GPIO_InitStructure;
//	GPIO_InitStructure.GPIO_Mode = GPIO_Mode_AIN;
//	GPIO_InitStructure.GPIO_Pin = GPIO_Pin_0 | GPIO_Pin_1 | GPIO_Pin_2 | GPIO_Pin_3;
//	GPIO_InitStructure.GPIO_Speed = GPIO_Speed_50MHz;
//	GPIO_Init(GPIOA, &GPIO_InitStructure);
//		
//	ADC_InitTypeDef ADC_InitStructure;
//	ADC_InitStructure.ADC_Mode = ADC_Mode_Independent;
//	ADC_InitStructure.ADC_DataAlign = ADC_DataAlign_Right;
//	ADC_InitStructure.ADC_ExternalTrigConv = ADC_ExternalTrigConv_None;
//	ADC_InitStructure.ADC_ContinuousConvMode = DISABLE;
//	ADC_InitStructure.ADC_ScanConvMode = DISABLE;
//	ADC_InitStructure.ADC_NbrOfChannel = 1;
//	ADC_Init(ADC1, &ADC_InitStructure);
//	
//	ADC_Cmd(ADC1, ENABLE);
//	
//	ADC_ResetCalibration(ADC1);
//	while (ADC_GetResetCalibrationStatus(ADC1) == SET);
//	ADC_StartCalibration(ADC1);
//	while (ADC_GetCalibrationStatus(ADC1) == SET);
//}

//uint16_t AD_GetValue(uint8_t ADC_Channel)
//{
//	ADC_RegularChannelConfig(ADC1, ADC_Channel, 1, ADC_SampleTime_55Cycles5);
//	ADC_SoftwareStartConvCmd(ADC1, ENABLE);
//	while (ADC_GetFlagStatus(ADC1, ADC_FLAG_EOC) == RESET);
//	return ADC_GetConversionValue(ADC1);
//}




/*
//杜洋工作室出品
//洋桃系列开发板应用程序
//关注微信公众号：洋桃电子
//洋桃开发板资料下载 www.DoYoung.net/YT 
//即可免费看所有教学视频，下载技术资料，技术疑难提问
//更多内容尽在 杜洋工作室主页 www.doyoung.net
*/

/*
《修改日志》
1-20170903


*/



#include "AD.h"

vu16 ADC_ConvertedValue[4]; //ADC数值存放数组

void ADC_DMA_Init(void){ //DMA初始化设置
	DMA_InitTypeDef DMA_InitStructure;//定义DMA初始化结构体
	DMA_DeInit(DMA1_Channel1);//复位DMA通道1
	DMA_InitStructure.DMA_PeripheralBaseAddr = ADC1_DR_Address; //定义 DMA通道外设基地址=ADC1_DR_Address
	DMA_InitStructure.DMA_MemoryBaseAddr = (u32)&ADC_ConvertedValue; //定义DMA通道ADC数据存储器（其他函数可直接读此变量即是ADC值）
	DMA_InitStructure.DMA_DIR = DMA_DIR_PeripheralSRC;//指定外设为源地址
	DMA_InitStructure.DMA_BufferSize = 4;//定义DMA缓冲区大小（根据ADC采集通道数量修改）
	DMA_InitStructure.DMA_PeripheralInc = DMA_PeripheralInc_Disable;//当前外设寄存器地址不变
	DMA_InitStructure.DMA_MemoryInc = DMA_MemoryInc_Enable;//当前存储器地址：Disable不变，Enable递增（用于多通道采集）
	DMA_InitStructure.DMA_PeripheralDataSize = DMA_PeripheralDataSize_HalfWord;//定义外设数据宽度16位
	DMA_InitStructure.DMA_MemoryDataSize = DMA_MemoryDataSize_HalfWord; //定义存储器数据宽度16位
	DMA_InitStructure.DMA_Mode = DMA_Mode_Circular;//DMA通道操作模式位环形缓冲模式
	DMA_InitStructure.DMA_Priority = DMA_Priority_High;//DMA通道优先级高
	DMA_InitStructure.DMA_M2M = DMA_M2M_Disable;//禁止DMA通道存储器到存储器传输
	DMA_Init(DMA1_Channel1, &DMA_InitStructure);//初始化DMA通道1
	DMA_Cmd(DMA1_Channel1, ENABLE); //使能DMA通道1
}
void ADC_GPIO_Init(void){ //GPIO初始化设置
	GPIO_InitTypeDef  GPIO_InitStructure; 	
    GPIO_InitStructure.GPIO_Pin = ADC_CH4 | ADC_CH5 | ADC_CH6 | ADC_CH7; //选择端口                        
    GPIO_InitStructure.GPIO_Mode = GPIO_Mode_AIN; //选择IO接口工作方式       
	GPIO_Init(ADCPORT, &GPIO_InitStructure);
	//以下2条程序就的RCC中的ADC功能开启
	RCC_AHBPeriphClockCmd(RCC_AHBPeriph_DMA1, ENABLE);//使能DMA时钟（用于ADC的数据传送）
	RCC_APB2PeriphClockCmd(RCC_APB2Periph_ADC1, ENABLE);//使能ADC1时钟
			
}
void ADC_Configuration(void){ //初始化设置
	ADC_InitTypeDef ADC_InitStructure;//定义ADC初始化结构体变量
	ADC_GPIO_Init(); //GPIO初始化设置
	ADC_DMA_Init();	//DMA初始化设置
	ADC_InitStructure.ADC_Mode = ADC_Mode_Independent;//ADC1和ADC2工作在独立模式
	ADC_InitStructure.ADC_ScanConvMode = ENABLE; //使能扫描
	ADC_InitStructure.ADC_ContinuousConvMode = ENABLE;//ADC转换工作在连续模式
	ADC_InitStructure.ADC_ExternalTrigConv = ADC_ExternalTrigConv_None;//有软件控制转换
	ADC_InitStructure.ADC_DataAlign = ADC_DataAlign_Right;//转换数据右对齐
	ADC_InitStructure.ADC_NbrOfChannel = 4;//顺序进行规则转换的ADC通道的数目（根据ADC采集通道数量修改）
	ADC_Init(ADC1, &ADC_InitStructure); //根据ADC_InitStruct中指定的参数初始化外设ADCx的寄存器
	//设置指定ADC的规则组通道，设置它们的转化顺序和采样时间
	//ADC1,ADC通道x,规则采样顺序值为y,采样时间为28周期		 
	//--------------------疑问：根据ADC采样值数组来看顺序是4、1、2、3，而不是1、2、3、4，不知道是什么原因。---------------------
	ADC_RegularChannelConfig(ADC1, ADC_Channel_4, 1, ADC_SampleTime_28Cycles5);//ADC1选择信道x,采样顺序y,采样时间n个周期
	ADC_RegularChannelConfig(ADC1, ADC_Channel_5, 2, ADC_SampleTime_28Cycles5);//ADC1选择信道x,采样顺序y,采样时间n个周期
	ADC_RegularChannelConfig(ADC1, ADC_Channel_6, 3, ADC_SampleTime_28Cycles5);//ADC1选择信道x,采样顺序y,采样时间n个周期
	ADC_RegularChannelConfig(ADC1, ADC_Channel_7, 4, ADC_SampleTime_28Cycles5);//ADC1选择信道x,采样顺序y,采样时间n个周期

	ADC_DMACmd(ADC1, ENABLE);// 开启ADC的DMA支持（要实现DMA功能，还需独立配置DMA通道等参数）
	ADC_Cmd(ADC1, ENABLE);//使能ADC1
	ADC_ResetCalibration(ADC1); //重置ADC1校准寄存器
	while(ADC_GetResetCalibrationStatus(ADC1));//等待ADC1校准重置完成
	ADC_StartCalibration(ADC1);//开始ADC1校准
	while(ADC_GetCalibrationStatus(ADC1));//等待ADC1校准完成
	ADC_SoftwareStartConvCmd(ADC1, ENABLE); //使能ADC1软件开始转换
}





 

/*********************************************************************************************
 * 杜洋工作室 www.DoYoung.net
 * 洋桃电子 www.DoYoung.net/YT 
*********************************************************************************************/

/*
选择IO接口工作方式：
GPIO_Mode_AIN 模拟输入
GPIO_Mode_IN_FLOATING 浮空输入
GPIO_Mode_IPD 下拉输入
GPIO_Mode_IPU 上拉输入
GPIO_Mode_Out_PP 推挽输出
GPIO_Mode_Out_OD 开漏输出
GPIO_Mode_AF_PP 复用推挽输出
GPIO_Mode_AF_OD 复用开漏输出
*/































