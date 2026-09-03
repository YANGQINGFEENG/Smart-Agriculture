from database.database import get_connection


# ==================================================
# 1. 保存传感器数据
# ==================================================

def save_sensor_record(sensor_data):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT INTO sensor_records (
            temperature,
            humidity,
            soil_moisture,
            light
        )
        VALUES (?, ?, ?, ?)
        """,
        (
            sensor_data.get("temperature"),
            sensor_data.get("humidity"),
            sensor_data.get("soil_moisture"),
            sensor_data.get("light")
        )
    )

    connection.commit()
    connection.close()


# ==================================================
# 2. 获取最新传感器数据
# ==================================================

def get_latest_sensor_record():

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT *
        FROM sensor_records
        ORDER BY id DESC
        LIMIT 1
        """
    )

    row = cursor.fetchone()

    connection.close()

    if row is None:
        return None

    return dict(row)


# ==================================================
# 3. 保存YOLO识别结果
# ==================================================

def save_detection_record(yolo_result, image_path=None):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT INTO detection_records (
            pest_name,
            confidence,
            image_path
        )
        VALUES (?, ?, ?)
        """,
        (
            yolo_result.get("name"),
            yolo_result.get("confidence"),
            image_path
        )
    )

    connection.commit()
    connection.close()


# ==================================================
# 4. 获取最新YOLO识别结果
# ==================================================

def get_latest_detection_record():

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT *
        FROM detection_records
        ORDER BY id DESC
        LIMIT 1
        """
    )

    row = cursor.fetchone()

    connection.close()

    if row is None:
        return None

    return dict(row)


# ==================================================
# 5. 保存Agent诊疗结果
# ==================================================

def save_diagnosis_record(diagnosis_data):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT INTO diagnosis_records (
            pest_name,
            expert_id,
            risk_level,
            diagnosis,
            advice,
            knowledge_source
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            diagnosis_data.get("pest_name"),
            diagnosis_data.get("expert_id"),
            diagnosis_data.get("risk_level"),
            diagnosis_data.get("diagnosis"),
            diagnosis_data.get("advice"),
            diagnosis_data.get("knowledge_source")
        )
    )

    connection.commit()
    connection.close()


# ==================================================
# 6. 获取最新Agent诊疗结果
# ==================================================

def get_latest_diagnosis_record():

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT *
        FROM diagnosis_records
        ORDER BY id DESC
        LIMIT 1
        """
    )

    row = cursor.fetchone()

    connection.close()

    if row is None:
        return None

    return dict(row)


# ==================================================
# 7. 保存设备执行日志
# ==================================================

def save_device_log(device_data):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT INTO device_logs (
            device,
            action,
            duration,
            reason
        )
        VALUES (?, ?, ?, ?)
        """,
        (
            device_data.get("device"),
            device_data.get("action"),
            device_data.get("duration"),
            device_data.get("reason")
        )
    )

    connection.commit()
    connection.close()


# ==================================================
# 8. 获取最新设备日志
# ==================================================

def get_latest_device_log():

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT *
        FROM device_logs
        ORDER BY id DESC
        LIMIT 1
        """
    )

    row = cursor.fetchone()

    connection.close()

    if row is None:
        return None

    return dict(row)