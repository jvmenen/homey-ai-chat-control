/**
 * Toggle Device Tool - Toggle device on/off state
 */

import Homey from 'homey';
import { BaseTool } from './base-tool';
import { MCPTool, MCPToolCallResult } from '../types';
import { ZoneDeviceManager } from '../managers/zone-device-manager';

export class ToggleDeviceTool extends BaseTool {
  readonly name = 'toggle_device';

  constructor(
    private homey: any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Homey type is a namespace
    private zoneDeviceManager: ZoneDeviceManager
  ) {
    super();
  }

  getDefinition(): MCPTool {
    return {
      name: this.name,
      description: `Toggle a device between on and off states.

PURPOSE: Switch device to opposite state (on→off or off→on).

WHEN TO USE:
- When user says "toggle the light"
- When you want to flip current state without knowing it
- Quick on/off switch for any device

WORKS WITH: Any device with onoff capability (lights, switches, plugs, etc.)

NOTE: This reads current state first, then sets opposite. For explicit on/off, use set_light or control_device.`,
      inputSchema: {
        type: 'object',
        properties: {
          deviceId: {
            type: 'string',
            description: 'The ID of the device to toggle',
          },
        },
        required: ['deviceId'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    try {
      this.validateRequiredArgs(args, ['deviceId']);

      const deviceId = args.deviceId as string;
      this.homey.log(`🔄 Toggling device: ${deviceId}`);

      const newState = await this.zoneDeviceManager.toggleDevice(deviceId);
      const device = await this.zoneDeviceManager.getDevice(deviceId);

      return this.createSuccessResponse(
        `✅ Device Toggled\n\nDevice: ${device?.name || deviceId}\nNew State: ${newState ? 'ON' : 'OFF'}`
      );
    } catch (error) {
      this.homey.error('Error toggling device:', error);
      return this.createErrorResponse(error as Error);
    }
  }
}
