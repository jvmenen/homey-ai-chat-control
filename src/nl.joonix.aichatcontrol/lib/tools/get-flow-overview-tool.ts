/**
 * Flow Overview Tool - Get complete flow overview
 */

import { BaseTool } from './base-tool';
import { MCPTool, MCPToolCallResult, HomeyInstance } from '../types';
import { IFlowManager } from '../interfaces';
import { XMLFormatter } from '../formatters/xml-formatter';

/**
 * Tool to get complete flow overview (all flows with cards, devices, apps)
 * Similar to get_home_structure - comprehensive single-call approach
 */
export class GetFlowOverviewTool extends BaseTool {
  readonly name = 'get_flow_overview';

  constructor(
    private homey: HomeyInstance,
    private flowManager: IFlowManager
  ) {
    super();
  }

  getDefinition(): MCPTool {
    return {
      name: this.name,
      description: `Get complete flow overview - all automation flows with their cards, devices, and apps.

PURPOSE: Understand all automation logic in Homey in a single API call, with optional filtering.

WHEN TO USE:
- When you need to know what automation flows exist
- To find which flows use a specific device (use device_ids filter)
- To see flows in a specific folder (use folder_paths filter)
- To find flows using a specific app (use app_ids filter)

WHAT YOU GET:
- All flows with: ID, name, enabled status, folder path (if organized)
- Each flow's cards: triggers, conditions, actions
- Which apps provide each card
- Which devices are used in each card
- MCP flows (AI-callable) are marked with mcp-command attribute

FILTERING: Combine multiple filters to narrow down results (AND logic between filter types, OR within).

EFFICIENCY: Gets all flows in a single call. Filters reduce response size.

BEST PRACTICE: Use together with get_home_structure to cross-reference device IDs with names.`,
      inputSchema: {
        type: 'object',
        properties: {
          include_disabled: {
            type: 'boolean',
            description: 'Include disabled flows in the output (default: false)',
          },
          device_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter flows that use any of these device IDs (OR logic)',
          },
          folder_paths: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter flows in any of these folder paths, e.g. ["Home/Living Room", "Home/Bedroom"] (OR logic)',
          },
          app_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter flows that use any of these app IDs, e.g. ["com.athom.hue", "com.ikea.tradfri"] (OR logic)',
          },
        },
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    try {
      this.homey.log('📋 Getting complete flow overview');

      const includeDisabled = args.include_disabled === true;
      const deviceIds = args.device_ids as string[] | undefined;
      const folderPaths = args.folder_paths as string[] | undefined;
      const appIds = args.app_ids as string[] | undefined;

      // Log filter usage for debugging
      if (deviceIds?.length) {
        this.homey.log(`   Filtering by devices: ${deviceIds.join(', ')}`);
      }
      if (folderPaths?.length) {
        this.homey.log(`   Filtering by folders: ${folderPaths.join(', ')}`);
      }
      if (appIds?.length) {
        this.homey.log(`   Filtering by apps: ${appIds.join(', ')}`);
      }

      const overview = await this.flowManager.getFlowOverview({
        includeDisabled,
        deviceIds,
        folderPaths,
        appIds,
      });

      const formattedXML = XMLFormatter.formatFlowOverview(overview);

      return this.createSuccessResponse(formattedXML);
    } catch (error) {
      this.homey.error('Error getting flow overview:', error);
      return this.createErrorResponse(error as Error);
    }
  }
}
