"""
创建天工慧眼图标
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon():
    # 创建512x512的图像
    size = 512
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 绘制圆形背景
    margin = 20
    draw.ellipse([margin, margin, size-margin, size-margin], fill='#2563eb')
    
    # 绘制内圆
    inner_margin = 40
    draw.ellipse([inner_margin, inner_margin, size-inner_margin, size-inner_margin], fill='#1d4ed8')
    
    # 绘制文字 "TG"
    try:
        # 尝试使用系统字体
        font = ImageFont.truetype("msyh.ttc", 180)
    except:
        try:
            font = ImageFont.truetype("arial.ttf", 180)
        except:
            font = ImageFont.load_default()
    
    # 获取文字边界框
    bbox = draw.textbbox((0, 0), "TG", font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    # 居中绘制文字
    x = (size - text_width) // 2
    y = (size - text_height) // 2 - 10
    draw.text((x, y), "TG", fill='white', font=font)
    
    # 绘制底部小字
    try:
        small_font = ImageFont.truetype("msyh.ttc", 48)
    except:
        small_font = ImageFont.load_default()
    
    bbox = draw.textbbox((0, 0), "天工慧眼", font=small_font)
    text_width = bbox[2] - bbox[0]
    x = (size - text_width) // 2
    y = size - 80
    draw.text((x, y), "天工慧眼", fill='#93c5fd', font=small_font)
    
    # 保存为不同尺寸
    sizes = [16, 32, 48, 64, 128, 256, 512]
    for s in sizes:
        resized = img.resize((s, s), Image.Resampling.LANCZOS)
        resized.save(f"icon_{s}.png")
    
    # 保存ICO文件
    img.save("icon.ico", format='ICO', sizes=[(s, s) for s in [16, 32, 48, 64, 128, 256]])
    
    print("✓ 图标文件已生成")
    
if __name__ == "__main__":
    create_icon()
