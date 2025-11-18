// src/utils/logger.ts
export class Logger {
  private static formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? JSON.stringify(meta) : '';
    return `[${timestamp}] [${level}] ${message} ${metaStr}`;
  }

  static info(message: string, meta?: any) {
    console.log(this.formatMessage('INFO', message, meta));
  }

  static error(message: string, error?: Error | any) {
    console.error(
      this.formatMessage('ERROR', message, {
        error: error?.message,
        stack: error?.stack,
      })
    );
  }

  static warn(message: string, meta?: any) {
    console.warn(this.formatMessage('WARN', message, meta));
  }

  static debug(message: string, meta?: any) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('DEBUG', message, meta));
    }
  }
}