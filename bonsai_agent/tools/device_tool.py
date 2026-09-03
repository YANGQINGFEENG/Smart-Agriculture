import logging

logger = logging.getLogger(__name__)


def water_pump_on(seconds):

    logger.info("水泵启动 %d 秒", seconds)


def fan_on():

    logger.info("风扇启动")


def light_on():

    logger.info("补光灯启动")


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

        logger.warning("未知设备: %s", action["device"])
