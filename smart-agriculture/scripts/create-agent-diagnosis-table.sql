-- =====================================================================
-- 边缘 Agent 诊疗记录表（树莓派智能养护 Agent 上报）
-- 注意：MySQL 语法，不使用 IF NOT EXISTS（云端部署规范）
-- 在云端 MySQL 执行：mysql -u root -p smart_agriculture < create-agent-diagnosis-table.sql
-- =====================================================================

CREATE TABLE agent_diagnosis_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  gateway_id INT NULL COMMENT '网关ID（关联gateways表，未知时为NULL）',
  farm_id INT NULL COMMENT '农场ID',
  node_id VARCHAR(64) DEFAULT '' COMMENT '设备节点ID（如摄像头 CAM-1-001）',
  pest_name VARCHAR(128) NOT NULL COMMENT '病虫害名称',
  confidence FLOAT DEFAULT 0 COMMENT 'YOLO置信度（0-1）',
  expert_id VARCHAR(64) DEFAULT NULL COMMENT '专家库条目ID（未命中为NULL）',
  risk_level VARCHAR(32) DEFAULT '待评估' COMMENT '风险等级',
  diagnosis TEXT COMMENT 'AI诊断描述',
  advice TEXT COMMENT '处置建议',
  knowledge_source VARCHAR(32) DEFAULT '' COMMENT '知识来源（expert_database/deepseek_general）',
  detected_at DATETIME NULL COMMENT '检测时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '入库时间',
  INDEX idx_agent_diag_pest (pest_name),
  INDEX idx_agent_diag_created (created_at),
  INDEX idx_agent_diag_gateway (gateway_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='边缘智能养护Agent诊疗记录';
