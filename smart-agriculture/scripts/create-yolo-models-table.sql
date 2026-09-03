-- YOLO 识别模型管理表（网页端切换硬件识别模型）
-- 执行方式：云端 mysql CLI 直接执行（MySQL 语法，不使用 IF NOT EXISTS）
USE smart_agriculture;

-- 1. 模型登记表：每个网关可用的识别模型清单
CREATE TABLE yolo_models (
  id INT AUTO_INCREMENT PRIMARY KEY,
  gateway_id INT NULL COMMENT '关联 gateways.id（可空，未匹配到网关时保留 IP）',
  gateway_ip VARCHAR(64) NOT NULL DEFAULT '' COMMENT '网关IP',
  name VARCHAR(128) NOT NULL COMMENT '模型显示名称',
  filename VARCHAR(191) NOT NULL COMMENT '模型文件名（如 yolo11n.pt / last.pt）',
  description VARCHAR(512) DEFAULT '' COMMENT '模型说明',
  source VARCHAR(32) NOT NULL DEFAULT 'custom' COMMENT '来源：official 官方通用 / trained 自训练 / custom 自定义上传',
  file_url VARCHAR(512) DEFAULT NULL COMMENT '云端模型文件下载地址（自定义上传模型）',
  file_size BIGINT DEFAULT 0 COMMENT '文件大小（字节）',
  size_mb DECIMAL(10,2) DEFAULT 0 COMMENT '文件大小（MB，Pi 上报）',
  class_count INT DEFAULT 0 COMMENT '类别数量',
  classes_json TEXT COMMENT '类别名列表 JSON',
  is_active TINYINT(1) NOT NULL DEFAULT 0 COMMENT '云端期望该网关使用的模型（每网关仅一条为1）',
  status VARCHAR(32) NOT NULL DEFAULT 'idle' COMMENT '切换状态：idle / switching / active / failed',
  last_message VARCHAR(512) DEFAULT '' COMMENT '最近一次切换结果说明',
  model_modified_at VARCHAR(32) DEFAULT NULL COMMENT 'Pi 本地文件修改时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_gateway_filename (gateway_ip, filename),
  KEY idx_gateway_active (gateway_ip, is_active),
  KEY idx_source (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='YOLO 识别模型登记表';

-- 2. 网关模型运行状态表：Pi 上报的当前模型与推理状态（每网关一行）
CREATE TABLE yolo_model_status (
  id INT AUTO_INCREMENT PRIMARY KEY,
  gateway_id INT NULL COMMENT '关联 gateways.id',
  gateway_ip VARCHAR(64) NOT NULL COMMENT '网关IP',
  current_model VARCHAR(191) DEFAULT NULL COMMENT '当前加载的模型文件名',
  loaded TINYINT(1) NOT NULL DEFAULT 0 COMMENT '模型是否加载成功',
  class_count INT DEFAULT 0 COMMENT '当前模型类别数',
  classes_json TEXT COMMENT '当前模型类别名列表 JSON',
  img_size INT DEFAULT NULL COMMENT '推理图像尺寸',
  conf_threshold DECIMAL(5,3) DEFAULT NULL COMMENT '置信度阈值',
  avg_inference_time_ms DECIMAL(10,2) DEFAULT NULL COMMENT '平均推理耗时（毫秒）',
  total_inferences INT DEFAULT 0 COMMENT '累计推理次数',
  switch_count INT DEFAULT 0 COMMENT '本次运行内切换次数',
  last_switch_at VARCHAR(32) DEFAULT NULL COMMENT '最近切换时间',
  last_error VARCHAR(512) DEFAULT NULL COMMENT '最近错误信息',
  switching TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否正在切换中',
  local_models_json TEXT COMMENT 'Pi 本地模型清单 JSON',
  reported_at VARCHAR(32) DEFAULT NULL COMMENT 'Pi 上报时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_gateway_ip (gateway_ip),
  KEY idx_gateway (gateway_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='网关 YOLO 模型运行状态';

-- 3. 模型切换请求记录表：网页端每次下发的切换请求与回执
CREATE TABLE yolo_model_switch_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  gateway_ip VARCHAR(64) NOT NULL COMMENT '网关IP',
  model_id INT NULL COMMENT '目标模型 yolo_models.id',
  filename VARCHAR(191) NOT NULL COMMENT '目标模型文件名',
  from_model VARCHAR(191) DEFAULT NULL COMMENT '切换前模型',
  status VARCHAR(32) NOT NULL DEFAULT 'pending' COMMENT 'pending / pushed / success / failed / timeout',
  message VARCHAR(512) DEFAULT '' COMMENT '回执说明',
  pushed_at DATETIME DEFAULT NULL COMMENT '指令下发时间',
  acked_at DATETIME DEFAULT NULL COMMENT '回执时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_gateway_created (gateway_ip, created_at),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='识别模型切换请求记录';
