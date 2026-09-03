import sys, time
sys.path.insert(0, '/home/pi/smart-farm')
from app.system import SmartFarmSystem

s = SmartFarmSystem()
if s.initialize():
    print('[TEST] 调用 _full_reset_camera()...')
    result = s._full_reset_camera()
    print(f'[TEST] _full_reset_camera 返回: {result}')
    s.cleanup()
else:
    print('[TEST] initialize() 失败')
