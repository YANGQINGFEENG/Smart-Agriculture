import sqlite3
from pathlib import Path


# ==========================================
# 项目根目录
# ==========================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent


# ==========================================
# SQLite数据库文件
# ==========================================

DB_PATH = (
    PROJECT_ROOT
    / "data"
    / "tiangong_huiyan.db"
)


# ==========================================
# 获取数据库连接
# ==========================================

def get_connection():

    connection = sqlite3.connect(
        DB_PATH
    )

    # 以后查询出来可以按字段名读取
    connection.row_factory = sqlite3.Row

    return connection