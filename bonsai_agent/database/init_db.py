from database.database import get_connection


def create_tables():

    connection = get_connection()

    cursor = connection.cursor()


    # ==========================================
    # 1. 传感器历史数据
    # ==========================================

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS sensor_records (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            temperature REAL,

            humidity REAL,

            soil_moisture REAL,

            light REAL,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP

        )
        """
    )


    # ==========================================
    # 2. YOLO病虫害识别记录
    # ==========================================

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS detection_records (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            pest_name TEXT,

            confidence REAL,

            image_path TEXT,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP

        )
        """
    )


    # ==========================================
    # 3. Agent诊疗记录
    # ==========================================

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS diagnosis_records (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            pest_name TEXT,

            expert_id TEXT,

            risk_level TEXT,

            diagnosis TEXT,

            advice TEXT,

            knowledge_source TEXT,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP

        )
        """
    )


    # ==========================================
    # 4. 设备执行日志
    # ==========================================

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS device_logs (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            device TEXT,

            action TEXT,

            duration REAL,

            reason TEXT,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP

        )
        """
    )


    connection.commit()

    connection.close()


    print(
        "SQLite数据库初始化成功"
    )

    print(
        "已创建以下数据表："
    )

    print(
        "1. sensor_records"
    )

    print(
        "2. detection_records"
    )

    print(
        "3. diagnosis_records"
    )

    print(
        "4. device_logs"
    )


if __name__ == "__main__":

    create_tables()