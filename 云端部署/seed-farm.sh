#!/bin/bash
mysql -u root -p'CloudMysql@2026' --default-character-set=utf8mb4 -e "
USE smart_agriculture;
INSERT INTO farms (name, description, location, status) VALUES
('1号智慧温室', '部署验证用示范基地：含温度/湿度/光照/海拔/气压/振动传感器，与现有传感器区域(温室1号/培育盆1号)对应', '温室1号', 'active');
SELECT id,name,location,status FROM farms;
" 2>&1 | grep -v "Using a password"
