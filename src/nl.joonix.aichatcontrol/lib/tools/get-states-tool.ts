/**
 * Get States Tool - Get current device state values
 */

import Homey from 'homey';
import { BaseTool } from './base-tool';
import { MCPTool, MCPToolCallResult } from '../types';
import { ZoneDeviceManager } from '../managers/zone-device-manager';
import { XMLFormatter } from '../formatters/xml-formatter';

/**
 * Tool to get current state/values of multiple devices efficiently
 */
export class GetStatesTool extends BaseTool {
  readonly name = 'get_states';

  constructor(
    private homey: any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Homey type is a namespace
    private zoneDeviceManager: ZoneDeviceManager
  ) {
    super();
  }

  getDefinition(): MCPTool {
    return {
      name: this.name,
      description: `MOST EFFICIENT - Use this for getting current device values!

PURPOSE: Get current state/values of multiple devices in a single API call with optional filtering.

WHEN TO USE:
- When you need current values (on/off, temperature, dim level, etc.)
- When checking "are lights on in zone X?"
- When checking multiple device states at once
- When you want to know which zones are currently active

FILTERS (all optional):
- zoneId: Get states only for devices in a specific zone
- deviceIds: Get states only for specific devices
- capability: Get only specific capability values (e.g., just "onoff" states)

WHAT YOU GET:
- Current values for all matching devices
- List of currently active zones (motion/presence detected)

EFFICIENCY: Gets multiple device states in one call. Instead of 6 separate calls for 6 lights, make 1 call with zone filter.

BEST PRACTICE: Use after get_home_structure. Filter by zone and/or capability to get exactly what you need.`,
      inputSchema: {
        type: 'object',
        properties: {
          zoneId: {
            type: 'string',
            description: 'Optional: Only get states for devices in this zone',
          },
          deviceIds: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Optional: Only get states for these specific device IDs',
          },
          capability: {
            type: 'string',
            description: 'Optional: Only get this specific capability (e.g., "onoff", "measure_temperature")',
          },
        },
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    try {
      const zoneId = args?.zoneId as string | undefined;
      const deviceIds = args?.deviceIds as string[] | undefined;
      const capability = args?.capability as string | undefined;

      this.homey.log(
        `📊 Getting states (zone: ${zoneId || 'all'}, devices: ${deviceIds?.length || 'all'}, capability: ${capability || 'all'})`
      );

      const filters: { zoneId?: string; deviceIds?: string[]; capability?: string } = {};
      if (zoneId) filters.zoneId = zoneId;
      if (deviceIds) filters.deviceIds = deviceIds;
      if (capability) filters.capability = capability;

      const states = await this.zoneDeviceManager.getStates(filters);
      const formattedXML = XMLFormatter.formatDeviceStates(states, filters);

      return this.createSuccessResponse(formattedXML);
    } catch (error) {
      this.homey.error('Error getting states:', error);
      return this.createErrorResponse(error as Error);
    }
  }
}
