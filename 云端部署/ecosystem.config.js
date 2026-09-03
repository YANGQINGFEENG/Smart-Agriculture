/**
 * 天工慧眼 - PM2 进程配置
 * 云端实际项目路径：/opt/Smart-Agriculture/smart-agriculture
 * 部署时复制到该目录使用：
 *   cp /opt/ecosystem.config.js /opt/Smart-Agriculture/smart-agriculture/
 *   cd /opt/Smart-Agriculture/smart-agriculture && pm2 start ecosystem.config.js
 */
const APP_DIR = '/opt/Smart-Agriculture/smart-agriculture';
module.exports = {
  apps: [
    {
      // Next.js 主应用（网页 + API，端口 3000）
      name: 'smart-agri-web',
      cwd: APP_DIR,
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      env: {
        NODE_ENV: 'production',
        NEXT_TELEMETRY_DISABLED: '1',
      },
      max_memory_restart: '1G',
      instances: 1,
      autorestart: true,
      out_file: '/var/log/pm2/smart-agri-web-out.log',
      error_file: '/var/log/pm2/smart-agri-web-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // 环境变量从项目根目录 .env.local 由 Next.js 自行加载
    },
    {
      // 独立 WebSocket 服务器（设备通信 8080 + 命令中继 HTTP 8081）
      name: 'smart-agri-ws',
      cwd: APP_DIR,
      script: 'websocket-server.js',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '500M',
      instances: 1,
      autorestart: true,
      out_file: '/var/log/pm2/smart-agri-ws-out.log',
      error_file: '/var/log/pm2/smart-agri-ws-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
