export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

class Logger {
  private sanitize(message: string): string {
    // Redact potential API keys or tokens
    return message
      .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]')
      .replace(/(bearer\s+)[A-Za-z0-9\-_.]+/gi, '$1[REDACTED_TOKEN]');
  }

  private format(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    let metaStr = '';
    if (meta) {
      try {
        const sanitizedMeta = JSON.parse(JSON.stringify(meta));
        // Remove known secret keys from meta
        if (typeof sanitizedMeta === 'object' && sanitizedMeta !== null) {
          for (const key of Object.keys(sanitizedMeta)) {
            if (/key|secret|token|password|auth/i.test(key)) {
              sanitizedMeta[key] = '[REDACTED]';
            }
          }
        }
        metaStr = ` | ${JSON.stringify(sanitizedMeta)}`;
      } catch {
        metaStr = ' | [Unserializable Meta]';
      }
    }
    return `[${timestamp}] [${level}] ${this.sanitize(message)}${metaStr}`;
  }

  debug(message: string, meta?: any): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.format(LogLevel.DEBUG, message, meta));
    }
  }

  info(message: string, meta?: any): void {
    console.info(this.format(LogLevel.INFO, message, meta));
  }

  warn(message: string, meta?: any): void {
    console.warn(this.format(LogLevel.WARN, message, meta));
  }

  error(message: string, error?: any): void {
    const meta = error instanceof Error ? { message: error.message, stack: error.stack } : error;
    console.error(this.format(LogLevel.ERROR, message, meta));
  }
}

export const logger = new Logger();
