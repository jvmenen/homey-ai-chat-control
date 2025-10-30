/**
 * Flow Overview Tool - Get complete flow overview
 */

import Homey from 'homey';
import { BaseTool } from './base-tool';
import { MCPTool, MCPToolCallResult } from '../types';
import { IFlowManager } from '../interfaces';
import { XMLFormatter } from '../formatters/xml-formatter';

/**
 * Tool to get complete flow overview (all flows with cards, devices, apps)
 * Similar to get_home_structure - comprehensive single-call approach
 */
export class GetFlowOverviewTool extends BaseTool {
  readonly name = 'get_flow_overview';

  constructor(
    private homey: any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Homey type is a namespace
    private flowManager: IFlowManager
  ) {
    super();
  }

  getDefinition(): MCPTool {
    return {
      name: this.name,
      description: `Get complete flow overview - all automation flows with their cards, devices, and apps.

PURPOSE: Understand all automation logic in Homey in a single API call.

WHEN TO USE:
- When you need to know what automation flows exist
- To find which flows use a specific device
- To see which apps are used in automations
- To understand the automation structure

WHAT YOU GET:
- All flows with: ID, name, enabled status, folder (if organized)
- Each flow's cards: triggers, conditions, actions
- Which apps provide each card
- Which devices are used in each card
- MCP flows (AI-callable) are marked with mcp-command attribute

EFFICIENCY: Gets all flows in a single call. AI can filter/search the XML data.

BEST PRACTICE: Use together with get_home_structure to cross-reference device IDs with names.`,
      inputSchema: {
        type: 'object',
        properties: {
          include_disabled: {
            type: 'boolean',
            description: 'Include disabled flows in the output (default: false)',
          },
        },
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    try {
      this.homey.log('📋 Getting complete flow overview');

      const includeDisabled = args.include_disabled === true;

      const overview = await this.flowManager.getFlowOverview(includeDisabled);
      const formattedXML = XMLFormatter.formatFlowOverview(overview);

      return this.createSuccessResponse(formattedXML);
    } catch (error) {
      this.homey.error('Error getting flow overview:', error);
      return this.createErrorResponse(error as Error);
    }
  }
}
