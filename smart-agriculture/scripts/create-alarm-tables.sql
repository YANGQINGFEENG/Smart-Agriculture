-- 报警规则表
CREATE TABLE IF NOT EXISTS alarm_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sensor_type TEXT NOT NULL,
    condition_type TEXT NOT NULL CHECK (condition_type IN ('above', 'below', 'equals', 'range')),
    min_value REAL,
    max_value REAL,
    severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
    enabled INTEGER DEFAULT 1,
    notify_email INTEGER DEFAULT 0,
    notify_sms INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 报警记录表
CREATE TABLE IF NOT EXISTS alarm_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id INTEGER,
    sensor_id TEXT,
    sensor_type TEXT,
    alarm_type TEXT NOT NULL CHECK (alarm_type IN ('threshold', 'offline', 'low_battery', 'data_anomaly')),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    message TEXT NOT NULL,
    value REAL,
    threshold_info TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
    acknowledged_by TEXT,
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rule_id) REFERENCES alarm_rules(id) ON DELETE SET NULL
);

-- 报警通知表
CREATE TABLE IF NOT EXISTS alarm_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alarm_id INTEGER NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'wechat', 'system')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    sent_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (alarm_id) REFERENCES alarm_records(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_alarm_records_status ON alarm_records(status);
CREATE INDEX IF NOT EXISTS idx_alarm_records_created ON alarm_records(created_at);
CREATE INDEX IF NOT EXISTS idx_alarm_records_sensor ON alarm_records(sensor_id);
CREATE INDEX IF NOT EXISTS idx_alarm_rules_sensor_type ON alarm_rules(sensor_type);
