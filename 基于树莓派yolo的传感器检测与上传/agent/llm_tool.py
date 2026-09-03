#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""DeepSeek(Ollama) 辅助诊疗工具 - 从 bonsai_agent 迁移

设计原则（与 bonsai_agent 一致）：
    YOLO → 初步识别"是什么"
    专家数据库 → 提供可靠知识和处置依据
    DeepSeek → 辅助解释、补充判断、未命中专家库时提供谨慎兜底

DeepSeek 不直接控制 GPIO、水泵等执行器。
模型与 Ollama 地址通过 config/settings.yaml 的 agent.llm 配置段指定。
"""

import logging
import re
from pathlib import Path
from typing import Dict

logger = logging.getLogger(__name__)

# Agent 包根目录（agent/）
AGENT_ROOT = Path(__file__).resolve().parent

# 默认配置
DEFAULT_LLM_CONFIG = {
    "enabled": True,
    "host": "http://127.0.0.1:11434",
    "model": "deepseek-r1:1.5b",
    "timeout": 120,        # 单次调用超时（秒）
    "temperature": 0.2,
}


def _get_llm_config(llm_config: Dict = None) -> Dict:
    return {**DEFAULT_LLM_CONFIG, **(llm_config or {})}


def load_system_prompt() -> str:
    """读取 system prompt（缺失时使用内置兜底）"""
    prompt_path = AGENT_ROOT / "prompts" / "system_prompt.txt"
    if not prompt_path.exists():
        return (
            "你是天工慧眼川派盆景智能诊疗Agent。"
            "回答应专业、谨慎，不得把视觉识别结果表述为百分之百确诊。"
        )
    return prompt_path.read_text(encoding="utf-8")


def clean_model_output(text) -> str:
    """清理模型输出（去除思考过程与 Markdown 标记）"""
    if text is None:
        return ""
    text = str(text).strip()
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    text = text.replace("```text", "").replace("```json", "")
    text = text.replace("```", "").replace("**", "")
    return text.strip()


def ask_deepseek(prompt: str, llm_config: Dict = None, num_predict: int = 500) -> str:
    """调用 Ollama 上的 DeepSeek 模型

    Args:
        prompt: 用户提示词
        llm_config: LLM 配置（host/model/timeout/temperature）
        num_predict: 最大生成 token 数

    Returns:
        模型输出文本；失败抛出异常（由上层兜底）
    """
    cfg = _get_llm_config(llm_config)

    import ollama

    client = ollama.Client(host=cfg["host"], timeout=cfg["timeout"])
    response = client.generate(
        model=cfg["model"],
        prompt=prompt,
        options={
            "temperature": cfg["temperature"],
            "num_predict": num_predict,
        },
    )

    try:
        raw_text = response.response
    except AttributeError:
        raw_text = response.get("response", "")

    return clean_model_output(raw_text)


def _build_prompt(system_prompt: str, task: str) -> str:
    return f"""
【系统要求】

{system_prompt}


【当前任务】

{task}


请直接给最终答案。
不要展示思考过程。
"""


# ==================================================
# 情况1：专家数据库命中
# ==================================================

def call_llm_with_expert(yolo_result: Dict, expert_info: Dict,
                         llm_config: Dict = None) -> Dict:
    """专家库命中时调用 DeepSeek 生成诊断与复核提示

    Args:
        yolo_result: {name, confidence}
        expert_info: 知识库统一格式条目

    Returns:
        {diagnosis, warning, knowledge_source}
    """
    cfg = _get_llm_config(llm_config)

    detected_name = yolo_result.get("name", "未知病虫害")
    confidence = yolo_result.get("confidence", 0)
    standard_name = expert_info.get("问题标准名称", detected_name) or detected_name
    judgment = expert_info.get("判断依据", "") or ""
    symptoms = expert_info.get("典型症状", "") or ""
    remark = expert_info.get("备注", "") or ""

    diagnosis_prompt = f"""
YOLO视觉模型检测到：

病虫害：
{detected_name}

置信度：
{confidence * 100:.1f}%

本地专家数据库标准名称：
{standard_name}

专家判断依据：
{judgment}


请生成一句简洁的初步诊断。

要求：

1. 必须使用"疑似"或"初步判断"等谨慎表述。
2. 不得说已经百分之百确诊。
3. 不得增加专家数据库中不存在的事实。
4. 不要输出治疗方案。
5. 控制在80个汉字以内。
"""

    diagnosis = ""
    if cfg.get("enabled", True):
        try:
            diagnosis = ask_deepseek(
                _build_prompt(load_system_prompt(), diagnosis_prompt),
                llm_config, num_predict=300,
            )
        except Exception as e:
            logger.warning(f"[AgentLLM] 辅助诊断失败: {e}")
    if not diagnosis:
        diagnosis = (
            f"YOLO检测到疑似{standard_name}，"
            "建议结合专家数据库中的典型特征进一步确认。"
        )

    warning_prompt = f"""
当前疑似问题：

{standard_name}

专家数据库典型症状：

{symptoms}

专家数据库备注：

{remark}


请生成一句人工复核提示。

要求：

1. 告诉用户还需要检查什么。
2. 必须依据上述专家数据库内容。
3. 不得增加数据库没有的信息。
4. 不输出治疗方案。
5. 控制在80个汉字以内。
"""

    warning = ""
    if cfg.get("enabled", True):
        try:
            warning = ask_deepseek(
                _build_prompt(load_system_prompt(), warning_prompt),
                llm_config, num_predict=300,
            )
        except Exception as e:
            logger.warning(f"[AgentLLM] 复核提示失败: {e}")
    if not warning:
        warning = "建议结合专家数据库中的典型症状、发生部位及现场情况进一步人工复核。"

    return {
        "diagnosis": diagnosis,
        "warning": warning,
        "knowledge_source": "expert_database",
    }


# ==================================================
# 情况2：专家数据库未命中，DeepSeek 兜底
# ==================================================

def call_llm_without_expert(yolo_result: Dict, llm_config: Dict = None) -> Dict:
    """专家库未命中时调用 DeepSeek 通用知识兜底

    Args:
        yolo_result: {name, confidence}

    Returns:
        {diagnosis, general_advice, warning, knowledge_source}
    """
    cfg = _get_llm_config(llm_config)

    detected_name = yolo_result.get("name", "未知病虫害")
    confidence = yolo_result.get("confidence", 0)

    diagnosis_prompt = f"""
YOLO视觉模型检测到疑似病虫害：

名称：
{detected_name}

置信度：
{confidence * 100:.1f}%

但是本地专家数据库没有找到对应知识条目。


请根据你的通用植物病虫害知识，
生成简短的初步判断。

要求：

1. 必须明确这是AI通用判断。
2. 使用"疑似""可能"等谨慎表述。
3. 不得表述为百分之百确诊。
4. 控制在100个汉字以内。
"""

    diagnosis = ""
    if cfg.get("enabled", True):
        try:
            diagnosis = ask_deepseek(
                _build_prompt(load_system_prompt(), diagnosis_prompt),
                llm_config, num_predict=350,
            )
        except Exception as e:
            logger.warning(f"[AgentLLM] 通用诊断失败: {e}")
    if not diagnosis:
        diagnosis = (
            f"YOLO检测到疑似{detected_name}，"
            "但本地专家数据库暂无对应条目，"
            "建议人工复核。"
        )

    advice_prompt = f"""
当前YOLO检测到疑似：

{detected_name}

本地专家数据库没有对应条目。


请根据通用植物病虫害知识，
给出安全、保守的初步处理建议。

要求：

1. 可以建议隔离观察、检查病叶、改善通风、
   清理受害组织、记录病情变化等一般措施。

2. 不得给出具体农药浓度。

3. 不得给出具体稀释倍数。

4. 不得给出具体药剂混配方案。

5. 不得声称已经确诊。

6. 如果涉及专业用药，
   必须建议咨询当地农技或植保专业人员。

7. 控制在200个汉字以内。
"""

    general_advice = ""
    if cfg.get("enabled", True):
        try:
            general_advice = ask_deepseek(
                _build_prompt(load_system_prompt(), advice_prompt),
                llm_config, num_predict=500,
            )
        except Exception as e:
            logger.warning(f"[AgentLLM] 通用建议失败: {e}")
    if not general_advice:
        general_advice = (
            "建议先隔离观察受影响植株，"
            "检查叶片正反面及受害部位，"
            "保持适当通风并记录病情变化。"
            "如症状持续或加重，"
            "建议咨询专业植保人员。"
        )

    warning = (
        "当前病虫害未命中本地专家数据库，"
        "以下内容属于DeepSeek通用AI建议，"
        "未经本地专家知识库验证，"
        "请人工复核后再采取处置措施。"
    )

    return {
        "diagnosis": diagnosis,
        "general_advice": general_advice,
        "warning": warning,
        "knowledge_source": "deepseek_general",
    }
