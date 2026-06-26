-- 农场/基地表
CREATE TABLE IF NOT EXISTS farms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    address TEXT,
    latitude REAL,
    longitude REAL,
    area REAL,
    farm_type TEXT DEFAULT 'mixed',
    owner_id INTEGER,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 区域表
CREATE TABLE IF NOT EXISTS zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farm_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    zone_type TEXT DEFAULT 'greenhouse',
    area REAL,
    description TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
    UNIQUE(farm_id, code)
);

-- 监控点表
CREATE TABLE IF NOT EXISTS monitor_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    point_type TEXT DEFAULT 'air_point',
    position_x REAL,
    position_y REAL,
    description TEXT,
    FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE,
    UNIQUE(zone_id, code)
);

-- 设备分组表
CREATE TABLE IF NOT EXISTS device_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farm_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    group_type TEXT DEFAULT 'mixed',
    description TEXT,
    FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
);

-- 作物批次表
CREATE TABLE IF NOT EXISTS crop_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farm_id INTEGER NOT NULL,
    zone_id INTEGER NOT NULL,
    crop_type TEXT NOT NULL,
    variety TEXT,
    batch_code TEXT UNIQUE NOT NULL,
    planting_date DATE,
    expected_harvest_date DATE,
    actual_harvest_date DATE,
    area REAL,
    status TEXT DEFAULT 'growing' CHECK (status IN ('planted', 'growing', 'harvested', 'failed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
    FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE
);

-- 用户权限表
CREATE TABLE IF NOT EXISTS user_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    farm_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'worker' CHECK (role IN ('owner', 'admin', 'technician', 'worker')),
    permissions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
    UNIQUE(user_id, farm_id)
);

-- 设备模板表
CREATE TABLE IF NOT EXISTS device_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    device_type TEXT NOT NULL CHECK (device_type IN ('sensor', 'actuator')),
    device_model TEXT,
    default_config TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 控制策略表
CREATE TABLE IF NOT EXISTS control_strategies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    strategy_type TEXT,
    config TEXT NOT NULL,
    is_template INTEGER DEFAULT 0,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_zones_farm ON zones(farm_id);
CREATE INDEX IF NOT EXISTS idx_monitor_points_zone ON monitor_points(zone_id);
CREATE INDEX IF NOT EXISTS idx_device_groups_farm ON device_groups(farm_id);
CREATE INDEX IF NOT EXISTS idx_crop_batches_farm ON crop_batches(farm_id);
CREATE INDEX IF NOT EXISTS idx_crop_batches_zone ON crop_batches(zone_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_farm ON user_permissions(farm_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);

-- 初始设备模板数据
INSERT OR IGNORE INTO device_templates (name, device_type, device_model, default_config, description) VALUES
('温度传感器', 'sensor', 'DHT11', '{"unit":"°C","range":[-20,60],"accuracy":0.5}', '基础温湿度传感器'),
('湿度传感器', 'sensor', 'DHT11', '{"unit":"%","range":[0,100],"accuracy":2}', '基础温湿度传感器'),
('光照传感器', 'sensor', 'BH1750', '{"unit":"Lux","range":[0,65535],"accuracy":1}', '数字光照传感器'),
('土壤湿度传感器', 'sensor', 'Capacitive', '{"unit":"%","range":[0,100],"accuracy":3}', '电容式土壤湿度传感器'),
('水泵', 'actuator', 'Relay', '{"power":"12V","type":"irrigation"', '继电器控制水泵'),
('风扇', 'actuator', 'Relay', '{"power":"12V","type":"ventilation"', '继电器控制风扇'),
('补光灯', 'actuator', 'Relay', '{"power":"12V","type":"lighting"', '继电器控制补光灯');
