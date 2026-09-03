def get_sensor_data():

    """
    模拟农业传感器数据

    以后这里替换成：
    树莓派GPIO
    I2C
    UART
    """

    sensor_data = {

        "temperature": 31,

        "humidity": 45,

        "soil_moisture": 22,

        "light": 65000

    }


    return sensor_data