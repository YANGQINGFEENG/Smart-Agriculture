-- 创建策略表
CREATE TABLE IF NOT EXISTS strategies (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  actuator_id VARCHAR(50) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  trigger_condition JSON NOT NULL,
  time_range JSON,
  action ENUM('on', 'off') NOT NULL,
  stop_condition JSON,
  safety_config JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (actuator_id) REFERENCES actuators(id) ON DELETE CASCADE
);

-- 创建策略执行日志表
CREATE TABLE IF NOT EXISTS strategy_execution_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  strategy_id VARCHAR(50) NOT NULL,
  actuator_id VARCHAR(50) NOT NULL,
  execution_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  action ENUM('on', 'off') NOT NULL,
  status ENUM('success', 'failed', 'pending') DEFAULT 'pending',
  error_message TEXT,
  FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE,
  FOREIGN KEY (actuator_id) REFERENCES actuators(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX idx_strategies_actuator_id ON strategies(actuator_id);
CREATE INDEX idx_strategies_enabled ON strategies(enabled);
CREATE INDEX idx_strategy_execution_logs_strategy_id ON strategy_execution_logs(strategy_id);
CREATE INDEX idx_strategy_execution_logs_actuator_id ON strategy_execution_logs(actuator_id);
