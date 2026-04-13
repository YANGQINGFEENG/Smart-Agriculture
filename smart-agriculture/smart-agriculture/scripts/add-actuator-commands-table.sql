-- 执行器控制指令表
-- 用于存储网页端发送给硬件端的控制指令

CREATE TABLE IF NOT EXISTS actuator_commands (
    id INT PRIMARY KEY AUTO_INCREMENT,
    actuator_id VARCHAR(20) NOT NULL,
    command ENUM('on', 'off') NOT NULL,
    status ENUM('pending', 'executed', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMP NULL,
    FOREIGN KEY (actuator_id) REFERENCES actuators(id),
    INDEX idx_actuator_id (actuator_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- 添加注释
ALTER TABLE actuator_commands 
COMMENT '执行器控制指令表 - 存储网页端发送给硬件端的控制指令';
