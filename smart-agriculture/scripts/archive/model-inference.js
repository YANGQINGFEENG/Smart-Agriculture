const { spawn } = require('child_process');
const path = require('path');

/**
 * 运行模型推理
 * @param {string} imagePath - 图片路径
 * @returns {Promise<Array>} 检测结果
 */
async function runModelInference(imagePath) {
  return new Promise((resolve, reject) => {
    // 使用硬编码的绝对路径，确保找到正确的文件
    const inferenceScriptPath = 'e:\\tghy\\smart-agriculture\\models\\inference.py';
    
    console.log('运行模型推理:', {
      scriptPath: inferenceScriptPath,
      imagePath: imagePath
    });
    
    const pythonProcess = spawn('python', [
      inferenceScriptPath,
      imagePath
    ]);

    let output = '';
    let error = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          // 提取最后一行作为JSON
          const lines = output.trim().split('\n');
          const jsonLine = lines[lines.length - 1];
          const result = JSON.parse(jsonLine);
          resolve(result);
        } catch (e) {
          console.error('解析模型输出失败:', e);
          resolve([]);
        }
      } else {
        console.error(`Python脚本失败，代码: ${code}，错误: ${error}`);
        resolve([]);
      }
    });

    pythonProcess.on('error', (err) => {
      console.error('启动Python进程失败:', err);
      resolve([]);
    });
  });
}

module.exports = runModelInference;
