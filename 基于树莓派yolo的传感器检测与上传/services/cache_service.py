#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""本地缓存服务 - SQLite"""

import sqlite3
import json
import os
import logging
from typing import List, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class CacheService:
    """本地缓存服务"""

    def __init__(self, db_path: str = "data/cache.db"):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """初始化数据库"""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sensor_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sensor_id TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                uploaded BOOLEAN DEFAULT FALSE
            )
        """)
        conn.commit()
        conn.close()
        logger.info(f"Cache DB initialized: {self.db_path}")

    def cache_data(self, sensor_id: str, data: Dict[str, Any]):
        """缓存传感器数据"""
        conn = sqlite3.connect(self.db_path)
        conn.execute(
            "INSERT INTO sensor_data (sensor_id, data) VALUES (?, ?)",
            (sensor_id, json.dumps(data))
        )
        conn.commit()
        conn.close()
        logger.debug(f"Cached data: {sensor_id}")

    def get_pending_data(self, limit: int = 100) -> List[Dict]:
        """获取未上传的数据"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute(
            "SELECT id, sensor_id, data, created_at FROM sensor_data WHERE uploaded = FALSE LIMIT ?",
            (limit,)
        )
        rows = cursor.fetchall()
        conn.close()

        return [
            {"id": r[0], "sensor_id": r[1], "data": json.loads(r[2]), "created_at": r[3]}
            for r in rows
        ]

    def mark_uploaded(self, ids: List[int]):
        """标记已上传"""
        conn = sqlite3.connect(self.db_path)
        conn.executemany(
            "UPDATE sensor_data SET uploaded = TRUE WHERE id = ?",
            [(id,) for id in ids]
        )
        conn.commit()
        conn.close()

    def get_count(self) -> int:
        """获取未上传数据数量"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute("SELECT COUNT(*) FROM sensor_data WHERE uploaded = FALSE")
        count = cursor.fetchone()[0]
        conn.close()
        return count

    def cleanup_old_data(self, days: int = 7):
        """清理旧数据"""
        conn = sqlite3.connect(self.db_path)
        conn.execute(
            "DELETE FROM sensor_data WHERE created_at < datetime('now', ?)",
            (f"-{days} days",)
        )
        conn.commit()
        conn.close()
