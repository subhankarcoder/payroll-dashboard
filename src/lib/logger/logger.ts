export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  readonly requestId?: string;
  readonly route?: string;
  readonly userId?: string;
  readonly operation?: string;
  readonly durationMs?: number;
  readonly [key: string]: unknown;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'apikey',
  'access_token',
  'refresh_token',
  'creditcard',
]);

function sanitizeLogContext(context?: LogContext): Record<string, unknown> | undefined {
  if (!context) return undefined;

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeLogContext(value as LogContext);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private readonly defaultContext: LogContext;
  private readonly minLevel: LogLevel;

  constructor(defaultContext: LogContext = {}, minLevel: LogLevel = 'info') {
    this.defaultContext = defaultContext;
    this.minLevel = minLevel;
  }

  // fallow-ignore-next-line unused-class-member
  public withContext(context: LogContext): Logger {
    return new Logger({ ...this.defaultContext, ...context }, this.minLevel);
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  private emit(level: LogLevel, message: string, context?: LogContext, error?: unknown): void {
    if (!this.shouldLog(level)) return;

    const mergedContext = sanitizeLogContext({
      ...this.defaultContext,
      ...context,
      ...(error instanceof Error
        ? {
            errorName: error.name,
            errorMessage: error.message,
            errorStack: error.stack,
          }
        : error
          ? { error: String(error) }
          : {}),
    });

    const payload = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(mergedContext && Object.keys(mergedContext).length > 0 ? { context: mergedContext } : {}),
    };

    const formatted = JSON.stringify(payload);

    if (level === 'error') {
      console.error(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else {
      // Use process.stdout.write or console.warn fallback in non-node envs
      if (typeof process !== 'undefined' && process.stdout && process.stdout.write) {
        process.stdout.write(formatted + '\n');
      } else {
        console.warn(formatted);
      }
    }
  }

  // fallow-ignore-next-line unused-class-member
  public debug(message: string, context?: LogContext): void {
    this.emit('debug', message, context);
  }

  public info(message: string, context?: LogContext): void {
    this.emit('info', message, context);
  }

  public warn(message: string, context?: LogContext): void {
    this.emit('warn', message, context);
  }

  public error(message: string, error?: unknown, context?: LogContext): void {
    this.emit('error', message, context, error);
  }
}

export const logger = new Logger();
