/**
 * Homey API Manager - Centralized Homey API initialization and management
 *
 * This manager provides a single source of truth for the Homey API connection.
 * All other managers and tools should use this shared instance instead of
 * creating their own API connections.
 */

import { HomeyInstance } from '../types';
import { Logger } from '../utils/logger';

export class HomeyAPIManager {
  private homeyApi!: any; // HomeyAPI types don't export all properties
  private initialized = false;
  private isDestroying = false;
  private logger: Logger;

  constructor(private homey: HomeyInstance) {
    this.logger = new Logger(homey, 'HomeyAPIManager');
  }

  /**
   * Initialize the Homey API connection with all required scopes
   *
   * Scopes:
   * - homey.zone: Access to zones
   * - homey.device: Access to devices
   * - homey.flow: Access to flows
   * - homey.mood: Access to moods (light scenes)
   * - homey.app: Access to installed apps
   * - homey.logic: Access to logic variables
   */
  async init(): Promise<void> {
    if (this.initialized) {
      this.logger.log('Already initialized');
      return;
    }

    if (this.isDestroying) {
      throw new Error('Cannot initialize: manager is being destroyed');
    }

    try {
      this.logger.log('Initializing Homey API...');
      const { HomeyAPI } = require('homey-api');

      this.homeyApi = await HomeyAPI.createAppAPI({
        homey: this.homey,
        scopes: [
          'homey.zone',
          'homey.device',
          'homey.flow',
          'homey.mood',
          'homey.moods',
          'homey:manager:moods',
          'homey.app',
          'homey.logic',
          'homey.logic.readonly',
        ],
      });

      this.initialized = true;
      this.logger.log('Homey API initialized with scopes:', [
        'homey.zone',
        'homey.device',
        'homey.flow',
        'homey.mood',
        'homey.moods',
        'homey:manager:moods',
        'homey.app',
        'homey.logic',
        'homey.logic.readonly',
      ]);
    } catch (error) {
      this.logger.error('Failed to initialize Homey API:', error);
      throw error;
    }
  }

  /**
   * Get the Homey API instance
   * @throws Error if not initialized
   */
  getApi(): any {
    if (!this.initialized) {
      throw new Error('HomeyAPIManager not initialized - call init() first');
    }
    return this.homeyApi;
  }

  /**
   * Check if the manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Destroy the API connection and cleanup
   */
  async destroy(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.isDestroying = true;

    try {
      this.logger.log('Destroying Homey API connection...');

      // Unregister all event listeners
      if (this.homeyApi) {
        this.homeyApi.zones.off('zone.create');
        this.homeyApi.zones.off('zone.update');
        this.homeyApi.zones.off('zone.delete');
        this.homeyApi.devices.off('device.create');
        this.homeyApi.devices.off('device.update');
        this.homeyApi.devices.off('device.delete');
        this.homeyApi.flow.off('flow.create');
        this.homeyApi.flow.off('flow.update');
        this.homeyApi.flow.off('flow.delete');
      }

      await this.homeyApi.destroy();
      this.initialized = false;
      this.logger.log('Homey API destroyed');
    } catch (error) {
      this.logger.error('Error destroying Homey API:', error);
      throw error;
    } finally {
      this.isDestroying = false;
    }
  }
}
