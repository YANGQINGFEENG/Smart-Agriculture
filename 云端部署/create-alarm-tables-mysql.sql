-- 报警相关表（MySQL 8.0 版，自 scripts/create-alarm-tables.sql 转换）
USE smart_agriculture;

CREATE TABLE IF NOT EXISTS alarm_rules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    sensor_type VARCHAR(100) NOT NULL,
    condition_type VARCHAR(20) NOT NULL,
    min_value DOUBLE,
    max_value DOUBLE,
    severity VARCHAR(20) NOT NULL DEFAULT 'warning',
    enabled TINYINT DEFAULT 1,
    notify_email TINYINT DEFAULT 0,
    notify_sms TINYINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alarm_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    rule_id INT,
    sensor_id VARCHAR(50),
    sensor_type VARCHAR(100),
    alarm_type VARCHAR(30) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    value DOUBLE,
    threshold_info TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP NULL,
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rule_id) REFERENCES alarm_rules(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS alarm_notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    alarm_id INT NOT NULL,
    channel VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    sent_at TIMESTAMP NULL,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (alarm_id) REFERENCES alarm_records(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_alarm_records_status ON alarm_records(status);
CREATE INDEX IF NOT EXISTS idx_alarm_records_created ON alarm_records(created_at);
CREATE INDEX IF NOT EXISTS idx_alarm_records_sensor ON alarm_records(sensor_id);
CREATE INDEX IF NOT EXISTS idx_alarm_rules_sensor_type ON alarm_rules(sensor_type);

SELECT 'alarm-tables-created' AS result;
