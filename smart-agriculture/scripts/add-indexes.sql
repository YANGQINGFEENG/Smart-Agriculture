-- 为数据库表添加索引以优化查询性能

USE smart_agriculture;

-- 为 sensor_data 表添加复合索引，加速按传感器ID和时间范围的查询
ALTER TABLE sensor_data ADD INDEX idx_sensor_id_timestamp (sensor_id, timestamp);

-- 为 sensors 表添加索引，加速按传感器类型的查询
ALTER TABLE sensors ADD INDEX idx_type_id (type_id);

-- 为 sensor_types 表添加索引，加速按类型名称的查询
ALTER TABLE sensor_types ADD INDEX idx_type (type);

-- 为 actuators 表添加索引，加速按执行器类型的查询
ALTER TABLE actuators ADD INDEX idx_type_id (type_id);

-- 为 actuator_types 表添加索引，加速按类型名称的查询
ALTER TABLE actuator_types ADD INDEX idx_type (type);

-- 为 device_status_history 表添加复合索引，加速按传感器ID和时间的查询
ALTER TABLE device_status_history ADD INDEX idx_sensor_id_timestamp (sensor_id, timestamp);

-- 查看所有表的索引
SHOW INDEX FROM sensor_data;
SHOW INDEX FROM sensors;
SHOW INDEX FROM sensor_types;
SHOW INDEX FROM actuators;
SHOW INDEX FROM actuator_types;
SHOW INDEX FROM device_status_history;
