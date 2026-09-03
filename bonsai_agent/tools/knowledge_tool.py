import pandas as pd
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent

EXCEL_PATH = (
    BASE_DIR /
    "data" /
    "专家数据库.xlsx"
)


def search_expert(pest_name):

    # 读取专家数据库工作表
    df = pd.read_excel(
        EXCEL_PATH,
        sheet_name="专家数据库",
        engine="calamine"
    )


    for _, row in df.iterrows():

        name = str(
            row.get(
                "问题标准名称",
                ""
            )
        )


        if pest_name in name:

            return row.to_dict()


    return None