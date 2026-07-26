-- 更新执行器控制指令表
-- 添加对数值控制的支持

-- 修改 command 字段，支持 'value' 命令
ALTER TABLE actuator_commands 
MODIFY COLUMN command ENUM('on', 'off', 'value') NOT NULL;

-- 添加 control_value 字段，用于存储数值控制的值
ALTER TABLE actuator_commands 
ADD COLUMN control_value DECIMAL(10, 2) NULL;

-- 添加 status 字段的 'executing' 和 'timeout' 选项
ALTER TABLE actuator_commands 
MODIFY COLUMN status ENUM('pending', 'executing', 'executed', 'failed', 'timeout') DEFAULT 'pending';
