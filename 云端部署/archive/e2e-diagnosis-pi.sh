#!/bin/bash
# 树莓派 -> 云端 诊疗流程端到端验证
# 模拟 YOLO 检测到"红蜘蛛"，触发 AgentService 完整视觉诊疗流水线：
#   YOLO 结果 -> 专家知识库(P001 命中) -> DeepSeek(无 Ollama 时走兜底文案) -> upload_agent_diagnosis 上云
cd /home/pi/smart-farm
~/smart-farm/venv/bin/python - <<'EOF'
import sys
sys.path.insert(0, '.')

from agent.agent_service import AgentService
from core.config_manager import ConfigManager
from services.upload_service import UploadService
from services.cache_service import CacheService

config = ConfigManager(None)


class FakeSystem:
    """最小 System 桩：仅提供 AgentService 视觉流水线所需依赖"""
    pass


sys_obj = FakeSystem()
sys_obj.config = config
sys_obj.device_mapping = config.get("device_mapping", {}) or {}
sys_obj.upload = UploadService(config, CacheService("data/cache.db"))


class FakeDetector:
    """模拟 YOLO 检测器：返回一次红蜘蛛检测结果"""
    def get_detections(self):
        return [{
            "class_id": 0,
            "class_name": "红蜘蛛",
            "confidence": 0.91,
            "bbox": [10.0, 20.0, 100.0, 120.0],
        }]


sys_obj._yolo_detector = FakeDetector()

agent = AgentService(sys_obj, config.get("agent", {}))
agent._process_vision()

record = agent._last_diagnosis_record
print("E2E_RECORD:", "OK" if record else "MISSING")
print("PEST:", record.get("pest_name") if record else "-")
print("SOURCE:", record.get("knowledge_source") if record else "-")
print("UPLOAD_PENDING:", len(agent._pending_diagnosis))
EOF
echo "E2E_DONE"
