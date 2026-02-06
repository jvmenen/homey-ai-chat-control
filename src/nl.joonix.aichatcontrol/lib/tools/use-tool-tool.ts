/**
 * Use Tool Tool - Execute discovered tools
 */

import { BaseTool } from './base-tool';
import { MCPTool, MCPToolCallResult, HomeyInstance } from '../types';
import { ToolRegistry } from './tool-registry';
import { FlowManager } from '../managers/flow-manager';
import { getToolMetadata, isCoreToolMetadata } from './tool-metadata';
import { Logger } from '../utils/logger';

/**
 * Arguments for use_tool
 */
export interface UseToolArgs {
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Tool: use_tool
 * Execute a discovered tool by name
 */
export class UseToolTool extends BaseTool {
  readonly name = 'use_tool';
  private logger: Logger;

  constructor(
    private homey: HomeyInstance,
    private toolRegistry: ToolRegistry,
    private flowManager?: FlowManager
  ) {
    super();
    this.logger = new Logger(homey, 'UseToolTool');
  }

  getDefinition(): MCPTool {
    return {
      name: 'use_tool',
      description:
        'Execute a discovered tool by name. Use search_tools first to find available tools, ' +
        'then use this to execute them with the required arguments. ' +
        '\n\n' +
        'WORKFLOW:\n' +
        '1. Use search_tools to discover available tools\n' +
        '2. Use use_tool to execute the tool with appropriate arguments\n' +
        '\n' +
        'EXAMPLES:\n' +
        '• Control a light:\n' +
        '  use_tool({\n' +
        '    name: "set_light",\n' +
        '    arguments: { deviceId: "abc123", state: "on", dim: 75 }\n' +
        '  })\n' +
        '\n' +
        '• Get insight data:\n' +
        '  use_tool({\n' +
        '    name: "get_insight_data",\n' +
        '    arguments: { logIds: ["log1"], resolution: "last24Hours" }\n' +
        '  })\n' +
        '\n' +
        '• Trigger a flow:\n' +
        '  use_tool({\n' +
        '    name: "trigger_any_flow",\n' +
        '    arguments: { command: "bedtime", parameters: {} }\n' +
        '  })\n' +
        '\n' +
        'NOTE: Core tools (get_home_structure, get_states, get_flow_overview) ' +
        'can be called directly without use_tool.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Tool name (from search_tools results)',
          },
          arguments: {
            type: 'object',
            description:
              'Tool-specific arguments as a JSON object. ' +
              'Check search_tools results for required parameters (deviceId, zoneId, etc.)',
          },
        },
        required: ['name', 'arguments'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    try {
      this.validateRequiredArgs(args, ['name', 'arguments']);

      const typedArgs = args as unknown as UseToolArgs;
      const toolName = typedArgs.name;
      const toolArgs = typedArgs.arguments || {};

      this.logger.log(`🔧 use_tool: Executing tool "${toolName}" with args:`, JSON.stringify(toolArgs));

      // Check if tool exists in static metadata first
      const metadata = getToolMetadata(toolName);

      if (metadata) {
        // Static tool found in metadata
        this.logger.log(`   → Found static tool in metadata: ${toolName}`);

        // Warn if trying to use a core tool via use_tool (not an error, just FYI)
        if (isCoreToolMetadata(toolName)) {
          this.logger.log(`ℹ️  Note: '${toolName}' is a core tool and can be called directly (not via use_tool)`);
        }

        // Validate required parameters based on metadata
        const missingParams: string[] = [];
        if (metadata.requiresDeviceId && !toolArgs.deviceId) {
          missingParams.push('deviceId');
        }
        if (metadata.requiresZoneId && !toolArgs.zoneId) {
          missingParams.push('zoneId');
        }

        if (missingParams.length > 0) {
          return this.createErrorResponse(
            `Missing required parameters for '${toolName}': ${missingParams.join(', ')}\n\n` +
              `Tool description: ${metadata.shortDescription}\n` +
              `Required: ${missingParams.join(', ')}`
          );
        }

        // Delegate to tool registry
        this.logger.log(`   → Delegating to tool registry for execution`);
        const result = await this.toolRegistry.execute(toolName, toolArgs);

        this.logger.log(`   ✓ Tool execution completed`);
        return result;
      }

      // Not in static metadata - check if it's a flow-based tool
      if (this.flowManager) {
        this.logger.log(`   → Not found in static metadata, checking flow-based tools...`);

        try {
          const flowTools = await this.flowManager.getToolsFromFlows();
          const flowTool = flowTools.find(tool => tool.name === toolName);

          if (flowTool) {
            this.logger.log(`   → Found flow-based tool: ${toolName}`);
            this.logger.log(`   → Routing to trigger_any_flow with command="${toolName}"`);

            // Route to trigger_any_flow
            const result = await this.toolRegistry.execute('trigger_any_flow', {
              command: toolName,
              parameters: toolArgs,
            });

            this.logger.log(`   ✓ Flow-based tool execution completed`);
            return result;
          }
        } catch (error) {
          this.logger.error('Error checking flow-based tools:', error);
          // Fall through to "tool not found" error below
        }
      }

      // Tool not found in either static metadata or flow-based tools
      return this.createErrorResponse(
        `Tool '${toolName}' not found. Use search_tools to discover available tools.\n\n` +
          'Example: search_tools({ query: "lights" })'
      );
    } catch (error) {
      this.logger.error('Error in use_tool:', error);
      return this.createErrorResponse(error as Error);
    }
  }
}
