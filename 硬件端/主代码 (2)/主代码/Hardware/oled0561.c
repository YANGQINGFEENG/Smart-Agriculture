/*
// 本文件为 OLED0561 显示驱动
// 版权归属：DoYoung Studio
// 微信公众号：DoYoung
// 技术支持与教学视频：www.DoYoung.net/YT 
// 详细资料请访问：www.doyoung.net
*/

/*
修改日志：
1-201709021721 首次发布
*/

#include "oled0561.h"
#include "ASCII_8x16.h" // 8×16 ASCII 字模

/* 函数：OLED0561_Init
 * 功能：OLED 初始化流程
 * 步骤：关闭显示 → 清屏 → 按默认参数开启显示
 */
void OLED0561_Init(void){

	OLED_DISPLAY_OFF();   // 先关闭显示，避免花屏
	OLED_DISPLAY_CLEAR();   // 整屏清零
	OLED_DISPLAY_ON();      // 写入默认配置并开启显示
}

/* 函数：OLED_DISPLAY_ON
 * 功能：写入完整初始化命令序列，开启显示
 * 备注：buf 数组 28 字节，覆盖 SSD1306 常用寄存器
 */
void OLED_DISPLAY_ON(void)
{
	u8 buf[28] = {
		0xAE,       // 关闭显示（后续 0xAF 再打开）
		0x00,0x10,  // 设置列起始地址高/低 4 位
		0xD5,0x80,  // 时钟分频
		0xA8,0x3F,  // MUX 比例 1/64
		0xD3,0x00,  // 显示偏移 0
		0xB0,       // 页地址 0
		0x40,       // 显示起始行 0
		0x8D,0x14,  // 开启内部 VCC 电荷泵
		0xA1,       // 段重映射：正常
		0xC8,       // COM 扫描方向：反向
		0xDA,0x12,  // COM 引脚配置：替代
		0x81,0xFF,  // 对比度最大
		0xD9,0xF1,  // 预充电周期
		0xDB,0x30,  // VCOMH 电平
		0x20,0x00,  // 水平寻址模式
		0xA4,       // 输出跟随 RAM
		0xA6,       // 正常显示（非反色）
		0xAF        // 开启显示
	};
	I2C_SAND_BUFFER(OLED0561_ADD, COM, buf, 28);
}

/* 函数：OLED_DISPLAY_OFF
 * 功能：关闭显示并关闭电荷泵，进入省电模式
 */
void OLED_DISPLAY_OFF(void)
{
	u8 buf[3] = {
		0xAE,       // 关闭显示
		0x8D,0x10   // 关闭电荷泵
	};
	I2C_SAND_BUFFER(OLED0561_ADD, COM, buf, 3);
}

/* 函数：OLED_DISPLAY_LIT
 * 参数：x = 0~255，设置全局对比度
 */
void OLED_DISPLAY_LIT(u8 x)
{
	I2C_SAND_BYTE(OLED0561_ADD, COM, 0x81);
	I2C_SAND_BYTE(OLED0561_ADD, COM, x);
}

/* 函数：OLED_DISPLAY_CLEAR
 * 功能：用页写方式写 0，整屏清零
 */
void OLED_DISPLAY_CLEAR(void)
{
	u8 j, t;
	for (t = 0xB0; t < 0xB8; t++) {          // 页 0~7
		I2C_SAND_BYTE(OLED0561_ADD, COM, t);   // 设置页地址
		I2C_SAND_BYTE(OLED0561_ADD, COM, 0x10); // 列高 4 位
		I2C_SAND_BYTE(OLED0561_ADD, COM, 0x00); // 列低 4 位
		for (j = 0; j < 132; j++)              // 写 132 字节 0
			I2C_SAND_BYTE(OLED0561_ADD, DAT, 0x00);
	}
}

/* 函数：OLED_DISPLAY_8x16
 * 功能：在指定行列显示一个 8×16 ASCII 字符
 * 参数：x = 页 0~7，y = 列 0~127，w = 字符 ASCII 码
 * 说明：y 需 +2 补偿 OLED 实际偏移；字模减 512 做 ASCII 表偏移
 */
void OLED_DISPLAY_8x16(u8 x, u8 y, u16 w)
{
	u8 j, t, c = 0;
	y = y + 2;                              // 硬件偏移修正
	for (t = 0; t < 2; t++) {               // 分两页写 16 行
		I2C_SAND_BYTE(OLED0561_ADD, COM, 0xB0 + x); // 页地址
		I2C_SAND_BYTE(OLED0561_ADD, COM, (y >> 4) + 0x10); // 列高 4 位
		I2C_SAND_BYTE(OLED0561_ADD, COM, y & 0x0F);        // 列低 4 位
		for (j = 0; j < 8; j++) {           // 每页 8 列
			I2C_SAND_BYTE(OLED0561_ADD, DAT, ASCII_8x16[w * 16 + c - 512]);
			c++;
		}
		x++;                                // 换下一页
	}
}

/* 函数：OLED_DISPLAY_8x16_BUFFER
 * 功能：整行输出 ASCII 字符串（最多 16 个 8×16 字符）
 * 示例：OLED_DISPLAY_8x16_BUFFER(0, "DoYoung Studio");
 */
void OLED_DISPLAY_8x16_BUFFER(u8 row, u8 *str)
{
	u8 r = 0;
	while (*str != '\0') {
		OLED_DISPLAY_8x16(row, r * 8, *str++);
		r++;
	}
}

/* 函数：OLED_SCROLL_RIGHT
 * 功能：配置并启动向右水平滚动
 * 参数：start_row ~ end_row 页范围
 */
void OLED_SCROLL_RIGHT(u8 start_row, u8 end_row)
{
	u8 buf[6];

	buf[0] = 0x2E;          // 先关闭滚动
	I2C_SAND_BYTE(OLED0561_ADD, COM, buf[0]);

	buf[0] = 0x26;          // 右滚
	buf[1] = 0x00;          //  Dummy
	buf[2] = start_row;     // 起始页
	buf[3] = 0x00;          // 帧率 5 frames/step
	buf[4] = end_row;       // 结束页
	buf[5] = 0x00;          //  Dummy

	I2C_SAND_BYTE(OLED0561_ADD, COM, buf[0]);
	I2C_SAND_BYTE(OLED0561_ADD, COM, buf[1]);
	I2C_SAND_BYTE(OLED0561_ADD, COM, buf[2]);
	I2C_SAND_BYTE(OLED0561_ADD, COM, buf[3]);
	I2C_SAND_BYTE(OLED0561_ADD, COM, buf[4]);
	I2C_SAND_BYTE(OLED0561_ADD, COM, buf[5]);

	buf[0] = 0x2F;          // 启动滚动
	I2C_SAND_BYTE(OLED0561_ADD, COM, buf[0]);
}

/* 函数：OLED_SCROLL_LEFT
 * 功能：配置并启动向左水平滚动
 * 参数：start_row ~ end_row 页范围（0-7）
 * 说明：根据SSD1306 datasheet，左滚动需要8字节命令序列
 */
void OLED_SCROLL_LEFT(u8 start_row, u8 end_row)
{
    u8 buf[8];

    // 1. 先停止当前滚动（如果有）
    buf[0] = 0x2E;
    I2C_SAND_BYTE(OLED0561_ADD, COM, buf[0]);

    // 2. 配置向左滚动参数
    buf[0] = 0x27;          // 向左水平滚动命令
    buf[1] = 0x00;          // A[7:0] = 0x00（固定）
    buf[2] = start_row;     // 起始页地址（0-7）
    buf[3] = 0x00;          // 滚动速度：0x00 = 5 frames/step
    buf[4] = end_row;       // 结束页地址（0-7）
    buf[5] = 0x00;          // 起始列偏移（固定为0）
    buf[6] = 0xFF;          // 结束列偏移（固定为0xFF，对应128列）
    buf[7] = 0x00;          // 额外空字节（固定）

    // 3. 发送完整的滚动配置命令序列
    I2C_SAND_BYTE(OLED0561_ADD, COM, buf[0]);
    I2C_SAND_BYTE(OLED0561_ADD, COM, buf[1]);
    I2C_SAND_BYTE(OLED0561_ADD, COM, buf[2]);
    I2C_SAND_BYTE(OLED0561_ADD, COM, buf[3]);
    I2C_SAND_BYTE(OLED0561_ADD, COM, buf[4]);
    I2C_SAND_BYTE(OLED0561_ADD, COM, buf[5]);
    I2C_SAND_BYTE(OLED0561_ADD, COM, buf[6]);
    I2C_SAND_BYTE(OLED0561_ADD, COM, buf[7]);

    // 4. 启动滚动
    buf[0] = 0x2F;
    I2C_SAND_BYTE(OLED0561_ADD, COM, buf[0]);
}

/* 函数：OLED_SCROLL_STOP
 * 功能：停止任何滚动操作
 */
void OLED_SCROLL_STOP(void)
{
    u8 buf = 0x2E;
    I2C_SAND_BYTE(OLED0561_ADD, COM, buf);
}


 
/*********************************************************************************************
 * �������� www.DoYoung.net
 * ���ҵ��� www.DoYoung.net/YT 
*********************************************************************************************/

//----- ���ں�����ʾ�ĳ����ݲ�ʹ�� ------//

//��ʾ����16*16
//ȡģ��СΪ16*16��ȡģ��ʽΪ�������Ҵ��ϵ��¡�������8���¸�λ��
//void OLED_DISPLAY_16_16(u8 x, //��ʾ���ֵ�ҳ���꣨��0xB0��0xB7��
//			u8 y, //��ʾ���ֵ������꣨��0��63��
//			u16 w){ //Ҫ��ʾ���ֵı��
//	u8 j,t,c=0;
//	for(t=0;t<2;t++){
//		I2C_SAND_BYTE(OLED0561_ADD,COM,x); //ҳ��ַ����0xB0��0xB7��
//		I2C_SAND_BYTE(OLED0561_ADD,COM,y/16+0x10); //��ʼ�е�ַ�ĸ�4λ
//		I2C_SAND_BYTE(OLED0561_ADD,COM,y%16);	//��ʼ�е�ַ�ĵ�4λ
//		for(j=0;j<16;j++){ //��ҳ�������
// 			I2C_SAND_BYTE(OLED0561_ADD,DAT,GB_16[(w*32)+c]);
//			c++;}x++; //ҳ��ַ��1
//	}
//	I2C_SAND_BYTE(OLED0561_ADD,COM,0xAF); //����ʾ 
//}
//�û��Զ���ĺ��ֿ���ã�w��uc.h��Ҫ��ʾ���ֵı�ţ����˴������޸ģ�
//void OLED_DISPLAY_16_16_UC(u16 w){ 
//	u8 x,j,t,c=0;
//	x=0xb1;
//	for(t=0;t<2;t++){
//		I2C_SAND_BYTE(OLED0561_ADD,COM,x); //ҳ��ַ����0xB0��0xB7��
//		I2C_SAND_BYTE(OLED0561_ADD,COM,XY_UC/16+0x10); //��ʼ�е�ַ�ĸ�4λ
//		I2C_SAND_BYTE(OLED0561_ADD,COM,XY_UC%16);	//��ʼ�е�ַ�ĵ�4λ
//		for(j=0;j<16;j++){ //��ҳ�������
// 			I2C_SAND_BYTE(OLED0561_ADD,DAT,GB_UC16[(w*32)+c]);
//			c++;}x++; //ҳ��ַ��1
//	}
//	I2C_SAND_BYTE(OLED0561_ADD,COM,0xAF); //����ʾ 
//}



