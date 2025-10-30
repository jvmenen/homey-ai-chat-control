/**
 * Refresh Flows Tool - Manually refresh list of available Homey flows
 */

import { BaseTool } from './base-tool';
import { MCPTool, MCPToolCallResult, HomeyInstance } from '../types';
import { IFlowManager } from '../interfaces';
import { ToolStateManager } from '../managers/tool-state-manager';

/**
 * Tool to manually refresh the list of available MCP flows
 * Useful after creating new flows with MCP triggers
 */
export class RefreshFlowsTool extends BaseTool {
  readonly name = 'refresh_homey_flows';

  constructor(
    private homey: HomeyInstance,
    private flowManager: IFlowManager,
    private toolStateManager: ToolStateManager
  ) {
    super();
  }

  getDefinition(): MCPTool {
    return {
      name: this.name,
      description: `Refresh the list of available Homey flows with MCP triggers.

PURPOSE: Re-scan Homey for flows that use the "MCP command received" trigger card.

WHEN TO USE:
- After creating new Homey flows with MCP triggers
- When a flow exists but doesn't appear as a tool
- After modifying flow parameters

IMPORTANT: New flows won't appear as dedicated tools in the current conversation, but:
1. This tool will show you what flows were found
2. You can immediately use trigger_any_flow to execute them
3. They will appear as dedicated tools in NEW conversations

OUTPUT: Shows all discovered flows with their commands and parameters.`,
      inputSchema: {
        type: 'object',
        properties: {},
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    try {
      this.homey.log('🔄 Manual flow refresh requested by Claude');

      // Force re-discovery of flows
      const flowTools = await this.flowManager.getToolsFromFlows();
      const newToolsList = JSON.stringify(flowTools);

      // Check if anything changed
      const changed = this.toolStateManager.hasChanged(newToolsList);

      // Update cached list
      this.toolStateManager.setToolsList(newToolsList);
      const toolCount = flowTools.length;

      let message = `✅ Flow refresh complete!\n\n`;
      message += `Found ${toolCount} flow(s) with MCP triggers.\n\n`;

      if (changed) {
        message += `🔄 Changes detected! New flows are available.\n\n`;
        message += `✅ WORKAROUND: You can trigger these flows RIGHT NOW using the 'trigger_any_flow' tool!\n`;
        message += `Just use trigger_any_flow with the command name and parameters shown below.\n\n`;
        message += `Note: To see them as dedicated tools in future chats, start a new chat session.`;
      } else {
        message += `ℹ️ No changes detected. Tool list is up to date.`;
      }

      if (toolCount > 0) {
        message += `\n\nFlows found on server:\n`;
        flowTools.forEach((tool, index) => {
          message += `\n${index + 1}. ${tool.name}\n`;
          message += `   Description: ${tool.description}\n`;

          // Show parameter details if available
          const schema = tool.inputSchema as any;
          if (schema?.properties && Object.keys(schema.properties).length > 0) {
            message += `   Parameters:\n`;
            Object.entries(schema.properties).forEach(([paramName, paramDef]: [string, any]) => {
              const isRequired = schema.required?.includes(paramName);
              const requiredMarker = isRequired ? '(required)' : '(optional)';
              message += `     - ${paramName}: ${paramDef.type} ${requiredMarker}`;
              if (paramDef.description) {
                message += ` - ${paramDef.description}`;
              }
              if (paramDef.enum) {
                message += ` [${paramDef.enum.join('|')}]`;
              }
              if (paramDef.minimum !== undefined || paramDef.maximum !== undefined) {
                message += ` [${paramDef.minimum || '?'}-${paramDef.maximum || '?'}]`;
              }
              message += `\n`;
            });
          }
        });
      }

      this.homey.log(`✅ Flow refresh complete: ${toolCount} flows, changed: ${changed}`);

      return this.createSuccessResponse(message);
    } catch (error) {
      this.homey.error('Error refreshing flows:', error);
      return this.createErrorResponse(error as Error);
    }
  }
}
