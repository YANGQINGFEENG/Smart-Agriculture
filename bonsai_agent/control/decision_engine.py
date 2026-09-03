def make_control_decision(sensor_data):


    actions = []


    # 土壤湿度控制

    if sensor_data["soil_moisture"] < 25:


        actions.append({

            "device":"water_pump",

            "duration":5,

            "reason":
            "土壤湿度过低"

        })


    # 温度控制

    if sensor_data["temperature"] > 35:


        actions.append({

            "device":"fan",

            "reason":
            "温度过高"

        })


    # 光照控制

    if sensor_data["light"] < 10000:


        actions.append({

            "device":"light",

            "reason":
            "光照不足"

        })


    return actions