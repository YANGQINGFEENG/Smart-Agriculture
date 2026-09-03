#!/bin/bash
# 树莓派 Agent 模块验证脚本
cd /home/pi/smart-farm
~/smart-farm/venv/bin/python - <<'EOF'
import pandas, ollama, python_calamine
from agent.knowledge_tool import KnowledgeTool
from agent.decision_engine import make_control_decision

k = KnowledgeTool(["agent/data/pest_database.json", "agent/data/专家数据库.xlsx"])
e = k.search_expert("红蜘蛛")
print("KNOWLEDGE:", e["专家条目ID"], e["问题标准名称"])

a = make_control_decision({"soil_moisture": 22, "temperature": 28})
print("DECISION:", a[0]["device"] if a else "none")
EOF
echo "TEST_DONE"
