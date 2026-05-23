import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};

const RESET = '\x1b[0m';

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function getLogFilePath(): string {
  const date = new Date().toISOString().split('T')[0];
  return path.join(logsDir, `nexlan-${date}.log`);
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function writeToFile(formatted: string): void {
  try {
    const line = formatted.replace(/\x1b\[\d+m/g, '') + '\n'; // eslint-disable-line no-control-regex
    fs.appendFile(getLogFilePath(), line, (err) => {
      if (err) {
        process.stderr.write(`[logger] Failed to write log file: ${err.message}\n`);
      }
    });
  } catch {
    // 文件写入失败不影响主流程
  }
}

function log(level: LogLevel, module: string, message: string, ...args: unknown[]): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[currentLevel]) return;

  const timestamp = formatTimestamp();
  const color = LEVEL_COLORS[level];
  const levelStr = level.toUpperCase().padEnd(5);
  const moduleStr = module ? `[${module}]` : '';

  const prefix = `${color}${timestamp} ${levelStr}${RESET} ${moduleStr}`;
  const formatted = `${timestamp} ${levelStr} ${moduleStr} ${message}`;

  if (level === 'error') {
    console.error(prefix, message, ...args);
  } else if (level === 'warn') {
    console.warn(prefix, message, ...args);
  } else {
    console.log(prefix, message, ...args);
  }

  writeToFile(formatted);
}

export function createLogger(module: string) {
  return {
    debug: (message: string, ...args: unknown[]) => log('debug', module, message, ...args),
    info: (message: string, ...args: unknown[]) => log('info', module, message, ...args),
    warn: (message: string, ...args: unknown[]) => log('warn', module, message, ...args),
    error: (message: string, ...args: unknown[]) => log('error', module, message, ...args),
  };
}

export const logger = {
  debug: (message: string, ...args: unknown[]) => log('debug', '', message, ...args),
  info: (message: string, ...args: unknown[]) => log('info', '', message, ...args),
  warn: (message: string, ...args: unknown[]) => log('warn', '', message, ...args),
  error: (message: string, ...args: unknown[]) => log('error', '', message, ...args),
};
