/**
 * Get States Tool - Get current device state values
 */

import { BaseTool } from './base-tool';
import { MCPTool, MCPToolCallResult, HomeyInstance } from '../types';
import { IZoneDeviceManager } from '../interfaces';
import { formatDeviceStates } from '../formatters/device-states-formatter';
import { Logger } from '../utils/logger';
import { optionalPositiveNumberArg } from '../utils/args';
import { filterSilentDevices } from '../diagnostics/device-activity';

/**
 * Tool to get current state/values of multiple devices efficiently
 */
export class GetStatesTool extends BaseTool {
  readonly name = 'get_states';
  private logger: Logger;

  constructor(
    private homey: HomeyInstance,
    private zoneDeviceManager: IZoneDeviceManager,
  ) {
    super();
    this.logger = new Logger(homey, 'GetStatesTool');
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
- When looking for devices that stopped reporting (silent_for_hours)

FILTERS (all optional):
- zoneId: Get states only for devices in a specific zone
- deviceIds: Get states only for specific devices
- capability: Get only specific capability values (e.g., just "onoff" states)
- include_timestamps: Also show per value when it was last received (each device always shows its last-update)
- silent_for_hours: Only devices that have not reported any value for this many hours (implies timestamps).
  Use this to find dead or disconnected sensors; Homey never marks battery devices unavailable, so this is the way to spot them

WHAT YOU GET:
- Current values for all matching devices, with the time each device last reported (last-update)
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
          include_timestamps: {
            type: 'boolean',
            description: 'Optional: Include per value when it was last received (the device-level last-update is always included)',
          },
          silent_for_hours: {
            type: 'number',
            description: 'Optional: Only include devices with no value received for more than this many hours (e.g. 24 or 168)',
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
      const silentForHours = optionalPositiveNumberArg(args?.silent_for_hours);
      const includeTimestamps = args?.include_timestamps === true || silentForHours !== undefined;

      this.logger.log(
        `📊 Getting states (zone: ${zoneId || 'all'}, devices: ${deviceIds?.length || 'all'}, capability: ${capability || 'all'})`,
      );

      const filters: { zoneId?: string; deviceIds?: string[]; capability?: string } = {};
      if (zoneId) filters.zoneId = zoneId;
      if (deviceIds) filters.deviceIds = deviceIds;
      if (capability) filters.capability = capability;

      const states = await this.zoneDeviceManager.getStates(filters);
      const silent = silentForHours !== undefined
        ? { hours: silentForHours, checked: states.devices.length }
        : undefined;
      const shown = silent
        ? { ...states, devices: filterSilentDevices(states.devices, silent.hours) }
        : states;
      const formattedXML = formatDeviceStates(shown, filters, { includeTimestamps, silent });

      return this.createSuccessResponse(formattedXML);
    } catch (error) {
      this.logger.error('Error getting states:', error);
      return this.createErrorResponse(error as Error);
    }
  }
}
