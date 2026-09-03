#!/bin/bash
# 树莓派磁盘回收：清理 apt 下载缓存（用户已授权）
# 只清 /var/cache/apt 下的 .deb 安装包缓存，不影响已安装软件与业务数据
echo "=== 清理前 ==="
df -h / | tail -1
sudo du -sh /var/cache/apt 2>/dev/null

sudo apt-get clean
echo "APT_CLEAN_EXIT=$?"

echo "=== 清理后 ==="
sudo du -sh /var/cache/apt 2>/dev/null
df -h / | tail -1

echo "=== 其余占用参考（只读） ==="
sudo du -sh /var/log/journal 2>/dev/null
du -sh /home/pi/.cache 2>/dev/null
du -sh /home/pi/linux 2>/dev/null
du -sh /home/pi/object_detection_COCO 2>/dev/null
sudo du -sh /usr/lib/python3/dist-packages 2>/dev/null
echo "=== smart-farm 业务目录（不动） ==="
du -sh /home/pi/smart-farm/venv /home/pi/smart-farm/models /home/pi/smart-farm/data 2>/dev/null
echo "APT_CLEAN_DONE"
