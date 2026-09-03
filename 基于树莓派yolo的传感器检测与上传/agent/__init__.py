# -*- coding: utf-8 -*-
"""智能养护 Agent 包

从 bonsai_agent 项目迁移集成，提供：
- decision_engine  环境规则决策引擎（阈值配置化）
- knowledge_tool   专家知识库（JSON 优先 / Excel 回退）
- llm_tool         DeepSeek(Ollama) 辅助诊疗
- device_tool      自动控制执行（对接真实执行器驱动）
- agent_service    服务编排（环境监测 + 视觉诊疗双流水线）
"""
