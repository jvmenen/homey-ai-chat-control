/**
 * Set Light Tool - User-friendly light control with 0-100 dim values
 */

import { BaseTool } from './base-tool';
import { MCPTool, MCPToolCallResult } from '../types';
import { ZoneDeviceManager } from '../managers/zone-device-manager';

export class SetLightTool extends BaseTool {
  readonly name = 'set_light';

  constructor(
    private homey: any,
    private zoneDeviceManager: ZoneDeviceManager
  ) {
    super();
  }

  getDefinition(): MCPTool {
    return {
      name: this.name,
      description: `RECOMMENDED for lights - Control light with convenient parameters.

PURPOSE: Control lights with human-friendly dim values (0-100 instead of 0-1).

WHEN TO USE:
- When controlling any light
- When user mentions lights specifically
- When you need to set both on/off and dim level

STATES:
- "on": Turn light on (optionally with dim level)
- "off": Turn light off
- "toggle": Switch to opposite state

DIM LEVEL:
- Use 0-100 range (NOT 0-1 like control_device)
- Only applied when state="on"
- Example: state="on", dim=50 (sets to 50% brightness)

EXAMPLES:
- Turn on at 100%: state="on" (no dim parameter)
- Turn on at 25%: state="on", dim=25
- Turn off: state="off"
- Toggle: state="toggle"`,
      inputSchema: {
        type: 'object',
        properties: {
          deviceId: {
            type: 'string',
            description: 'The ID of the light device',
          },
          state: {
            type: 'string',
            enum: ['on', 'off', 'toggle'],
            description: 'The desired state of the light',
          },
          dim: {
            type: 'number',
            description: 'Optional dim level (0-100). Only used when state is "on".',
          },
        },
        required: ['deviceId', 'state'],
      },
    };
  }

  async execute(args: any): Promise<MCPToolCallResult> {
    try {
      this.validateRequiredArgs(args, ['deviceId', 'state']);

      const { deviceId, state, dim } = args;
      this.homey.log(`💡 Setting light: ${deviceId} - ${state} ${dim ? `(dim: ${dim}%)` : ''}`);

      const device = await this.zoneDeviceManager.getDevice(deviceId);

      if (!device) {
        throw new Error(`Device not found`);
      }

      if (device.class !== 'light') {
        throw new Error(`Device ${device.name} is not a light (class: ${device.class})`);
      }

      // Handle toggle
      if (state === 'toggle') {
        await this.zoneDeviceManager.toggleDevice(deviceId);
      } else {
        // Set on/off
        const onValue = state === 'on';
        await this.zoneDeviceManager.setCapabilityValue(deviceId, 'onoff', onValue);

        // Set dim level if provided and turning on
        if (dim !== undefined && onValue && device.capabilities.includes('dim')) {
          const dimValue = dim / 100; // Convert 0-100 to 0-1
          await this.zoneDeviceManager.setCapabilityValue(deviceId, 'dim', dimValue);
        }
      }

      let message = `💡 Light Controlled\n\nDevice: ${device.name}\nState: ${state.toUpperCase()}`;
      if (dim !== undefined) {
        message += `\nDim Level: ${dim}%`;
      }

      return this.createSuccessResponse(message);
    } catch (error: any) {
      this.homey.error('Error setting light:', error);
      return this.createErrorResponse(error);
    }
  }
}
