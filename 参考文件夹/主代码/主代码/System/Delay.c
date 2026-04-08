#include "stm32f10x.h"

/**
  * @brief  微秒级延时
  * @param  xus 延时时长，范围：0~233015
  * @retval 无
  */
void Delay_us(uint32_t xus)
{
	SysTick->LOAD = 72 * xus;				//设置定时器重装值
	SysTick->VAL = 0x00;					//清空当前计数值
	SysTick->CTRL = 0x00000005;				//设置时钟源为HCLK，启动定时器
	while(!(SysTick->CTRL & 0x00010000));	//等待计数到0
	SysTick->CTRL = 0x00000004;				//关闭定时器
}

/**
  * @brief  毫秒级延时
  * @param  xms 延时时长，范围：0~4294967295
  * @retval 无
  */
void Delay_ms(uint32_t xms)
{
	while(xms--)
	{
		Delay_us(1000);
	}
}
 
/**
  * @brief  秒级延时
  * @param  xs 延时时长，范围：0~4294967295
  * @retval 无
  */
void Delay_s(uint32_t xs)
{
	while(xs--)
	{
		Delay_ms(1000);
	}
} 




#include "sys.h"
#include "Delay.h"

static uint32_t fac_us = 0;         /* us延时倍乘数 */

#if SYS_SUPPORT_OS
#include "ucos_ii.h"                /* UCOSII头文件 */

static uint16_t fac_ms = 0;         /* ms延时倍乘数 */

/* OS相关宏定义 */
#define delay_osrunning     OSRunning
#define delay_ostickspersec OS_TICKS_PER_SEC
#define delay_osintnesting  OSIntNesting

/**
 * @brief  锁定任务调度
 */
static void delay_osschedlock(void)
{
    OSSchedLock();
}

/**
 * @brief  解锁任务调度
 */
static void delay_osschedunlock(void)
{
    OSSchedUnlock();
}

/**
 * @brief  OS延时
 * @param  ticks: 延时的节拍数
 */
static void delay_ostimedly(uint32_t ticks)
{
    OSTimeDly(ticks);
}

/**
 * @brief  SysTick中断服务函数
 */
void SysTick_Handler(void)
{
    if(delay_osrunning == OS_TRUE)
    {
        OS_CPU_SysTickHandler();
    }
}
#endif

/**
 * @brief  初始化延时函数
 * @param  SYSCLK: 系统时钟频率(单位:MHz)
 */
void delay_init(uint8_t SYSCLK)
{
    SysTick_CLKSourceConfig(SysTick_CLKSource_HCLK_Div8); /* 选择外部时钟 HCLK/8 */
    fac_us = SYSCLK / 8;                                 /* 1us需要的时钟数 */
    
#if SYS_SUPPORT_OS
    fac_ms = 1000 / delay_ostickspersec;                 /* 每个OS节拍的ms数 */
    SysTick->LOAD = (uint32_t)SYSCLK * 1000000 / 8 / delay_ostickspersec; /* 重装载值 */
    SysTick->CTRL |= SysTick_CTRL_TICKINT_Msk;           /* 开启SYSTICK中断 */
    SysTick->CTRL |= SysTick_CTRL_ENABLE_Msk;            /* 开启SYSTICK */
#endif
}

/**
 * @brief  微秒级延时
 * @param  nus: 要延时的us数
 */
void delay_us(uint32_t nus)
{
    uint32_t temp;
    SysTick->LOAD = nus * fac_us;                        /* 时间加载 */
    SysTick->VAL = 0x00;                                 /* 清空计数器 */
    SysTick->CTRL |= SysTick_CTRL_ENABLE_Msk;            /* 开始倒数 */
    
#if SYS_SUPPORT_OS
    delay_osschedlock();                                 /* 阻止OS调度 */
#endif

    do
    {
        temp = SysTick->CTRL;
    }while((temp & 0x01) && !(temp & (1 << 16)));        /* 等待时间到达 */

    SysTick->CTRL &= ~SysTick_CTRL_ENABLE_Msk;           /* 关闭计数器 */
    SysTick->VAL = 0X00;                                 /* 清空计数器 */

#if SYS_SUPPORT_OS
    delay_osschedunlock();                               /* 恢复OS调度 */
#endif
}

/**
 * @brief  毫秒级延时
 * @param  nms: 要延时的ms数
 */
void delay_ms(uint16_t nms)
{
#if SYS_SUPPORT_OS
    if(delay_osrunning && (delay_osintnesting == 0))     /* 如果OS已经在跑了,并且不是在中断里面 */
    {
        if(nms >= fac_ms)                               /* 延时的时间大于OS的最少时间周期 */
        {
            delay_ostimedly(nms / fac_ms);              /* OS延时 */
        }
        nms %= fac_ms;                                   /* OS已经无法提供这么小的延时了,采用普通方式延时 */
    }
#endif
    
    /* 普通方式延时 */
    uint32_t temp;
    SysTick->LOAD = (uint32_t)nms * fac_us * 1000;       /* 时间加载 */
    SysTick->VAL = 0x00;                                 /* 清空计数器 */
    SysTick->CTRL |= SysTick_CTRL_ENABLE_Msk;            /* 开始倒数 */
    
    do
    {
        temp = SysTick->CTRL;
    }while((temp & 0x01) && !(temp & (1 << 16)));        /* 等待时间到达 */
    
    SysTick->CTRL &= ~SysTick_CTRL_ENABLE_Msk;           /* 关闭计数器 */
    SysTick->VAL = 0X00;                                 /* 清空计数器 */
}



