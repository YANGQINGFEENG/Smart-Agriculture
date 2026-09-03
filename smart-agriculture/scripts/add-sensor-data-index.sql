-- sensor_data 补充复合索引：修复 ai/diagnosis 相关子查询全表扫描导致 MySQL CPU 175% 的问题
-- 建议执行方式：云端 mysql CLI 直接执行（在线 DDL，ALGORITHM=INPLACE）
USE smart_agriculture;

ALTER TABLE sensor_data
  ADD INDEX idx_sensor_time (sensor_id, timestamp),
  ALGORITHM=INPLACE, LOCK=NONE;
