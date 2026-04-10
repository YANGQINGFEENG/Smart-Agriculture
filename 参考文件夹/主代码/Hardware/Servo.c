#include "stm32f10x.h"                  // Device header
#include "PWM.h"
#include "Delay.h"
#include <stdio.h>

void Servo_Init(void)
{
	PWM_Init();
}

void Servo_SetAngle(float Angle)
{
	// 限制角度范围在0-180度
	if(Angle < 0) Angle = 0;
	if(Angle > 180) Angle = 180;
	
	PWM_SetCompare1(Angle / 180 * 2000 + 500);
	printf("[DEBUG] Servo angle set to %.1f degrees, PWM duty: %d\r\n", Angle, (uint16_t)(Angle / 180 * 2000 + 500));
}
