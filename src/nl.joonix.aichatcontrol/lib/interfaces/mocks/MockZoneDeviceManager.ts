/**
 * MockZoneDeviceManager - Mock implementation for testing
 */

import { IZoneDeviceManager } from '../IZoneDeviceManager';
import { HomeyZone, HomeyDevice, ZoneHierarchy, ZoneTemperatureResult, HomeyMood } from '../../types';

export class MockZoneDeviceManager implements IZoneDeviceManager {
  private mockZones: HomeyZone[] = [];
  private mockDevices: HomeyDevice[] = [];
  private capabilityValues: Map<string, unknown> = new Map();

  async init(): Promise<void> {
    // Mock initialization
  }

  async destroy(): Promise<void> {
    // Mock cleanup
  }

  // Zone operations
  async getZones(): Promise<HomeyZone[]> {
    return this.mockZones;
  }

  async getZone(zoneId: string): Promise<HomeyZone | null> {
    return this.mockZones.find(z => z.id === zoneId) || null;
  }

  async getZoneHierarchy(): Promise<ZoneHierarchy[]> {
    return [];
  }

  async getActiveZones(): Promise<HomeyZone[]> {
    return this.mockZones.filter(z => z.active);
  }

  // Device operations (read)
  async getDevices(): Promise<HomeyDevice[]> {
    return this.mockDevices;
  }

  async getDevice(deviceId: string): Promise<HomeyDevice | null> {
    return this.mockDevices.find(d => d.id === deviceId) || null;
  }

  async getDevicesInZone(zoneId: string): Promise<HomeyDevice[]> {
    return this.mockDevices.filter(d => d.zone === zoneId);
  }

  async getDevicesByCapability(capability: string): Promise<HomeyDevice[]> {
    return this.mockDevices.filter(d => d.capabilities.includes(capability));
  }

  async getCapabilityValue(deviceId: string, capability: string): Promise<unknown> {
    const key = `${deviceId}:${capability}`;
    return this.capabilityValues.get(key) || null;
  }

  async getZoneTemperatures(zoneId: string): Promise<ZoneTemperatureResult> {
    const zone = await this.getZone(zoneId);
    return {
      zoneId,
      zoneName: zone?.name || zoneId,
      readings: [],
    };
  }

  // Device operations (write)
  async setCapabilityValue(deviceId: string, capability: string, value: unknown): Promise<void> {
    const key = `${deviceId}:${capability}`;
    this.capabilityValues.set(key, value);
  }

  async toggleDevice(deviceId: string, capability: string = 'onoff'): Promise<boolean> {
    const currentValue = await this.getCapabilityValue(deviceId, capability);
    const newValue = !currentValue;
    await this.setCapabilityValue(deviceId, capability, newValue);
    return newValue as boolean;
  }

  // Zone operations (write)
  async setZoneLights(
    zoneId: string,
    action: 'on' | 'off' | 'toggle',
    dimLevel?: number
  ): Promise<{ success: number; failed: number; devices: string[] }> {
    const devices = await this.getDevicesInZone(zoneId);
    const lights = devices.filter(d => d.class === 'light');

    return {
      success: lights.length,
      failed: 0,
      devices: lights.map(d => d.name),
    };
  }

  async setZoneDeviceCapability(
    zoneId: string,
    capability: string,
    value: unknown
  ): Promise<{ success: number; failed: number; devices: string[] }> {
    const devices = await this.getDevicesInZone(zoneId);
    const devicesWithCap = devices.filter(d => d.capabilities.includes(capability));

    for (const device of devicesWithCap) {
      await this.setCapabilityValue(device.id, capability, value);
    }

    return {
      success: devicesWithCap.length,
      failed: 0,
      devices: devicesWithCap.map(d => d.name),
    };
  }

  // Snapshot operations
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
    moods: Array<{
      id: string;
      name: string;
      zone: string;
      preset: string | null;
      deviceCount: number;
    }>;
  }> {
    return {
      zones: this.mockZones.map(z => ({
        id: z.id,
        name: z.name,
        parent: z.parent,
        icon: z.icon,
      })),
      devices: this.mockDevices.map(d => ({
        id: d.id,
        name: d.name,
        zone: d.zone,
        zoneName: d.zoneName || d.zone,
        driverUri: d.driverUri,
        class: d.class,
        capabilities: d.capabilities,
        available: d.available,
        ready: d.ready,
      })),
      moods: [], // Mock has no moods by default
    };
  }

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
    let devices = this.mockDevices;

    if (filters?.zoneId) {
      devices = devices.filter(d => d.zone === filters.zoneId);
    }

    if (filters?.deviceIds) {
      devices = devices.filter(d => filters.deviceIds!.includes(d.id));
    }

    if (filters?.capability) {
      devices = devices.filter(d => d.capabilities.includes(filters.capability!));
    }

    return {
      devices: devices.map(d => ({
        id: d.id,
        name: d.name,
        zone: d.zone,
        class: d.class,
        capabilities: {},
      })),
      activeZones: this.mockZones
        .filter(z => z.active)
        .map(z => ({
          id: z.id,
          name: z.name,
          active: z.active,
          activeOrigins: z.activeOrigins,
        })),
    };
  }

  // Mood operations (mock implementations)
  async getMoods(): Promise<HomeyMood[]> {
    return []; // Mock has no moods
  }

  async getMood(moodId: string): Promise<HomeyMood | null> {
    return null; // Mock has no moods
  }

  // NOTE: activateMood() removed - not supported by Homey App API
  // Use flow-based activation instead

  // Test helpers
  addMockZone(zone: HomeyZone): void {
    this.mockZones.push(zone);
  }

  addMockDevice(device: HomeyDevice): void {
    this.mockDevices.push(device);
  }

  reset(): void {
    this.mockZones = [];
    this.mockDevices = [];
    this.capabilityValues.clear();
  }
}
