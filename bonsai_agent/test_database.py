from tools.sensor_tool import get_sensor_data

from database.repository import (
    save_sensor_record,
    get_latest_sensor_record,
    save_detection_record,
    get_latest_detection_record
)


# ==================================================
# 1. 测试传感器数据
# ==================================================

sensor_data = get_sensor_data()

print("当前传感器数据：")
print(sensor_data)

save_sensor_record(
    sensor_data
)

print("\n传感器数据已成功写入SQLite")

latest_sensor = get_latest_sensor_record()

print("\nSQLite最新传感器记录：")
print(latest_sensor)


# ==================================================
# 2. 模拟YOLO识别结果
# ==================================================

yolo_result = {
    "name": "红蜘蛛",
    "confidence": 0.87
}

print("\n当前YOLO识别结果：")
print(yolo_result)


# ==================================================
# 3. 保存YOLO结果
# ==================================================

save_detection_record(
    yolo_result,
    image_path="images/test_red_spider.jpg"
)

print("\nYOLO识别结果已成功写入SQLite")


# ==================================================
# 4. 读取最新YOLO记录
# ==================================================

latest_detection = get_latest_detection_record()

print("\nSQLite最新YOLO识别记录：")
print(latest_detection)