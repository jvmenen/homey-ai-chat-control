/**
 * Zone & Device Manager - Handles Homey zones and devices discovery and reading
 */

import Homey from 'homey';
import type { HomeyAPI } from 'homey-api';
import {
  HomeyZone,
  HomeyDevice,
  DeviceCapability,
  ZoneHierarchy,
  TemperatureReading,
  ZoneTemperatureResult,
} from '../types';
import { CapabilityValueConverter } from '../utils/capability-value-converter';
import {
  DeviceNotFoundError,
  ZoneNotFoundError,
  CapabilityNotFoundError,
  CapabilityNotWritableError,
  CapabilityValueError,
  HomeyMCPError,
} from '../utils/errors';
import { IZoneDeviceManager } from '../interfaces';

// Type for Homey API device/zone objects (simplified interface)
interface HomeyAPIDevice {
  id: string;
  name: string;
  zone: string;
  driverId?: string;
  class: string;
  capabilities: string[];
  capabilitiesObj: Record<string, {
    id: string;
    value: unknown;
    getable: boolean;
    setable: boolean;
    type?: string;
    units?: string;
    min?: number;
    max?: number;
    [key: string]: unknown;
  }>;
  available?: boolean;
  ready?: boolean;
  setCapabilityValue: (capability: string, value: unknown) => Promise<void>;
  [key: string]: unknown;
}

interface HomeyAPIZone {
  id: string;
  name: string;
  parent?: string | null;
  icon?: string;
  active?: boolean;
  activeOrigins?: string[];
  activeLastUpdated?: string | null;
  [key: string]: unknown;
}

export class ZoneDeviceManager implements IZoneDeviceManager {
  private homey: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Homey type is a namespace
  private homeyApi!: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- HomeyAPI types are incomplete
  private initialized: boolean = false;
  private isDestroying: boolean = false;

  constructor(homey: any) {
    this.homey = homey;
  }

  /**
   * Initialize Homey API connection
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.isDestroying) {
      throw new HomeyMCPError('Cannot initialize: manager is being destroyed', 'MANAGER_DESTROYING');
    }

    try {
      const { HomeyAPI } = require('homey-api');
      this.homeyApi = await HomeyAPI.createAppAPI({ homey: this.homey });
      this.initialized = true;
      this.homey.log('ZoneDeviceManager: Homey API initialized');
    } catch (error) {
      this.homey.error('ZoneDeviceManager: Failed to initialize Homey API:', error);
      throw error;
    }
  }

  /**
   * Clean up resources and close API connection
   */
  async destroy(): Promise<void> {
    if (!this.initialized || this.isDestroying) {
      return;
    }

    this.isDestroying = true;
    this.homey.log('ZoneDeviceManager: Cleaning up resources...');

    try {
      // Close Homey API connection if it exists and has a destroy method
      if (this.homeyApi) {
        // Remove all event listeners first to prevent recursive calls
        if (typeof this.homeyApi.removeAllListeners === 'function') {
          this.homeyApi.removeAllListeners();
        }

        // Destroy the API connection
        if (typeof this.homeyApi.destroy === 'function') {
          await this.homeyApi.destroy();
        }

        this.homeyApi = null;
      }

      this.initialized = false;
      this.homey.log('ZoneDeviceManager: Cleanup completed');
    } catch (error) {
      // Silently catch errors during cleanup to prevent recursive issues
      this.homey.error('ZoneDeviceManager: Error during cleanup:', error);
    } finally {
      this.isDestroying = false;
    }
  }

  /**
   * Get all zones
   */
  async getZones(): Promise<HomeyZone[]> {
    await this.init();

    try {
      const zonesObj = await this.homeyApi.zones.getZones();
      const zones: HomeyZone[] = (Object.values(zonesObj) as HomeyAPIZone[]).map((zone) => ({
        id: zone.id,
        name: zone.name,
        parent: zone.parent || null,
        icon: zone.icon || 'default',
        active: zone.active || false,
        activeOrigins: zone.activeOrigins || [],
        activeLastUpdated: zone.activeLastUpdated || null,
      }));

      this.homey.log(`ZoneDeviceManager: Found ${zones.length} zones`);
      return zones;
    } catch (error) {
      this.homey.error('ZoneDeviceManager: Failed to get zones:', error);
      throw error;
    }
  }

  /**
   * Get a specific zone by ID
   */
  async getZone(zoneId: string): Promise<HomeyZone | null> {
    await this.init();

    try {
      const zone = await this.homeyApi.zones.getZone({ id: zoneId });

      if (!zone) {
        return null;
      }

      return {
        id: zone.id,
        name: zone.name,
        parent: zone.parent || null,
        icon: zone.icon || 'default',
        active: zone.active || false,
        activeOrigins: zone.activeOrigins || [],
        activeLastUpdated: zone.activeLastUpdated || null,
      };
    } catch (error) {
      this.homey.error(`ZoneDeviceManager: Failed to get zone ${zoneId}:`, error);
      return null;
    }
  }

  /**
   * Get zone hierarchy with parent-child relationships
   */
  async getZoneHierarchy(): Promise<ZoneHierarchy[]> {
    await this.init();

    try {
      const zones = await this.getZones();
      const devices = await this.getDevices();

      // Build a map of zones by ID for quick lookup
      const zoneMap = new Map<string, HomeyZone>();
      zones.forEach(zone => zoneMap.set(zone.id, zone));

      // Build hierarchy starting with root zones (no parent)
      const buildHierarchy = (parentId: string | null): ZoneHierarchy[] => {
        return zones
          .filter(zone => zone.parent === parentId)
          .map(zone => ({
            zone,
            children: buildHierarchy(zone.id),
            devices: devices.filter(device => device.zone === zone.id),
          }));
      };

      return buildHierarchy(null);
    } catch (error) {
      this.homey.error('ZoneDeviceManager: Failed to get zone hierarchy:', error);
      throw error;
    }
  }

  /**
   * Get all zones that are currently active (have activity)
   */
  async getActiveZones(): Promise<HomeyZone[]> {
    await this.init();

    try {
      const zones = await this.getZones();
      return zones.filter(zone => zone.active);
    } catch (error) {
      this.homey.error('ZoneDeviceManager: Failed to get active zones:', error);
      throw error;
    }
  }

  /**
   * Get all devices
   */
  async getDevices(): Promise<HomeyDevice[]> {
    await this.init();

    try {
      const devicesObj = await this.homeyApi.devices.getDevices();
      const zonesObj = await this.homeyApi.zones.getZones();

      // Build zone name lookup map
      const zoneNameMap = new Map<string, string>();
      (Object.values(zonesObj) as HomeyAPIZone[]).forEach((zone) => {
        zoneNameMap.set(zone.id, zone.name);
      });

      const devices: HomeyDevice[] = (Object.values(devicesObj) as HomeyAPIDevice[]).map((device) => {
        // Convert HomeyAPI capabilities to our DeviceCapability type
        const capabilitiesObj: Record<string, DeviceCapability> = {};
        if (device.capabilitiesObj) {
          for (const [capId, capObj] of Object.entries(device.capabilitiesObj)) {
            capabilitiesObj[capId] = {
              id: capObj.id,
              value: capObj.value,
              type: capObj.type || 'string',
              title: capId, // Use capability ID as title fallback
              units: capObj.units,
              getable: capObj.getable,
              setable: capObj.setable,
              min: capObj.min,
              max: capObj.max,
            };
          }
        }

        return {
          id: device.id,
          name: device.name,
          zone: device.zone,
          zoneName: zoneNameMap.get(device.zone) || device.zone, // Look up zone name from map
          driverUri: device.driverId || 'unknown', // Use driverId instead of deprecated driverUri
          class: device.class,
          capabilities: device.capabilities || [],
          capabilitiesObj,
          available: device.available !== false,
          ready: device.ready !== false,
        };
      });

      this.homey.log(`ZoneDeviceManager: Found ${devices.length} devices`);
      return devices;
    } catch (error) {
      this.homey.error('ZoneDeviceManager: Failed to get devices:', error);
      throw error;
    }
  }

  /**
   * Get a specific device by ID
   */
  async getDevice(deviceId: string): Promise<HomeyDevice | null> {
    await this.init();

    try {
      const device = await this.homeyApi.devices.getDevice({ id: deviceId });

      if (!device) {
        return null;
      }

      // Get zone name
      let zoneName = device.zone;
      try {
        const zone = await this.homeyApi.zones.getZone({ id: device.zone });
        if (zone) {
          zoneName = zone.name;
        }
      } catch (error) {
        // If zone lookup fails, just use zone ID
        this.homey.log(`Could not get zone name for zone ${device.zone}`);
      }

      return {
        id: device.id,
        name: device.name,
        zone: device.zone,
        zoneName: zoneName, // Look up zone name instead of using deprecated property
        driverUri: device.driverId || 'unknown', // Use driverId instead of deprecated driverUri
        class: device.class,
        capabilities: device.capabilities || [],
        capabilitiesObj: device.capabilitiesObj || {},
        available: device.available !== false,
        ready: device.ready !== false,
      };
    } catch (error) {
      this.homey.error(`ZoneDeviceManager: Failed to get device ${deviceId}:`, error);
      return null;
    }
  }

  /**
   * Get all devices in a specific zone
   */
  async getDevicesInZone(zoneId: string): Promise<HomeyDevice[]> {
    await this.init();

    try {
      const devices = await this.getDevices();
      return devices.filter(device => device.zone === zoneId);
    } catch (error) {
      this.homey.error(`ZoneDeviceManager: Failed to get devices in zone ${zoneId}:`, error);
      throw error;
    }
  }

  /**
   * Get devices by capability (e.g., all devices with 'measure_temperature')
   */
  async getDevicesByCapability(capability: string): Promise<HomeyDevice[]> {
    await this.init();

    try {
      const devices = await this.getDevices();
      return devices.filter(device => device.capabilities.includes(capability));
    } catch (error) {
      this.homey.error(`ZoneDeviceManager: Failed to get devices by capability ${capability}:`, error);
      throw error;
    }
  }

  /**
   * Get capability value from a device
   */
  async getCapabilityValue(deviceId: string, capability: string): Promise<unknown> {
    await this.init();

    try {
      const device = await this.homeyApi.devices.getDevice({ id: deviceId });

      if (!device) {
        throw new DeviceNotFoundError(deviceId);
      }

      // Check if capability exists
      if (!device.capabilities.includes(capability)) {
        throw new CapabilityNotFoundError(device.name, capability);
      }

      // Get the capability value
      const capabilityObj = device.capabilitiesObj[capability];

      if (!capabilityObj) {
        throw new CapabilityNotFoundError(device.name, capability);
      }

      if (!capabilityObj.getable) {
        throw new CapabilityValueError(`Capability ${capability} is not readable`);
      }

      return capabilityObj.value;
    } catch (error) {
      this.homey.error(`ZoneDeviceManager: Failed to get capability value:`, error);
      throw error;
    }
  }

  /**
   * Get all temperature readings in a zone
   */
  async getZoneTemperatures(zoneId: string): Promise<ZoneTemperatureResult> {
    await this.init();

    try {
      const zone = await this.getZone(zoneId);

      if (!zone) {
        throw new ZoneNotFoundError(zoneId);
      }

      // Get all devices in the zone with temperature capability
      const devicesInZone = await this.getDevicesInZone(zoneId);
      const temperatureDevices = devicesInZone.filter(device =>
        device.capabilities.includes('measure_temperature')
      );

      if (temperatureDevices.length === 0) {
        return {
          zoneId: zone.id,
          zoneName: zone.name,
          readings: [],
        };
      }

      // Read temperature from each device
      const readings: TemperatureReading[] = [];

      for (const device of temperatureDevices) {
        try {
          const temperature = await this.getCapabilityValue(device.id, 'measure_temperature');
          const capabilityObj = device.capabilitiesObj['measure_temperature'];

          readings.push({
            deviceId: device.id,
            deviceName: device.name,
            temperature: typeof temperature === 'number' ? temperature : parseFloat(String(temperature)),
            units: capabilityObj?.units || '°C',
          });
        } catch (error) {
          this.homey.error(`Failed to read temperature from ${device.name}:`, error);
          // Continue with other devices
        }
      }

      // Calculate statistics
      let average: number | undefined;
      let min: number | undefined;
      let max: number | undefined;

      if (readings.length > 0) {
        const temps = readings.map(r => r.temperature);
        average = temps.reduce((sum, temp) => sum + temp, 0) / temps.length;
        min = Math.min(...temps);
        max = Math.max(...temps);
      }

      return {
        zoneId: zone.id,
        zoneName: zone.name,
        readings,
        average,
        min,
        max,
      };
    } catch (error) {
      this.homey.error(`ZoneDeviceManager: Failed to get zone temperatures:`, error);
      throw error;
    }
  }


  // ============================================================================
  // WRITE OPERATIONS (Optie B - Device Control)
  // ============================================================================

  /**
   * Set a capability value on a device (WRITE operation)
   */
  async setCapabilityValue(deviceId: string, capability: string, value: unknown): Promise<void> {
    await this.init();

    try {
      const device = await this.homeyApi.devices.getDevice({ id: deviceId });

      if (!device) {
        throw new DeviceNotFoundError(deviceId);
      }

      // Check if capability exists
      if (!device.capabilities.includes(capability)) {
        throw new CapabilityNotFoundError(device.name, capability);
      }

      // Get the capability object
      const capabilityObj = device.capabilitiesObj[capability];

      if (!capabilityObj) {
        throw new CapabilityNotFoundError(device.name, capability);
      }

      // Check if capability is setable
      if (!capabilityObj.setable) {
        throw new CapabilityNotWritableError(capability);
      }

      // Convert and validate value type
      const convertedValue = this.convertAndValidateValue(capabilityObj, value);

      this.homey.log(`Setting ${device.name} ${capability}: ${value} (${typeof value}) -> ${convertedValue} (${typeof convertedValue})`);

      // Set the value with the converted type
      await device.setCapabilityValue(capability, convertedValue);

      this.homey.log(`✅ Set ${device.name} ${capability} to ${convertedValue}`);
    } catch (error) {
      this.homey.error(`ZoneDeviceManager: Failed to set capability value:`, error);
      throw error;
    }
  }

  /**
   * Toggle a boolean capability (on/off)
   */
  async toggleDevice(deviceId: string, capability: string = 'onoff'): Promise<boolean> {
    await this.init();

    try {
      const device = await this.homeyApi.devices.getDevice({ id: deviceId });

      if (!device) {
        throw new DeviceNotFoundError(deviceId);
      }

      // Get current value
      const currentValue = await this.getCapabilityValue(deviceId, capability);

      if (typeof currentValue !== 'boolean') {
        throw new CapabilityValueError(`Capability ${capability} is not a boolean (current value: ${currentValue})`);
      }

      // Toggle
      const newValue = !currentValue;
      await this.setCapabilityValue(deviceId, capability, newValue);

      this.homey.log(`✅ Toggled ${device.name} ${capability} from ${currentValue} to ${newValue}`);
      return newValue;
    } catch (error) {
      this.homey.error(`ZoneDeviceManager: Failed to toggle device:`, error);
      throw error;
    }
  }

  /**
   * Set all lights in a zone to a specific state
   */
  async setZoneLights(
    zoneId: string,
    action: 'on' | 'off' | 'toggle',
    dimLevel?: number
  ): Promise<{ success: number; failed: number; devices: string[] }> {
    await this.init();

    try {
      const zone = await this.getZone(zoneId);

      if (!zone) {
        throw new ZoneNotFoundError(zoneId);
      }

      // Get all devices in zone with onoff capability
      const devicesInZone = await this.getDevicesInZone(zoneId);
      const lights = devicesInZone.filter(
        device => device.class === 'light' && device.capabilities.includes('onoff')
      );

      if (lights.length === 0) {
        throw new HomeyMCPError(`No lights found in zone ${zone.name}`, 'NO_LIGHTS_IN_ZONE');
      }

      this.homey.log(`🔦 Setting ${lights.length} lights in ${zone.name} to ${action}`);

      const results = {
        success: 0,
        failed: 0,
        devices: [] as string[],
      };

      for (const light of lights) {
        try {
          if (action === 'toggle') {
            await this.toggleDevice(light.id, 'onoff');
          } else {
            const state = action === 'on';
            await this.setCapabilityValue(light.id, 'onoff', state);
          }

          // Set dim level if provided and device supports it
          if (dimLevel !== undefined && light.capabilities.includes('dim')) {
            const dimValue = dimLevel / 100; // Convert 0-100 to 0-1
            await this.setCapabilityValue(light.id, 'dim', dimValue);
          }

          results.success++;
          results.devices.push(light.name);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.homey.error(`Failed to control ${light.name}:`, errorMessage);
          results.failed++;
        }
      }

      return results;
    } catch (error) {
      this.homey.error(`ZoneDeviceManager: Failed to set zone lights:`, error);
      throw error;
    }
  }

  /**
   * Set a capability value on all devices in a zone that have that capability
   */
  async setZoneDeviceCapability(
    zoneId: string,
    capability: string,
    value: unknown
  ): Promise<{ success: number; failed: number; devices: string[] }> {
    await this.init();

    try {
      const zone = await this.getZone(zoneId);

      if (!zone) {
        throw new ZoneNotFoundError(zoneId);
      }

      // Get all devices in zone with the capability
      const devicesInZone = await this.getDevicesInZone(zoneId);
      const devicesWithCapability = devicesInZone.filter(device =>
        device.capabilities.includes(capability)
      );

      if (devicesWithCapability.length === 0) {
        throw new CapabilityNotFoundError(zone.name, capability);
      }

      this.homey.log(
        `🎯 Setting ${capability} to ${value} on ${devicesWithCapability.length} devices in ${zone.name}`
      );

      const results = {
        success: 0,
        failed: 0,
        devices: [] as string[],
      };

      for (const device of devicesWithCapability) {
        try {
          await this.setCapabilityValue(device.id, capability, value);
          results.success++;
          results.devices.push(device.name);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.homey.error(`Failed to set ${capability} on ${device.name}:`, errorMessage);
          results.failed++;
        }
      }

      return results;
    } catch (error) {
      this.homey.error(`ZoneDeviceManager: Failed to set zone device capability:`, error);
      throw error;
    }
  }

  // ============================================================================
  // VALIDATION HELPERS
  // ============================================================================

  /**
   * Convert and validate a capability value before setting it
   * Handles type conversion from JSON strings to correct types
   */
  private convertAndValidateValue(capabilityObj: HomeyAPIDevice['capabilitiesObj'][string], value: unknown): unknown {
    // Convert HomeyAPI capability object to DeviceCapability interface
    const deviceCap: DeviceCapability = {
      id: capabilityObj.id,
      value: capabilityObj.value,
      type: capabilityObj.type || 'string',
      title: capabilityObj.id, // Fallback to ID
      getable: capabilityObj.getable,
      setable: capabilityObj.setable,
      units: capabilityObj.units,
      min: capabilityObj.min,
      max: capabilityObj.max,
    };
    return CapabilityValueConverter.convert(deviceCap, value);
  }

  // ============================================================================
  // COMBINED SNAPSHOT OPERATIONS (Efficient data retrieval)
  // ============================================================================

  /**
   * Get complete home structure in a single call (STATIC data)
   * Returns all zones, devices, and their capabilities without current values
   */
  async getHomeStructure(): Promise<{
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
  }> {
    await this.init();

    try {
      // Get all zones and devices in parallel
      const [zones, devices] = await Promise.all([
        this.getZones(),
        this.getDevices(),
      ]);

      // Map to simplified structure (no current values, just static info)
      const zoneList = zones.map(zone => ({
        id: zone.id,
        name: zone.name,
        parent: zone.parent,
        icon: zone.icon,
      }));

      const deviceList = devices.map(device => ({
        id: device.id,
        name: device.name,
        zone: device.zone,
        zoneName: device.zoneName || device.zone,
        driverUri: device.driverUri,
        class: device.class,
        capabilities: device.capabilities,
        available: device.available,
        ready: device.ready,
      }));

      this.homey.log(`📸 Home structure snapshot: ${zoneList.length} zones, ${deviceList.length} devices`);

      return {
        zones: zoneList,
        devices: deviceList,
      };
    } catch (error) {
      this.homey.error('ZoneDeviceManager: Failed to get home structure:', error);
      throw error;
    }
  }

  /**
   * Get current states of devices (DYNAMIC data)
   * Supports filtering by zone, specific devices, or capability
   */
  async getStates(filters?: {
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
  }> {
    await this.init();

    try {
      // Get devices based on filters
      let devices: HomeyDevice[];

      if (filters?.deviceIds && filters.deviceIds.length > 0) {
        // Specific devices
        const devicePromises = filters.deviceIds.map(id => this.getDevice(id));
        const results = await Promise.all(devicePromises);
        devices = results.filter(d => d !== null) as HomeyDevice[];
      } else if (filters?.zoneId) {
        // All devices in zone
        devices = await this.getDevicesInZone(filters.zoneId);
      } else {
        // All devices
        devices = await this.getDevices();
      }

      // Apply capability filter if specified
      if (filters?.capability) {
        devices = devices.filter(d => d.capabilities.includes(filters.capability!));
      }

      this.homey.log(`🔍 Getting states for ${devices.length} device(s)${filters?.capability ? ` with capability ${filters.capability}` : ''}`);

      // Read current values for all capabilities (or just filtered one)
      const deviceStates = await Promise.all(
        devices.map(async device => {
          const capabilities: Record<string, unknown> = {};

          // Determine which capabilities to read
          const capsToRead = filters?.capability
            ? [filters.capability]
            : device.capabilities;

          // Read all capability values
          for (const cap of capsToRead) {
            try {
              const capObj = device.capabilitiesObj[cap];
              if (capObj && capObj.getable) {
                capabilities[cap] = capObj.value;
              }
            } catch (error) {
              this.homey.error(`Failed to read ${cap} from ${device.name}:`, error);
              // Continue with other capabilities
            }
          }

          return {
            id: device.id,
            name: device.name,
            zone: device.zone,
            class: device.class,
            capabilities,
          };
        })
      );

      // Optionally include active zones
      const activeZones = await this.getActiveZones();
      const activeZonesList = activeZones.map(zone => ({
        id: zone.id,
        name: zone.name,
        active: zone.active,
        activeOrigins: zone.activeOrigins,
      }));

      this.homey.log(`📊 States retrieved: ${deviceStates.length} devices, ${activeZonesList.length} active zones`);

      return {
        devices: deviceStates,
        activeZones: activeZonesList,
      };
    } catch (error) {
      this.homey.error('ZoneDeviceManager: Failed to get states:', error);
      throw error;
    }
  }
}
