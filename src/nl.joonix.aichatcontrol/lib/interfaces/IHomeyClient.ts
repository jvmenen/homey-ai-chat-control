/**
 * IHomeyClient - Abstraction over Homey instance
 *
 * Purpose: Decouple from concrete Homey implementation for testability
 * Used by: Managers and Services
 */

export interface IHomeyClient {
  /**
   * Log messages to Homey console
   */
  log(...args: unknown[]): void;

  /**
   * Log errors to Homey console
   */
  error(...args: unknown[]): void;

  /**
   * Access to Homey flow system
   */
  flow: {
    /**
     * Get a flow trigger card by ID
     * @param id - The trigger card ID
     */
    getTriggerCard(id: string): unknown;
  };
}
