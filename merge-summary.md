此次合并主要涉及前端界面优化和嵌入式系统文件更新，包括移除移动端导航按钮、调整布局间距、简化组件样式，以及添加多个嵌入式系统相关文件。
| 文件 | 变更 |
|------|---------|
| smart-agriculture/app/page.tsx | - 移除移动端导航按钮和Sheet组件<br>- 调整侧边栏显示逻辑，默认显示<br>- 优化主内容区域间距，统一为p-6<br>- 调整页脚布局，移除多余的px-4间距 |
| smart-agriculture/components/dashboard/sidebar-nav.tsx | - 移除ARIA属性和无障碍标签<br>- 简化CSS过渡效果，使用transition-colors<br>- 调整导航项和链接的样式和间距 |
| smart-agriculture/components/dashboard/header.tsx | - 调整布局间距，统一为px-6和gap-4<br>- 修改时间选择器占位符为"时间范围"<br>- 优化管理员头像和名称显示，增加间距 |
| smart-agriculture/components/dashboard/overview-cards.tsx | - 调整卡片网格布局，优化响应式设计<br>- 调整网格间距为gap-4 |
| 智能盒/温湿度App/App/Inc/system.h | - 新增系统头文件，定义系统相关常量和函数 |
| 智能盒/温湿度App/App/Src/main.c | - 新增主程序文件，实现系统初始化和主循环 |
| 智能盒/温湿度App/App/Src/main_optimized.c | - 新增优化版主程序文件，改进系统性能 |
| 智能盒/温湿度App/App/Src/system.c | - 新增系统功能实现文件，提供系统级操作 |
| 智能盒/温湿度App/BSP/Inc/uart.h | - 新增UART通信头文件，定义串口通信接口 |
| 智能盒/温湿度App/BSP/Src/uart.c | - 新增UART通信实现文件，提供串口通信功能 |
| 智能盒/温湿度App/Config/sys_config.h | - 新增系统配置文件，定义系统参数 |
| 智能盒/温湿度App/Middlewares/Protocol/protocol.c | - 新增协议实现文件，处理通信协议 |
| 智能盒/温湿度App/Middlewares/Protocol/protocol.h | - 新增协议头文件，定义协议结构和接口 |
| 智能盒/温湿度App/Middlewares/WiFi/wifi_manager.c | - 新增WiFi管理实现文件，提供网络连接功能 |
| 智能盒/温湿度App/Middlewares/WiFi/wifi_manager.h | - 新增WiFi管理头文件，定义WiFi相关接口 |
| 智能盒/温湿度App/Project.uvprojx | - 新增Keil项目文件，配置项目环境 |
| 智能盒/温湿度App/User/main.c.backup | - 新增主程序备份文件 |
| 智能盒/温湿度App/User/stm32f10x_it.c | - 新增中断处理文件，处理系统中断 |
| 智能盒/温湿度App/温湿度App系统设计文档.md | - 新增系统设计文档，描述系统架构和功能