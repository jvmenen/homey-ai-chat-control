/**
 * MockHomeyClient - Mock implementation for testing
 */

import { IHomeyClient } from '../IHomeyClient';

export class MockHomeyClient implements IHomeyClient {
  public logs: unknown[][] = [];
  public errors: unknown[][] = [];

  log(...args: unknown[]): void {
    this.logs.push(args);
    // eslint-disable-next-line no-console -- test mock intentionally mirrors output to the console
    console.log('[MockHomey]', ...args);
  }

  error(...args: unknown[]): void {
    this.errors.push(args);
    // eslint-disable-next-line no-console -- test mock intentionally mirrors output to the console
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
