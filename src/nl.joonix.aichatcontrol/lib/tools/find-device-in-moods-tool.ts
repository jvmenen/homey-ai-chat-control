/**
 * Find Device in Moods Tool - Check if a device is used in any moods
 */

import { BaseTool } from './base-tool';
import {
  MCPTool, MCPToolCallResult, HomeyInstance, HomeyDevice,
} from '../types';
import { IZoneDeviceManager } from '../interfaces';
import { XMLFormatter } from '../formatters/xml-formatter';
import { Logger } from '../utils/logger';

export class FindDeviceInMoodsTool extends BaseTool {
  readonly name = 'find_device_in_moods';
  private logger: Logger;

  constructor(
    private homey: HomeyInstance,
    private zoneDeviceManager: IZoneDeviceManager,
  ) {
    super();
    this.logger = new Logger(homey, 'FindDeviceInMoodsTool');
  }

  getDefinition(): MCPTool {
    return {
      name: this.name,
      description: `Find which moods include a specific device.

PURPOSE: Check if a device is used in any moods (useful before device migration/deletion).

WHEN TO USE:
- Before removing or migrating a device
- "Is the ceiling light used in any moods?"
- "Which scenes include this lamp?"
- When planning device changes

PARAMETERS:
- deviceId (optional): Exact UUID of the device
- deviceName (optional): Device name (case-insensitive matching)
- Must provide either deviceId OR deviceName

WHAT YOU GET:
- List of moods that include the device
- For each mood: mood name, zone, and the device's configured state
- Empty result if device is not in any moods

USE CASE: Before migrating from Device Capabilities app to native device groups, check if the old device is in any moods to avoid breaking scenes.

EXAMPLE: "Is my bedroom light in any moods?"`,
      inputSchema: {
        type: 'object',
        properties: {
          deviceId: {
            type: 'string',
            description: 'Optional: Exact UUID of the device',
          },
          deviceName: {
            type: 'string',
            description: 'Optional: Device name (case-insensitive matching)',
          },
        },
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    try {
      const deviceId = args.deviceId as string | undefined;
      const deviceName = args.deviceName as string | undefined;

      // Validate: at least one parameter required
      if (!deviceId && !deviceName) {
        return this.createErrorResponse(
          new Error('Either deviceId or deviceName must be provided'),
        );
      }

      this.logger.log(`🔍 Finding device in moods: ${deviceId || deviceName}`);

      // Find device by name if provided
      let targetDeviceId = deviceId;
      let device: HomeyDevice | null = null;

      if (!targetDeviceId && deviceName) {
        const devices = await this.zoneDeviceManager.getDevices();
        const foundDevice = this.findDeviceByName(devices, deviceName);

        if (!foundDevice) {
          return this.createErrorResponse(
            new Error(
              `Device not found: "${deviceName}"\n\nDid you mean one of these?\n${this.formatSimilarDevices(devices, deviceName)}`,
            ),
          );
        }

        device = foundDevice;
        targetDeviceId = foundDevice.id;
      } else {
        // Verify device exists by ID
        device = await this.zoneDeviceManager.getDevice(targetDeviceId!);
        if (!device) {
          return this.createErrorResponse(new Error(`Device not found with ID: ${targetDeviceId}`));
        }
      }

      const deviceDisplayName = device.name;

      // Get all moods
      const moods = await this.zoneDeviceManager.getMoods();

      // Filter moods that include this device
      const moodsWithDevice: Array<{
        mood: { id: string; name: string; preset: string | null };
        zoneName: string;
        state: Record<string, unknown>;
      }> = [];

      for (const mood of moods) {
        if (mood.devices[targetDeviceId!]) {
          // Get zone name
          const zone = await this.zoneDeviceManager.getZone(mood.zone);
          const zoneName = zone ? zone.name : mood.zone;

          // Normalize state structure
          const deviceData = mood.devices[targetDeviceId!] as
            | { state?: Record<string, unknown> }
            | Record<string, unknown>;
          const state = (deviceData as { state?: Record<string, unknown> }).state
            || (deviceData as Record<string, unknown>);

          moodsWithDevice.push({
            mood: {
              id: mood.id,
              name: mood.name,
              preset: mood.preset,
            },
            zoneName,
            state,
          });
        }
      }

      // Format output
      const formattedOutput = XMLFormatter.formatDeviceInMoods(
        targetDeviceId!,
        deviceDisplayName,
        moodsWithDevice,
      );

      return this.createSuccessResponse(formattedOutput);
    } catch (error) {
      this.logger.error('Error finding device in moods:', error);
      return this.createErrorResponse(error as Error);
    }
  }

  /**
   * Find device by name using fuzzy matching
   */
  private findDeviceByName(devices: HomeyDevice[], name: string): HomeyDevice | null {
    const lowerName = name.toLowerCase().trim();

    // Exact match first
    const exactMatch = devices.find((d) => d.name.toLowerCase() === lowerName);
    if (exactMatch) return exactMatch;

    // Partial match fallback
    return devices.find((d) => d.name.toLowerCase().includes(lowerName)) || null;
  }

  /**
   * Format similar devices for error message (show up to 5 closest matches)
   */
  private formatSimilarDevices(devices: HomeyDevice[], searchName: string): string {
    const lowerSearch = searchName.toLowerCase();

    // Find devices with partial matches
    const partialMatches = devices
      .filter((d) => d.name.toLowerCase().includes(lowerSearch))
      .slice(0, 5);

    if (partialMatches.length > 0) {
      return partialMatches
        .map((d) => {
          const zoneName = d.zoneName || d.zone;
          return `- ${d.name} (${zoneName})`;
        })
        .join('\n');
    }

    // Show first 5 devices as fallback
    return devices
      .slice(0, 5)
      .map((d) => {
        const zoneName = d.zoneName || d.zone;
        return `- ${d.name} (${zoneName})`;
      })
      .join('\n');
  }
}
