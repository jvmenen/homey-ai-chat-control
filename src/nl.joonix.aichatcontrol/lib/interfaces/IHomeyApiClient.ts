/**
 * IHomeyApiClient - Abstraction over HomeyAPI connection
 *
 * Purpose: Decouple from concrete HomeyAPI implementation for testability
 * Used by: FlowManager, ZoneDeviceManager, and their services
 */

export interface IHomeyApiClient {
  /**
   * Flow API methods
   */
  flow: {
    /**
     * Get all regular flows
     */
    getFlows(): Promise<Record<string, unknown>>;

    /**
     * Get all advanced flows
     */
    getAdvancedFlows(): Promise<Record<string, unknown>>;
  };

  /**
   * Device API methods
   */
  devices: {
    /**
     * Get all devices
     */
    getDevices(): Promise<Record<string, unknown>>;

    /**
     * Get a specific device by ID
     */
    getDevice(opts: { id: string }): Promise<unknown>;
  };

  /**
   * Zone API methods
   */
  zones: {
    /**
     * Get all zones
     */
    getZones(): Promise<Record<string, unknown>>;

    /**
     * Get a specific zone by ID
     */
    getZone(opts: { id: string }): Promise<unknown>;
  };
}
