-- 智慧农业物联网监控平台数据库结构

-- 创建数据库
CREATE DATABASE IF NOT EXISTS smart_agriculture;

USE smart_agriculture;

-- 传感器类型表
CREATE TABLE IF NOT EXISTS sensor_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    type VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 传感器设备表
CREATE TABLE IF NOT EXISTS sensors (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type_id INT NOT NULL,
    location VARCHAR(255) NOT NULL,
    status ENUM('online', 'offline') DEFAULT 'offline',
    battery INT DEFAULT 100,
    last_update TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (type_id) REFERENCES sensor_types(id)
);

-- 传感器数据表
CREATE TABLE IF NOT EXISTS sensor_data (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sensor_id VARCHAR(20) NOT NULL,
    value DECIMAL(10, 2) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sensor_id) REFERENCES sensors(id)
);

-- 设备状态历史表
CREATE TABLE IF NOT EXISTS device_status_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sensor_id VARCHAR(20) NOT NULL,
    status ENUM('online', 'offline') NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sensor_id) REFERENCES sensors(id)
);

-- 执行器类型表
CREATE TABLE IF NOT EXISTS actuator_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    type VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 执行器设备表
CREATE TABLE IF NOT EXISTS actuators (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type_id INT NOT NULL,
    location VARCHAR(255) NOT NULL,
    status ENUM('online', 'offline') DEFAULT 'offline',
    state ENUM('on', 'off') DEFAULT 'off',
    mode ENUM('auto', 'manual') DEFAULT 'auto',
    last_update TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (type_id) REFERENCES actuator_types(id),
    INDEX idx_status (status),
    INDEX idx_state (state),
    INDEX idx_mode (mode)
);

-- 执行器状态历史表
CREATE TABLE IF NOT EXISTS actuator_status_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    actuator_id VARCHAR(20) NOT NULL,
    state ENUM('on', 'off') NOT NULL,
    mode ENUM('auto', 'manual') NOT NULL,
    trigger_source VARCHAR(50),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actuator_id) REFERENCES actuators(id),
    INDEX idx_actuator_id (actuator_id),
    INDEX idx_timestamp (timestamp)
);

-- 初始数据
-- 插入传感器类型（共7种）
INSERT INTO sensor_types (type, name, unit) VALUES
('temperature', '温度传感器', '°C'),
('humidity', '空气湿度传感器', '%'),
('light', '光照传感器', 'Lux'),
('soil', '土壤湿度传感器', '%'),
('soil_temperature', '土壤温度传感器', '°C'),
('ec', '土壤电导率传感器', 'μS/cm'),
('ph', '土壤pH值传感器', 'pH')
ON DUPLICATE KEY UPDATE name = VALUES(name), unit = VALUES(unit);

-- 插入传感器设备（共12个）
INSERT INTO sensors (id, name, type_id, location, status, battery, last_update) VALUES
-- 空气温度传感器
('T-001', 'A区温室1号温度传感器', 1, 'A区温室', 'online', 95, CURRENT_TIMESTAMP),
('T-003', 'B区温室1号温度传感器', 1, 'B区温室', 'online', 88, CURRENT_TIMESTAMP),
-- 空气湿度传感器
('H-001', 'A区温室1号湿度传感器', 2, 'A区温室', 'online', 90, CURRENT_TIMESTAMP),
('H-002', 'B区温室1号湿度传感器', 2, 'B区温室', 'online', 85, CURRENT_TIMESTAMP),
-- 光照传感器
('L-001', 'A区温室1号光照传感器', 3, 'A区温室', 'online', 93, CURRENT_TIMESTAMP),
('L-002', 'B区温室1号光照传感器', 3, 'B区温室', 'online', 89, CURRENT_TIMESTAMP),
-- 土壤湿度传感器
('S-001', 'A区温室1号土壤湿度传感器', 4, 'A区温室', 'online', 91, CURRENT_TIMESTAMP),
('S-002', 'B区温室1号土壤湿度传感器', 4, 'B区温室', 'online', 87, CURRENT_TIMESTAMP),
('S-003', 'C区大棚1号土壤湿度传感器', 4, 'C区大棚', 'online', 84, CURRENT_TIMESTAMP),
-- 土壤温度传感器
('T-002', 'A区温室1号土壤温度传感器', 5, 'A区温室', 'online', 92, CURRENT_TIMESTAMP),
-- 土壤电导率传感器
('E-001', 'A区温室1号土壤EC传感器', 6, 'A区温室', 'online', 90, CURRENT_TIMESTAMP),
-- 土壤pH传感器
('P-001', 'A区温室1号土壤pH传感器', 7, 'A区温室', 'online', 88, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE name = VALUES(name), type_id = VALUES(type_id), location = VALUES(location), status = VALUES(status), battery = VALUES(battery), last_update = VALUES(last_update);

-- 插入执行器类型（共5种）
INSERT INTO actuator_types (type, name, description) VALUES
('water_pump', '水泵', '用于灌溉和排水控制'),
('fan', '风扇', '用于通风和温度调节'),
('heater', '加热器', '用于温度控制'),
('valve', '电磁阀', '用于水流控制'),
('light', '补光灯', '用于光照调节')
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description);

-- 插入执行器设备（共7个）
INSERT INTO actuators (id, name, type_id, location, status, state, mode, last_update) VALUES
('WP-001', 'A区温室1号水泵', 1, 'A区温室', 'online', 'off', 'auto', CURRENT_TIMESTAMP),
('WP-002', 'B区温室1号水泵', 1, 'B区温室', 'online', 'off', 'auto', CURRENT_TIMESTAMP),
('FN-001', 'A区温室1号风扇', 2, 'A区温室', 'online', 'off', 'auto', CURRENT_TIMESTAMP),
('FN-002', 'B区温室1号风扇', 2, 'B区温室', 'online', 'off', 'auto', CURRENT_TIMESTAMP),
('HT-001', 'A区温室1号加热器', 3, 'A区温室', 'offline', 'off', 'manual', CURRENT_TIMESTAMP),
('VL-001', 'A区温室1号电磁阀', 4, 'A区温室', 'online', 'off', 'auto', CURRENT_TIMESTAMP),
('LT-001', 'A区温室1号补光灯', 5, 'A区温室', 'online', 'off', 'auto', CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE 
    name = VALUES(name), 
    type_id = VALUES(type_id), 
    location = VALUES(location), 
    status = VALUES(status), 
    state = VALUES(state), 
    mode = VALUES(mode), 
    last_update = VALUES(last_update);

-- 生成模拟数据（最近24小时，每小时一条）
DELIMITER //
CREATE PROCEDURE generate_mock_data()
BEGIN
    DECLARE i INT DEFAULT 0;
    
    -- 为每个传感器生成24小时的数据
    WHILE i < 24 DO
        -- 空气温度传感器数据（18-30°C）
        INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES
        ('T-001', 18 + RAND() * 12, CURRENT_TIMESTAMP - INTERVAL i HOUR),
        ('T-003', 18 + RAND() * 12, CURRENT_TIMESTAMP - INTERVAL i HOUR);
        
        -- 空气湿度传感器数据（50-80%）
        INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES
        ('H-001', 50 + RAND() * 30, CURRENT_TIMESTAMP - INTERVAL i HOUR),
        ('H-002', 50 + RAND() * 30, CURRENT_TIMESTAMP - INTERVAL i HOUR);
        
        -- 光照传感器数据（5000-15000 Lux）
        INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES
        ('L-001', 5000 + RAND() * 10000, CURRENT_TIMESTAMP - INTERVAL i HOUR),
        ('L-002', 5000 + RAND() * 10000, CURRENT_TIMESTAMP - INTERVAL i HOUR);
        
        -- 土壤湿度传感器数据（30-60%）
        INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES
        ('S-001', 30 + RAND() * 30, CURRENT_TIMESTAMP - INTERVAL i HOUR),
        ('S-002', 30 + RAND() * 30, CURRENT_TIMESTAMP - INTERVAL i HOUR),
        ('S-003', 30 + RAND() * 30, CURRENT_TIMESTAMP - INTERVAL i HOUR);
        
        -- 土壤温度传感器数据（15-28°C）
        INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES
        ('T-002', 15 + RAND() * 13, CURRENT_TIMESTAMP - INTERVAL i HOUR);
        
        -- 土壤电导率传感器数据（200-1000 μS/cm）
        INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES
        ('E-001', 200 + RAND() * 800, CURRENT_TIMESTAMP - INTERVAL i HOUR);
        
        -- 土壤pH传感器数据（5.5-7.5）
        INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES
        ('P-001', 5.5 + RAND() * 2, CURRENT_TIMESTAMP - INTERVAL i HOUR);
        
        SET i = i + 1;
    END WHILE;
END //
DELIMITER ;

-- 执行存储过程生成模拟数据
CALL generate_mock_data();

-- 删除存储过程
DROP PROCEDURE IF EXISTS generate_mock_data;
