USE smart_agriculture;
CREATE INDEX idx_alarm_records_status ON alarm_records(status);
CREATE INDEX idx_alarm_records_created ON alarm_records(created_at);
CREATE INDEX idx_alarm_records_sensor ON alarm_records(sensor_id);
CREATE INDEX idx_alarm_rules_sensor_type ON alarm_rules(sensor_type);
SELECT 'indexes-created' AS result;
