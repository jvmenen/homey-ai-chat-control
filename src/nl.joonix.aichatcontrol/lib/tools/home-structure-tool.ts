/**
 * Home Structure Tool - Get complete home layout
 */

import { BaseTool } from './base-tool';
import { MCPTool, MCPToolCallResult, HomeyInstance } from '../types';
import { IZoneDeviceManager } from '../interfaces';
import { XMLFormatter } from '../formatters/xml-formatter';
import { Logger } from '../utils/logger';

/**
 * Tool to get complete static home structure (zones + all devices with capabilities)
 * Most efficient way to understand home layout in a single API call
 */
export class HomeStructureTool extends BaseTool {
  readonly name = 'get_home_structure';
  private logger: Logger;

  constructor(
    private homey: HomeyInstance,
    private zoneDeviceManager: IZoneDeviceManager
  ) {
    super();
    this.logger = new Logger(homey, 'HomeStructureTool');
  }

  getDefinition(): MCPTool {
    return {
      name: this.name,
      description: `MOST EFFICIENT - Use this FIRST in every conversation!

PURPOSE: Get complete static home structure (zones, devices, and moods) in a single API call.

WHEN TO USE:
- At the START of every conversation to understand the home layout
- When you need to know what zones exist and what devices are in them
- When you need to see what capabilities each device has
- When you need to know what moods (light scenes) are available per zone

WHAT YOU GET:
- All zones with hierarchy (parent-child relationships)
- All devices with: name, ID, zone, class/type, capabilities list
- All moods (light scenes) with: name, ID, zone, preset, device count
- No current values (use get_states for that)

EFFICIENCY: Gets all zones, devices, and moods in a single efficient call. Call this ONCE and keep the structure in your context for the entire conversation.

BEST PRACTICE: Call get_home_structure first, then use get_states to get current values when needed.`,
      inputSchema: {
        type: 'object',
        properties: {},
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    try {
      this.logger.log('🏠 Getting complete home structure (static data)');

      const structure = await this.zoneDeviceManager.getHomeStructure();
      const formattedXML = XMLFormatter.formatHomeStructure(structure);

      return this.createSuccessResponse(formattedXML);
    } catch (error) {
      this.logger.error('Error getting home structure:', error);
      return this.createErrorResponse(error as Error);
    }
  }
}
