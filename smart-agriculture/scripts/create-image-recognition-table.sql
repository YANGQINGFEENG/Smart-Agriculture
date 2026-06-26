-- 创建图片识别历史记录表
CREATE TABLE IF NOT EXISTS image_recognition_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    image_url VARCHAR(255) NOT NULL,
    result VARCHAR(100) NOT NULL,
    confidence DECIMAL(5, 2) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_timestamp (timestamp)
);
