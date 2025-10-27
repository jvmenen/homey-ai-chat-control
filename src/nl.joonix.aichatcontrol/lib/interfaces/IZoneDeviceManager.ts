/**
 * IZoneDeviceManager - Interface for Homey zones and devices management
 *
 * Purpose: Decouple zone/device operations from concrete implementation
 * Responsibilities:
 * - Read zone and device information
 * - Control device capabilities
 * - Aggregate zone-level operations
 * - Provide snapshots of home state
 */

import {
  HomeyZone,
  HomeyDevice,
  ZoneHierarchy,
  ZoneTemperatureResult,
} from '../types';

export interface IZoneDeviceManager {
  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  /**
   * Initialize the manager (setup HomeyAPI connection)
   */
  init(): Promise<void>;

  /**
   * Clean up resources and close API connection
   */
  destroy(): Promise<void>;

  // ============================================================================
  // ZONE OPERATIONS (READ)
  // ============================================================================

  /**
   * Get all zones
   */
  getZones(): Promise<HomeyZone[]>;

  /**
   * Get a specific zone by ID
   */
  getZone(zoneId: string): Promise<HomeyZone | null>;

  /**
   * Get zone hierarchy with parent-child relationships
   */
  getZoneHierarchy(): Promise<ZoneHierarchy[]>;

  /**
   * Get all zones that are currently active (have activity)
   */
  getActiveZones(): Promise<HomeyZone[]>;

  // ============================================================================
  // DEVICE OPERATIONS (READ)
  // ============================================================================

  /**
   * Get all devices
   */
  getDevices(): Promise<HomeyDevice[]>;

  /**
   * Get a specific device by ID
   */
  getDevice(deviceId: string): Promise<HomeyDevice | null>;

  /**
   * Get all devices in a specific zone
   */
  getDevicesInZone(zoneId: string): Promise<HomeyDevice[]>;

  /**
   * Get devices by capability (e.g., all devices with 'measure_temperature')
   */
  getDevicesByCapability(capability: string): Promise<HomeyDevice[]>;

  /**
   * Get capability value from a device
   */
  getCapabilityValue(deviceId: string, capability: string): Promise<unknown>;

  /**
   * Get all temperature readings in a zone
   */
  getZoneTemperatures(zoneId: string): Promise<ZoneTemperatureResult>;

  // ============================================================================
  // DEVICE OPERATIONS (WRITE)
  // ============================================================================

  /**
   * Set a capability value on a device
   * @param deviceId - The device ID
   * @param capability - The capability to set (e.g., 'onoff', 'dim')
   * @param value - The value to set
   */
  setCapabilityValue(
    deviceId: string,
    capability: string,
    value: unknown
  ): Promise<void>;

  /**
   * Toggle a boolean capability (on/off)
   * @param deviceId - The device ID
   * @param capability - The capability to toggle (default: 'onoff')
   * @returns The new state after toggling
   */
  toggleDevice(deviceId: string, capability?: string): Promise<boolean>;

  // ============================================================================
  // ZONE OPERATIONS (WRITE)
  // ============================================================================

  /**
   * Set all lights in a zone to a specific state
   * @param zoneId - The zone ID
   * @param action - Action to perform ('on', 'off', 'toggle')
   * @param dimLevel - Optional dim level (0-100)
   * @returns Summary of operation results
   */
  setZoneLights(
    zoneId: string,
    action: 'on' | 'off' | 'toggle',
    dimLevel?: number
  ): Promise<{
    success: number;
    failed: number;
    devices: string[];
  }>;

  /**
   * Set a capability value on all devices in a zone that have that capability
   * @param zoneId - The zone ID
   * @param capability - The capability to set
   * @param value - The value to set
   * @returns Summary of operation results
   */
  setZoneDeviceCapability(
    zoneId: string,
    capability: string,
    value: unknown
  ): Promise<{
    success: number;
    failed: number;
    devices: string[];
  }>;

  // ============================================================================
  // SNAPSHOT OPERATIONS (Efficient batch reads)
  // ============================================================================

  /**
   * Get complete home structure in a single call (STATIC data)
   * Returns all zones, devices, and their capabilities without current values
   */
  getHomeStructure(): Promise<{
    zones: Array<{
      id: string;
      name: string;
      parent: string | null;
      icon: string;
    }>;
    devices: Array<{
      id: string;
      name: string;
      zone: string;
      zoneName: string;
      driverUri: string;
      class: string;
      capabilities: string[];
      available: boolean;
      ready: boolean;
    }>;
  }>;

  /**
   * Get current states of devices (DYNAMIC data)
   * Supports filtering by zone, specific devices, or capability
   */
  getStates(filters?: {
    zoneId?: string;
    deviceIds?: string[];
    capability?: string;
  }): Promise<{
    devices: Array<{
      id: string;
      name: string;
      zone: string;
      class: string;
      capabilities: Record<string, unknown>;
    }>;
    activeZones?: Array<{
      id: string;
      name: string;
      active: boolean;
      activeOrigins: string[];
    }>;
  }>;
}
