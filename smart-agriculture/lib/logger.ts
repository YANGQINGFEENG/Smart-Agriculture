/**
 * 零依赖统一日志模块
 * 格式: [YYYY-MM-DD HH:mm:ss.SSS] [LEVEL] [moduleName] message
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_LABEL: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
};

function getConfiguredLevel(): LogLevel {
  const envLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
  if (envLevel in LEVEL_PRIORITY) return envLevel as LogLevel;
  return 'info';
}

function formatTimestamp(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const MM = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const HH = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const SSS = String(now.getMilliseconds()).padStart(3, '0');
  return `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}.${SSS}`;
}

function formatArgs(args: unknown[]): string {
  return args.map(arg => {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return arg.stack || arg.message;
    try { return JSON.stringify(arg); } catch { return String(arg); }
  }).join(' ');
}

export function createLogger(moduleName: string) {
  const configLevel = getConfiguredLevel();
  const configPriority = LEVEL_PRIORITY[configLevel];

  function shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= configPriority;
  }

  function write(level: LogLevel, args: unknown[]): void {
    if (!shouldLog(level)) return;
    const timestamp = formatTimestamp();
    const label = LEVEL_LABEL[level];
    const message = formatArgs(args);
    const line = `[${timestamp}] [${label}] [${moduleName}] ${message}`;

    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  return {
    debug: (...args: unknown[]) => write('debug', args),
    info: (...args: unknown[]) => write('info', args),
    warn: (...args: unknown[]) => write('warn', args),
    error: (...args: unknown[]) => write('error', args),
  };
}
