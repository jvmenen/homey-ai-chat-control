/**
 * Control Zone Lights Tool - Bulk control all lights in a zone
 */

import { BaseTool } from './base-tool';
import { MCPTool, MCPToolCallResult, HomeyInstance } from '../types';
import { IZoneDeviceManager } from '../interfaces';
import { Logger } from '../utils/logger';

export class ControlZoneLightsTool extends BaseTool {
  readonly name = 'control_zone_lights';
  private logger: Logger;

  constructor(
    private homey: HomeyInstance,
    private zoneDeviceManager: IZoneDeviceManager
  ) {
    super();
    this.logger = new Logger(homey, 'ControlZoneLightsTool');
  }

  getDefinition(): MCPTool {
    return {
      name: this.name,
      description: `BULK CONTROL - Control ALL lights in a zone at once.

PURPOSE: Control multiple lights in a zone with one command.

WHEN TO USE:
- "Turn off all lights in the kitchen"
- "Turn on bedroom lights at 30%"
- "Toggle all living room lights"
- Any command affecting multiple lights in a zone

ACTIONS:
- "on": Turn all lights on
- "off": Turn all lights off
- "toggle": Toggle each light individually

DIM LEVEL:
- Optional, 0-100 range
- Applied to all lights that support dimming
- Only used with action="on"

EFFICIENCY: Much better than calling set_light for each device individually.

EXAMPLE: action="on", dim=50 → turns on all zone lights at 50%`,
      inputSchema: {
        type: 'object',
        properties: {
          zoneId: {
            type: 'string',
            description: 'The ID of the zone',
          },
          action: {
            type: 'string',
            enum: ['on', 'off', 'toggle'],
            description: 'The action to perform on all lights',
          },
          dim: {
            type: 'number',
            description: 'Optional dim level (0-100) to set all lights to',
          },
        },
        required: ['zoneId', 'action'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    try {
      this.validateRequiredArgs(args, ['zoneId', 'action']);

      const zoneId = args.zoneId as string;
      const action = args.action as 'on' | 'off' | 'toggle';
      const dim = args.dim as number | undefined;
      this.logger.log(`🔦 Controlling zone lights: ${zoneId} - ${action} ${dim ? `(dim: ${dim}%)` : ''}`);

      const result = await this.zoneDeviceManager.setZoneLights(zoneId, action, dim);
      const zone = await this.zoneDeviceManager.getZone(zoneId);

      let message = `🔦 Zone Lights Controlled\n\nZone: ${zone?.name || zoneId}\nAction: ${action.toUpperCase()}`;
      if (dim !== undefined) {
        message += `\nDim Level: ${dim}%`;
      }
      message += `\n\n✅ Success: ${result.success} lights`;
      if (result.failed > 0) {
        message += `\n❌ Failed: ${result.failed} lights`;
      }
      message += `\n\nAffected Lights:\n`;
      result.devices.forEach((name) => {
        message += `  - ${name}\n`;
      });

      return this.createSuccessResponse(message);
    } catch (error) {
      this.logger.error('Error controlling zone lights:', error);
      return this.createErrorResponse(error as Error);
    }
  }
}
