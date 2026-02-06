/**
 * Logger - Centralized logging utility with consistent [ClassName] prefix format
 *
 * Usage:
 *   const logger = new Logger(this.homey, 'MyClass');
 *   logger.log('Something happened');     // → [log] [HomeyMCPApp] [MyClass] Something happened
 *   logger.error('Failed:', error);       // → [log] [HomeyMCPApp] [MyClass] Failed: <error>
 */

import { HomeyInstance } from '../types';

export class Logger {
  private prefix: string;

  constructor(
    private homey: HomeyInstance,
    className: string
  ) {
    this.prefix = `[${className}]`;
  }

  log(...args: unknown[]): void {
    this.homey.log(this.prefix, ...args);
  }

  error(...args: unknown[]): void {
    this.homey.error(this.prefix, ...args);
  }
}
