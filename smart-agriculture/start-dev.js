const { spawn } = require('child_process');

// 启动独立WebSocket服务器
const wsServer = spawn('node', ['websocket-server.js'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true
});

// WebSocket服务器输出处理
wsServer.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write('[WS] ' + output);
});

wsServer.stderr.on('data', (data) => {
  const output = data.toString();
  process.stderr.write('[WS] ' + output);
});

wsServer.on('close', (code) => {
  console.log(`[WS] WebSocket服务器已关闭，退出码: ${code}`);
});

// 启动Next.js开发服务器
const nextDev = spawn('npx', ['next', 'dev'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true
});

// 过滤输出，排除GET /api请求的日志
nextDev.stdout.on('data', (data) => {
  const output = data.toString();
  if (!output.includes('GET /api')) {
    process.stdout.write(output);
  }
});

nextDev.stderr.on('data', (data) => {
  const output = data.toString();
  if (!output.includes('GET /api')) {
    process.stderr.write(output);
  }
});

nextDev.on('close', (code) => {
  console.log(`Next.js开发服务器已关闭，退出码: ${code}`);
  // 关闭WebSocket服务器
  wsServer.kill();
  process.exit(code);
});

// 处理进程退出
process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  nextDev.kill();
  wsServer.kill();
  process.exit(0);
});
