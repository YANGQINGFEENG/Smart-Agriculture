-- 添加传感器阈值表

USE smart_agriculture;

-- 创建传感器阈值表
CREATE TABLE IF NOT EXISTS sensor_thresholds (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sensor_id VARCHAR(20) NOT NULL,
    min_value DECIMAL(10, 2) NULL,
    max_value DECIMAL(10, 2) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sensor_id) REFERENCES sensors(id),
    UNIQUE KEY unique_sensor (sensor_id)
);

-- 为现有传感器添加默认阈值
INSERT INTO sensor_thresholds (sensor_id, min_value, max_value) VALUES
-- 温度传感器 (18-30°C)
('T-001', 18.0, 30.0),
('T-003', 18.0, 30.0),
('T-002', 15.0, 28.0),
-- 湿度传感器 (50-80%)
('H-001', 50.0, 80.0),
('H-002', 50.0, 80.0),
-- 光照传感器 (5000-15000 Lux)
('L-001', 5000.0, 15000.0),
('L-002', 5000.0, 15000.0),
-- 土壤湿度传感器 (30-60%)
('S-001', 30.0, 60.0),
('S-002', 30.0, 60.0),
('S-003', 30.0, 60.0),
-- 土壤电导率传感器 (200-1000 μS/cm)
('E-001', 200.0, 1000.0),
-- 土壤pH传感器 (5.5-7.5)
('P-001', 5.5, 7.5)
ON DUPLICATE KEY UPDATE 
    min_value = VALUES(min_value),
    max_value = VALUES(max_value);

-- 查看阈值表数据
SELECT * FROM sensor_thresholds;
