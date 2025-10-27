/**
 * Control Zone Capability Tool - Bulk control any capability in a zone
 */

import { BaseTool } from './base-tool';
import { MCPTool, MCPToolCallResult } from '../types';
import { ZoneDeviceManager } from '../managers/zone-device-manager';

export class ControlZoneCapabilityTool extends BaseTool {
  readonly name = 'control_zone_capability';

  constructor(
    private homey: any,
    private zoneDeviceManager: ZoneDeviceManager
  ) {
    super();
  }

  getDefinition(): MCPTool {
    return {
      name: this.name,
      description: `ADVANCED BULK CONTROL - Control any capability on all matching devices in a zone.

PURPOSE: Universal zone-wide capability control (like control_zone_lights but for ANY capability).

WHEN TO USE:
- "Turn off all sockets in the garage"
- "Mute all speakers in the house"
- Advanced bulk control scenarios
- When control_zone_lights doesn't fit (non-light devices)

HOW IT WORKS:
1. Finds all devices in zone with specified capability
2. Sets that capability to the value on all devices
3. Reports success/failure counts

EXAMPLES:
- Turn off all sockets: capability="onoff", value=false
- Set all thermostats: capability="target_temperature", value=21
- Mute all media players: capability="volume_mute", value=true

NOTE: For lights specifically, prefer control_zone_lights (more user-friendly).`,
      inputSchema: {
        type: 'object',
        properties: {
          zoneId: {
            type: 'string',
            description: 'The ID of the zone',
          },
          capability: {
            type: 'string',
            description: 'The capability to control (e.g., "onoff", "volume_set", "target_temperature")',
          },
          value: {
            description: 'The value to set (type depends on capability)',
          },
        },
        required: ['zoneId', 'capability', 'value'],
      },
    };
  }

  async execute(args: any): Promise<MCPToolCallResult> {
    try {
      this.validateRequiredArgs(args, ['zoneId', 'capability', 'value']);

      const { zoneId, capability, value } = args;
      this.homey.log(`⚡ Controlling zone capability: ${zoneId} - ${capability} = ${value}`);

      const result = await this.zoneDeviceManager.setZoneDeviceCapability(zoneId, capability, value);
      const zone = await this.zoneDeviceManager.getZone(zoneId);

      let message = `⚡ Zone Capability Controlled\n\n`;
      message += `Zone: ${zone?.name || zoneId}\n`;
      message += `Capability: ${capability}\n`;
      message += `Value: ${value}\n\n`;
      message += `✅ Success: ${result.success} devices\n`;
      if (result.failed > 0) {
        message += `❌ Failed: ${result.failed} devices\n`;
      }
      message += `\nAffected Devices:\n`;
      result.devices.forEach((name: string) => {
        message += `  - ${name}\n`;
      });

      return this.createSuccessResponse(message);
    } catch (error: any) {
      this.homey.error('Error controlling zone capability:', error);
      return this.createErrorResponse(error);
    }
  }
}
