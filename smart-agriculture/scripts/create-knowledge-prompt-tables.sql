-- 知识库表
CREATE TABLE IF NOT EXISTS knowledge_base (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    tags VARCHAR(500),
    source VARCHAR(255),
    status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    vector_index INT,
    INDEX idx_category (category),
    INDEX idx_status (status)
);

-- 提示词模板表
CREATE TABLE IF NOT EXISTS prompt_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    description VARCHAR(500),
    variables JSON,
    version INT DEFAULT 1,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_type (type),
    INDEX idx_status (status)
);

-- 模板变量表
CREATE TABLE IF NOT EXISTS template_variables (
    id INT PRIMARY KEY AUTO_INCREMENT,
    template_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    label VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL,
    default_value TEXT,
    required BOOLEAN DEFAULT true,
    FOREIGN KEY (template_id) REFERENCES prompt_templates(id) ON DELETE CASCADE,
    INDEX idx_template_id (template_id)
);

-- 初始提示词模板数据
INSERT INTO prompt_templates (name, type, content, description, variables, status) VALUES
('农业AI助手-通用', 'chat', '你是一个专业的智慧农业AI助手。你的职责是帮助用户解答农业相关问题，包括但不限于：作物种植、病虫害防治、土壤管理、环境监控、灌溉管理等。\n\n请基于以下知识库信息回答用户问题：\n{knowledge_context}\n\n用户问题：{user_query}', '通用农业AI助手提示词模板', '[{"name":"knowledge_context","label":"知识库上下文","type":"string","required":true},{"name":"user_query","label":"用户问题","type":"string","required":true}]', 'active'),
('农业AI助手-诊断', 'diagnosis', '你是一个专业的农业病虫害诊断专家。请根据以下信息进行分析诊断：\n\n传感器数据：{sensor_data}\n图像检测结果：{detection_results}\n知识库参考：{knowledge_context}\n\n请提供：\n1. 问题诊断结果\n2. 可能的原因分析\n3. 建议的处理措施', '农业病虫害诊断提示词模板', '[{"name":"sensor_data","label":"传感器数据","type":"string","required":true},{"name":"detection_results","label":"检测结果","type":"string","required":false},{"name":"knowledge_context","label":"知识库上下文","type":"string","required":true}]', 'active')
ON DUPLICATE KEY UPDATE name = VALUES(name);
