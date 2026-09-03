# 树莓派 smart-farm 部署同步脚本
# 用法：在 e:\tghy\基于树莓派yolo的传感器检测与上传 目录下执行 .\deploy.ps1
# 依赖：SSH 免密登录 pi@10.248.88.186（用本机默认密钥，勿指定云端 pem）
# 可用 -PiHost 覆盖设备地址，例如：.\deploy.ps1 -PiHost raspberrypi
param([string]$PiHost = "10.248.88.186")
$Pi = "pi@$PiHost"

# --- 核心服务 ---
ssh $Pi "mkdir -p ~/smart-farm/models ~/smart-farm/data"
scp services\websocket_service.py "${Pi}:~/smart-farm/services/"
scp services\upload_service.py "${Pi}:~/smart-farm/services/"
scp services\model_manager.py "${Pi}:~/smart-farm/services/"
scp drivers\yolo_detector.py "${Pi}:~/smart-farm/drivers/"
scp app\system.py "${Pi}:~/smart-farm/app/"
scp config\settings.yaml "${Pi}:~/smart-farm/config/"

# --- 智能养护 Agent（bonsai_agent 迁移模块）---
ssh $Pi "mkdir -p ~/smart-farm/agent/data ~/smart-farm/agent/prompts"
scp agent\__init__.py agent\agent_service.py agent\decision_engine.py agent\knowledge_tool.py agent\llm_tool.py agent\device_tool.py "${Pi}:~/smart-farm/agent/"
scp agent\data\pest_database.json "agent\data\专家数据库.xlsx" "${Pi}:~/smart-farm/agent/data/"
scp agent\prompts\system_prompt.txt "${Pi}:~/smart-farm/agent/prompts/"

# --- 重启并查看启动日志 ---
ssh $Pi "sudo systemctl restart smart-farm && sleep 3 && sudo journalctl -u smart-farm --since '5 sec ago' --no-pager | tail -30"
