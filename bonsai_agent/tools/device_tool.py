def water_pump_on(seconds):

    print(
        f"💧 水泵启动 {seconds} 秒"
    )


def fan_on():

    print(
        "🌬 风扇启动"
    )


def light_on():

    print(
        "💡 补光灯启动"
    )


def execute_action(action):

    """
    执行动作
    """

    if action["device"] == "water_pump":

        water_pump_on(
            action["duration"]
        )


    elif action["device"] == "fan":

        fan_on()


    elif action["device"] == "light":

        light_on()


    else:

        print(
            "未知设备"
        )