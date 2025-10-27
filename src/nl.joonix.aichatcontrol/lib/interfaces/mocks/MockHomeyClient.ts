/**
 * MockHomeyClient - Mock implementation for testing
 */

import { IHomeyClient } from '../IHomeyClient';

export class MockHomeyClient implements IHomeyClient {
  public logs: unknown[][] = [];
  public errors: unknown[][] = [];

  log(...args: unknown[]): void {
    this.logs.push(args);
    console.log('[MockHomey]', ...args);
  }

  error(...args: unknown[]): void {
    this.errors.push(args);
    console.error('[MockHomey ERROR]', ...args);
  }

  flow = {
    getTriggerCard: (id: string) => {
      return {
        id,
        trigger: async () => {
          this.log(`Triggered flow card: ${id}`);
        },
      };
    },
  };

  /**
   * Reset mock state (useful between tests)
   */
  reset(): void {
    this.logs = [];
    this.errors = [];
  }
}
