const { spawn } = require('child_process');

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
  process.exit(code);
});