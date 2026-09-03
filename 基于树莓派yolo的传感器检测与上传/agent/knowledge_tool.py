#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""专家知识库查询工具 - 从 bonsai_agent 迁移

数据源优先级：
    1. JSON 数据库（agent/data/pest_database.json，无需额外依赖）
    2. Excel 专家数据库（agent/data/专家数据库.xlsx，需 pandas + python-calamine）

统一输出格式（与 bonsai_agent Excel 列名保持一致，供 llm_tool 使用）：
    专家条目ID / 问题标准名称 / 判断依据 / 典型症状 / 备注 /
    立即措施 / 农业/养护措施 / 风险等级
"""

import json
import logging
import os
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

# JSON 数据库 -> 专家条目字段映射辅助说明
_ENV_LABELS = {
    "high_temperature": "高温环境易发",
    "dry_environment": "干燥环境易发",
}


class KnowledgeTool:
    """专家知识库查询"""

    def __init__(self, data_paths: List[str]):
        """初始化知识库

        Args:
            data_paths: 数据文件路径列表（按优先级排序，先找到的生效）
        """
        self.data_paths = data_paths
        self._entries: Optional[List[Dict]] = None
        self._source: str = ""
        self._mtime: float = 0.0

    # --------------------------------------------------
    # 数据加载
    # --------------------------------------------------

    def _load(self) -> List[Dict]:
        """按优先级加载数据库（文件变化时自动重载）"""
        for path in self.data_paths:
            if not path or not os.path.exists(path):
                continue
            try:
                mtime = os.path.getmtime(path)
                if self._entries is not None and self._source == path and mtime == self._mtime:
                    return self._entries

                if path.lower().endswith(".json"):
                    entries = self._load_json(path)
                else:
                    entries = self._load_excel(path)

                self._entries = entries
                self._source = path
                self._mtime = mtime
                logger.info(f"[Agent知识库] 已加载 {len(entries)} 条专家条目: {path}")
                return entries
            except ImportError as e:
                logger.warning(f"[Agent知识库] 缺少依赖，跳过 {path}: {e}")
            except Exception as e:
                logger.error(f"[Agent知识库] 加载失败 {path}: {e}")

        if self._entries is None:
            logger.warning("[Agent知识库] 无可用数据文件，专家匹配将不可用")
            self._entries = []
        return self._entries

    @staticmethod
    def _load_json(path: str) -> List[Dict]:
        """加载 JSON 数据库并转换为统一专家条目格式"""
        with open(path, "r", encoding="utf-8") as f:
            raw = json.load(f)

        entries = []
        for item in raw or []:
            name = str(item.get("name", "")).strip()
            if not name:
                continue

            symptoms = item.get("symptoms") or []
            treatment = item.get("treatment") or []
            env = item.get("environment") or {}

            env_desc = "；".join(
                label for key, label in _ENV_LABELS.items() if env.get(key)
            )

            judgment = "典型症状：" + "；".join(symptoms) if symptoms else ""
            if env_desc:
                judgment = f"{judgment}。发生环境：{env_desc}" if judgment else f"发生环境：{env_desc}"

            entries.append({
                "专家条目ID": str(item.get("id", "")),
                "问题标准名称": name,
                "判断依据": judgment,
                "典型症状": "；".join(symptoms),
                "立即措施": "；".join(treatment),
                "农业/养护措施": "",
                "风险等级": "待评估",
                "备注": env_desc,
            })
        return entries

    @staticmethod
    def _load_excel(path: str) -> List[Dict]:
        """加载 Excel 专家数据库（沿用 bonsai_agent 的 pandas + calamine 方案）"""
        import pandas as pd

        df = pd.read_excel(path, sheet_name="专家数据库", engine="calamine")
        entries = []
        for _, row in df.iterrows():
            name = str(row.get("问题标准名称", "")).strip()
            if not name or name.lower() == "nan":
                continue
            entries.append({k: ("" if str(v).lower() == "nan" else str(v)) for k, v in row.items()})
        return entries

    # --------------------------------------------------
    # 查询
    # --------------------------------------------------

    def search_expert(self, pest_name: str) -> Optional[Dict]:
        """按病虫害名称查询专家条目（双向子串匹配）

        Args:
            pest_name: YOLO 识别的病虫害名称

        Returns:
            专家条目字典（统一格式），未命中返回 None
        """
        if not pest_name:
            return None

        entries = self._load()
        for entry in entries:
            standard = str(entry.get("问题标准名称", ""))
            if pest_name in standard or standard in pest_name:
                return entry
        return None

    def get_source(self) -> str:
        """获取当前生效的数据文件路径"""
        self._load()
        return self._source
