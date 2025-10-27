/**
 * Set Thermostat Tool - Control thermostat temperature
 */

import Homey from 'homey';
import { BaseTool } from './base-tool';
import { MCPTool, MCPToolCallResult } from '../types';
import { ZoneDeviceManager } from '../managers/zone-device-manager';
import { DeviceNotFoundError, CapabilityNotFoundError } from '../utils/errors';

export class SetThermostatTool extends BaseTool {
  readonly name = 'set_thermostat';

  constructor(
    private homey: any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Homey type is a namespace
    private zoneDeviceManager: ZoneDeviceManager
  ) {
    super();
  }

  getDefinition(): MCPTool {
    return {
      name: this.name,
      description: `Control thermostat temperature.

PURPOSE: Set target temperature on thermostats and heating devices.

WHEN TO USE:
- When user wants to change temperature setting
- "Set bedroom to 21 degrees"
- "Make it warmer/cooler" (adjust current temperature)

TEMPERATURE: Always in degrees Celsius

NOTE: This only sets the TARGET temperature, not current temperature (which is read-only).`,
      inputSchema: {
        type: 'object',
        properties: {
          deviceId: {
            type: 'string',
            description: 'The ID of the thermostat device',
          },
          temperature: {
            type: 'number',
            description: 'The target temperature in degrees Celsius',
          },
        },
        required: ['deviceId', 'temperature'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    try {
      this.validateRequiredArgs(args, ['deviceId', 'temperature']);

      const deviceId = args.deviceId as string;
      const temperature = args.temperature as number;
      this.homey.log(`🌡️ Setting thermostat: ${deviceId} - ${temperature}°C`);

      const device = await this.zoneDeviceManager.getDevice(deviceId);

      if (!device) {
        throw new DeviceNotFoundError(deviceId);
      }

      if (!device.capabilities.includes('target_temperature')) {
        throw new CapabilityNotFoundError(device.name, 'target_temperature');
      }

      await this.zoneDeviceManager.setCapabilityValue(deviceId, 'target_temperature', temperature);

      return this.createSuccessResponse(
        `🌡️ Thermostat Set\n\nDevice: ${device.name}\nTarget Temperature: ${temperature}°C`
      );
    } catch (error) {
      this.homey.error('Error setting thermostat:', error);
      return this.createErrorResponse(error as Error);
    }
  }
}
