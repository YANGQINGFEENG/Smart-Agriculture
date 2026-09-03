from database.repository import (
    save_diagnosis_record,
    get_latest_diagnosis_record,
    save_device_log,
    get_latest_device_log
)


# ==================================================
# 1. 模拟一条Agent诊疗结果
# ==================================================

diagnosis_data = {

    "pest_name": "二斑叶螨（红蜘蛛）",

    "expert_id": "KB-JDZ-008",

    "risk_level": "中",

    "diagnosis": "疑似红蜘蛛，建议结合叶背虫体和蛛丝进一步确认。",

    "advice": "摘除受害叶片，冲洗叶背，加强通风，并根据专家知识库进行后续防治。",

    "knowledge_source": "expert_database"
}


print("当前诊疗结果：")
print(diagnosis_data)


save_diagnosis_record(
    diagnosis_data
)


print("\n诊疗结果已写入SQLite")


latest_diagnosis = (
    get_latest_diagnosis_record()
)


print("\nSQLite最新诊疗记录：")
print(latest_diagnosis)


# ==================================================
# 2. 模拟一条水泵执行记录
# ==================================================

device_data = {

    "device": "water_pump",

    "action": "ON",

    "duration": 5,

    "reason": "土壤湿度低于25%"
}


print("\n当前设备动作：")
print(device_data)


save_device_log(
    device_data
)


print("\n设备执行日志已写入SQLite")


latest_device = (
    get_latest_device_log()
)


print("\nSQLite最新设备日志：")
print(latest_device)