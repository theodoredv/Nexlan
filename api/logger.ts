import fs from 'fs';
import path from 'path';
import { logsDir, ensureDir } from './config.js';

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

ensureDir(logsDir);

const MAX_LOG_DAYS = 7;

function cleanOldLogs(): void {
  try {
    const files = fs.readdirSync(logsDir);
    const now = Date.now();
    for (const file of files) {
      const match = file.match(/^nexlan-(\d{4}-\d{2}-\d{2})\.log$/);
      if (!match) continue;
      const fileDate = new Date(match[1]).getTime();
      if (now - fileDate > MAX_LOG_DAYS * 24 * 60 * 60 * 1000) {
        fs.unlinkSync(path.join(logsDir, file));
      }
    }
  } catch {
    // cleanup failure should not affect startup
  }
}

cleanOldLogs();

function getLogFilePath(): string {
  const date = new Date().toISOString().split('T')[0];
  return path.join(logsDir, `nexlan-${date}.log`);
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function writeToFile(formatted: string): void {
  try {
    const line = formatted.replace(/\x1b\[\d+m/g, '') + '\n';
    fs.appendFile(getLogFilePath(), line, (err) => {
      if (err) {
        process.stderr.write(`[logger] Failed to write log file: ${err.message}\n`);
      }
    });
  } catch {
    // file write failure should not affect main flow
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
