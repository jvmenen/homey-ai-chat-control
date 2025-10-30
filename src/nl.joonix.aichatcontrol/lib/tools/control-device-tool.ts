/**
 * Control Device Tool - Universal device capability control
 */

import { BaseTool } from './base-tool';
import { MCPTool, MCPToolCallResult, HomeyInstance } from '../types';
import { IZoneDeviceManager } from '../interfaces';

export class ControlDeviceTool extends BaseTool {
  readonly name = 'control_device';

  constructor(
    private homey: HomeyInstance,
    private zoneDeviceManager: IZoneDeviceManager
  ) {
    super();
  }

  getDefinition(): MCPTool {
    return {
      name: this.name,
      description: `UNIVERSAL CONTROL - Control any device capability.

PURPOSE: Set any capability value on any device (most flexible control tool).

WHEN TO USE:
- When controlling non-standard capabilities
- When you know the exact capability name to control
- When specialized tools (set_light, set_thermostat) don't fit

EXAMPLES:
- Turn light on: capability="onoff", value=true
- Set dim to 50%: capability="dim", value=0.5 (note: 0-1 range, not 0-100)
- Set thermostat: capability="target_temperature", value=21
- Set volume: capability="volume_set", value=0.3

VALUE TYPES:
- onoff: boolean (true/false)
- dim: number 0-1 (0=off, 1=100%)
- temperatures: number in Celsius
- volume: number 0-1

NOTE: For lights, prefer set_light (handles dim as 0-100). For zone-wide control, prefer control_zone_lights.`,
      inputSchema: {
        type: 'object',
        properties: {
          deviceId: {
            type: 'string',
            description: 'The ID of the device to control',
          },
          capability: {
            type: 'string',
            description: 'The capability to control (e.g., "onoff", "dim", "target_temperature")',
          },
          value: {
            description: 'The value to set (boolean for onoff, number 0-1 for dim, number for temperature)',
          },
        },
        required: ['deviceId', 'capability', 'value'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    try {
      this.validateRequiredArgs(args, ['deviceId', 'capability', 'value']);

      const deviceId = args.deviceId as string;
      const capability = args.capability as string;
      const value = args.value;
      this.homey.log(`🎛️ Controlling device: ${deviceId} - ${capability} = ${value} (type: ${typeof value})`);

      await this.zoneDeviceManager.setCapabilityValue(deviceId, capability, value);

      const device = await this.zoneDeviceManager.getDevice(deviceId);

      return this.createSuccessResponse(
        `✅ Device Controlled Successfully\n\nDevice: ${device?.name || deviceId}\nCapability: ${capability}\nNew Value: ${value}`
      );
    } catch (error) {
      this.homey.error('Error controlling device:', error);
      return this.createErrorResponse(error as Error);
    }
  }
}
