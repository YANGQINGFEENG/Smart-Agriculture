-- 知识库表 (SQLite)
CREATE TABLE IF NOT EXISTS knowledge_base (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    tags TEXT,
    source TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    vector_index INTEGER
);

CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_status ON knowledge_base(status);

-- 提示词模板表 (SQLite)
CREATE TABLE IF NOT EXISTS prompt_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    description TEXT,
    variables TEXT,
    version INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prompt_type ON prompt_templates(type);
CREATE INDEX IF NOT EXISTS idx_prompt_status ON prompt_templates(status);

-- 模板变量表 (SQLite)
CREATE TABLE IF NOT EXISTS template_variables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    label TEXT NOT NULL,
    type TEXT NOT NULL,
    default_value TEXT,
    required INTEGER DEFAULT 1,
    FOREIGN KEY (template_id) REFERENCES prompt_templates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_template_var_id ON template_variables(template_id);

-- 初始提示词模板数据
INSERT OR IGNORE INTO prompt_templates (name, type, content, description, variables, status) VALUES
('农业AI助手-通用', 'chat', '你是一个专业的智慧农业AI助手。你的职责是帮助用户解答农业相关问题，包括但不限于：作物种植、病虫害防治、土壤管理、环境监控、灌溉管理等。

请基于以下知识库信息回答用户问题：
{knowledge_context}

用户问题：{user_query}', '通用农业AI助手提示词模板', '[{"name":"knowledge_context","label":"知识库上下文","type":"string","required":true},{"name":"user_query","label":"用户问题","type":"string","required":true}]', 'active'),
('农业AI助手-诊断', 'diagnosis', '你是一个专业的农业病虫害诊断专家。请根据以下信息进行分析诊断：

传感器数据：{sensor_data}
图像检测结果：{detection_results}
知识库参考：{knowledge_context}

请提供：
1. 问题诊断结果
2. 可能的原因分析
3. 建议的处理措施', '农业病虫害诊断提示词模板', '[{"name":"sensor_data","label":"传感器数据","type":"string","required":true},{"name":"detection_results","label":"检测结果","type":"string","required":false},{"name":"knowledge_context","label":"知识库上下文","type":"string","required":true}]', 'active');
