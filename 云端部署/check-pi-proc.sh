#!/bin/bash
echo "--- main.py 进程 ---"
pgrep -af 'main.py'
echo "--- 进程数 ---"
ps aux | grep -c '[m]ain.py'
echo "--- get_local_ip 测试 ---"
cd /home/pi/smart-farm
python3 -c "from services.video_stream_service import VideoStreamService; print(VideoStreamService._get_local_ip())"
echo "--- 当前上报的 camera feedback (从进程内存不可见，看代码路径) ---"
grep -n "192.168.1.63" -r /home/pi/smart-farm --include="*.py" --include="*.yaml" --include="*.json" 2>/dev/null | head -5
