/**
 * Flow Manager - Handles Homey flow discovery and execution
 */

import Homey from 'homey';
import type { HomeyAPI } from 'homey-api';
import { HomeyFlow, MCPTool, FlowExecutionResult } from '../types';
import { FlowParser } from '../parsers/flow-parser';
import { TOKEN_NAMES } from '../constants';
import { IFlowManager } from '../interfaces';

// Type for flow trigger card - use any due to Homey namespace type issues
type FlowTriggerCard = any; // eslint-disable-line @typescript-eslint/no-explicit-any

// Type for flow objects from Homey API (simplified, as the actual type is complex)
interface HomeyAPIFlow {
  id?: string;
  name: string;
  enabled?: boolean;
  type?: string;
  trigger?: {
    id: string;
    uri?: string;
    args?: Record<string, unknown>;
  };
  cards?: Record<string, {
    id?: string;
    type: string;
    uri?: string;
    args?: Record<string, unknown>;
  }> | Array<{
    id?: string;
    type: string;
    uri?: string;
    args?: Record<string, unknown>;
  }>;
  [key: string]: unknown;
}

export class FlowManager implements IFlowManager {
  private homey: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Homey type is a namespace
  private homeyApi!: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- HomeyAPI types are incomplete
  private initialized: boolean = false;
  private triggerCard: FlowTriggerCard;
  private availableCommands: Set<string> = new Set();
  // Cache parameter order per command for correct token mapping
  private commandParameterOrder: Map<string, string[]> = new Map();

  constructor(homey: any, triggerCard: FlowTriggerCard) {
    this.homey = homey;
    this.triggerCard = triggerCard;
  }

  /**
   * Initialize Homey API connection
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const { HomeyAPI } = require('homey-api');
      this.homeyApi = await HomeyAPI.createAppAPI({ homey: this.homey });
      this.initialized = true;
      this.homey.log('FlowManager: Homey API initialized');
    } catch (error) {
      this.homey.error('FlowManager: Failed to initialize Homey API:', error);
      throw error;
    }
  }

  /**
   * Get all flows that start with 'mcp_' prefix
   */
  async getMCPFlows(): Promise<HomeyFlow[]> {
    await this.init();

    try {
      const allFlows = await this.homeyApi.flow.getFlows();

      // Filter flows with mcp_ prefix
      const mcpFlows = (Object.values(allFlows) as HomeyAPIFlow[]).filter((flow) =>
        flow.name && flow.name.toLowerCase().startsWith('mcp_')
      ) as HomeyFlow[];

      this.homey.log(`FlowManager: Found ${mcpFlows.length} MCP flows`);
      return mcpFlows;
    } catch (error) {
      this.homey.error('FlowManager: Failed to get flows:', error);
      return [];
    }
  }

  /**
   * Convert Homey flow name to MCP tool name
   * Example: "mcp_radio_toggle" -> "radio_toggle"
   */
  flowToToolName(flowName: string): string {
    return flowName.toLowerCase().replace(/^mcp_/, '');
  }

  /**
   * Convert MCP tool name back to flow name
   * Example: "radio_toggle" -> "mcp_radio_toggle"
   */
  toolNameToFlow(toolName: string): string {
    return `mcp_${toolName}`;
  }

  /**
   * Discover flows that use our MCP trigger card
   */
  async discoverMCPFlows(): Promise<Array<{ flowId: string; flowName: string; command: string; description?: string; parameters?: string }>> {
    await this.init();

    try {
      this.homey.log('Discovering MCP flows...');

      // Get both regular flows AND advanced flows
      const regularFlows = await this.homeyApi.flow.getFlows();
      const advancedFlows = await this.homeyApi.flow.getAdvancedFlows();

      // Combine both types
      const allFlows = { ...regularFlows, ...advancedFlows };
      const totalFlowCount = Object.keys(allFlows).length;

      const mcpFlows: Array<{ flowId: string; flowName: string; command: string; description?: string }> = [];

      // Scan all flows for MCP triggers
      for (const [flowId, flow] of Object.entries(allFlows)) {
        const flowData = flow as HomeyAPIFlow;

        // Skip disabled flows
        if (flowData.enabled === false) {
          continue;
        }

        // Use FlowParser to extract MCP flow info (can return multiple for advanced flows)
        const parser = new FlowParser();
        const flowInfos = parser.parseFlow(flowData);

        if (flowInfos.length > 0) {
          for (const flowInfo of flowInfos) {
            mcpFlows.push(flowInfo);
            this.registerCommand(flowInfo.command);
          }
        }
      }

      this.homey.log(`Found ${mcpFlows.length} MCP flow(s) out of ${totalFlowCount} total flows`);

      return mcpFlows;
    } catch (error) {
      this.homey.error('FlowManager: Error discovering MCP flows:', error);
      return [];
    }
  }

  /**
   * Parse parameter definitions from flow description
   * Supports format: paramName: type(validation)? - description
   * Examples:
   *   streamUrl: string - Radio stream URL
   *   volume: number(0-100)? - Volume level (optional)
   *   mode: string(on|off) - Device mode
   */
  private parseParameters(description?: string): {
    properties: Record<string, unknown>;
    required: string[];
    parameterNames: string[];
  } {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    const parameterNames: string[] = [];

    if (!description) {
      return { properties, required, parameterNames };
    }

    // Match lines like: paramName: type(validation)? - description
    // Groups: 1=name, 2=type, 3=validation (optional), 4=optional marker (?), 5=description
    const paramRegex = /^\s*(\w+):\s*(string|number|boolean)(?:\(([^)]+)\))?(\?)?\s*-\s*(.+)$/gim;
    let match;

    while ((match = paramRegex.exec(description)) !== null) {
      const [, paramName, paramType, validation, isOptional, paramDescription] = match;

      parameterNames.push(paramName);

      // Build property schema
      const propSchema: Record<string, unknown> = {
        type: paramType,
        description: paramDescription.trim(),
      };

      // Handle validation
      if (validation) {
        if (paramType === 'number') {
          // Parse range: "0-100" or "0-100.5"
          const rangeMatch = validation.match(/^([\d.]+)-([\d.]+)$/);
          if (rangeMatch) {
            propSchema.minimum = parseFloat(rangeMatch[1]);
            propSchema.maximum = parseFloat(rangeMatch[2]);
            this.homey.log(`   📝 Number range: ${propSchema.minimum}-${propSchema.maximum}`);
          }
        } else if (paramType === 'string') {
          // Parse enum: "on|off|auto"
          const enumValues = validation.split('|').map(v => v.trim());
          propSchema.enum = enumValues;
          this.homey.log(`   📝 String enum: ${enumValues.join(', ')}`);
        }
      }

      properties[paramName] = propSchema;

      // Required by default, unless marked with ?
      if (!isOptional) {
        required.push(paramName);
      }

      const optionalMarker = isOptional ? ' (optional)' : ' (required)';
      const validationInfo = validation ? ` [${validation}]` : '';
      this.homey.log(`   📝 Parsed param: ${paramName} (${paramType}${validationInfo})${optionalMarker} - ${paramDescription}`);
    }

    return { properties, required, parameterNames };
  }

  /**
   * Get available MCP tools from discovered flows
   */
  async getToolsFromFlows(): Promise<MCPTool[]> {
    const mcpFlows = await this.discoverMCPFlows();

    return mcpFlows.map((flow) => {
      // Parse parameters from flow parameters field
      const { properties, required, parameterNames } = this.parseParameters(flow.parameters);

      // Cache parameter order for this command (for correct token mapping later)
      if (parameterNames.length > 0) {
        this.commandParameterOrder.set(flow.command, parameterNames);
        this.homey.log(`📋 Cached parameter order for "${flow.command}": [${parameterNames.join(', ')}]`);
      }

      const hasParams = Object.keys(properties).length > 0;
      const paramInfo = hasParams
        ? ` (params: ${parameterNames.join(', ')})`
        : '';

      // Add info about token mapping
      let tokenMapping = '';
      if (parameterNames.length > 0) {
        const mappings = parameterNames.map((name, idx) => `${name}=[[value${idx + 1}]]`);
        tokenMapping = ` Token mapping: ${mappings.join(', ')}`;
      }

      // Build tool description
      let toolDescription = flow.description || `Trigger flow "${flow.flowName}"`;
      if (paramInfo) {
        toolDescription += paramInfo;
      }
      if (tokenMapping) {
        toolDescription += `. ${tokenMapping}`;
      }

      return {
        name: flow.command,
        description: toolDescription,
        inputSchema: {
          type: 'object' as const,
          properties,
          required,
        },
      };
    });
  }

  /**
   * Get available MCP tools from registered commands (fallback)
   */
  async getToolsFromCommands(): Promise<MCPTool[]> {
    // Return registered commands as tools
    const commands = Array.from(this.availableCommands);

    return commands.map((command) => ({
      name: command,
      description: `Trigger the '${command}' command in Homey flows`,
      inputSchema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    }));
  }

  /**
   * Register a command as available
   */
  registerCommand(command: string): void {
    this.availableCommands.add(command);
  }

  /**
   * Get list of registered commands for autocomplete
   */
  getRegisteredCommands(): Array<{ name: string; description?: string }> {
    return Array.from(this.availableCommands).map((cmd) => ({
      name: cmd,
    }));
  }

  /**
   * Trigger MCP command flow card
   */
  async triggerCommand(
    toolName: string,
    parameters?: Record<string, any>
  ): Promise<FlowExecutionResult> {
    try {
      this.homey.log('========================================');
      this.homey.log(`FlowManager: Triggering command: "${toolName}"`);
      if (parameters && Object.keys(parameters).length > 0) {
        this.homey.log('Parameters:', JSON.stringify(parameters));
      } else {
        this.homey.log('Parameters: (none)');
      }

      // Register command for autocomplete
      const wasNewCommand = !this.availableCommands.has(toolName);
      this.registerCommand(toolName);

      if (wasNewCommand) {
        this.homey.log(`✓ Command "${toolName}" registered for first time (will appear in autocomplete)`);
      }

      // Map parameters to value1, value2, etc. tokens
      // IMPORTANT: Always provide ALL tokens (value1-5), even if empty
      // Homey expects all defined tokens to have a value
      const tokens: Record<string, any> = {
        [TOKEN_NAMES.COMMAND]: toolName,
        [TOKEN_NAMES.VALUE_1]: '',
        [TOKEN_NAMES.VALUE_2]: '',
        [TOKEN_NAMES.VALUE_3]: '',
        [TOKEN_NAMES.VALUE_4]: '',
        [TOKEN_NAMES.VALUE_5]: '',
      };

      if (parameters && Object.keys(parameters).length > 0) {
        // Use cached parameter order if available to ensure correct mapping
        const parameterOrder = this.commandParameterOrder.get(toolName);

        if (parameterOrder && parameterOrder.length > 0) {
          // Use the defined order from flow description
          this.homey.log(`   Using parameter order: [${parameterOrder.join(', ')}]`);
          parameterOrder.forEach((paramName, index) => {
            if (index < 5 && parameters[paramName] !== undefined) {
              const tokenName = this.getTokenName(index);
              tokens[tokenName] = String(parameters[paramName]);
              this.homey.log(`   Token mapping: [[${tokenName}]] = "${paramName}" = "${parameters[paramName]}"`);
            }
          });
        } else {
          // Fallback to Object.values order (may be unpredictable)
          this.homey.log(`   ⚠️  No cached parameter order found, using object key order`);
          const paramValues = Object.values(parameters);
          paramValues.forEach((value, index) => {
            if (index < 5) {
              const tokenName = this.getTokenName(index);
              tokens[tokenName] = String(value);
              this.homey.log(`   Token mapping: [[${tokenName}]] = "${value}"`);
            }
          });
        }
      }

      const state = {
        command: toolName,
      };

      this.homey.log(`Triggering flow card "ai_tool_call" with command="${toolName}"`);
      this.homey.log(`Tokens: ${JSON.stringify(tokens)}`);
      this.homey.log('Any flows listening for this command will now execute...');

      await this.triggerCard.trigger(tokens, state);

      this.homey.log(`✓ Flow card triggered successfully for command: "${toolName}"`);
      this.homey.log('========================================');

      return {
        success: true,
        message: `Command '${toolName}' triggered successfully`,
      };
    } catch (error) {
      this.homey.error('========================================');
      this.homey.error(`✗ FlowManager: Failed to trigger command "${toolName}"`);
      this.homey.error('Error:', error);
      this.homey.error('========================================');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get flow details by tool name
   */
  async getFlowByToolName(toolName: string): Promise<HomeyFlow | null> {
    await this.init();

    const flowName = this.toolNameToFlow(toolName);

    try {
      const flows = await this.homeyApi.flow.getFlows();
      const flow = (Object.values(flows) as HomeyAPIFlow[]).find(
        (f) => f.name.toLowerCase() === flowName.toLowerCase()
      ) as HomeyFlow | undefined;

      return flow || null;
    } catch (error) {
      this.homey.error(`FlowManager: Failed to get flow ${flowName}:`, error);
      return null;
    }
  }

  /**
   * Get token name for parameter index (value1-value5)
   */
  private getTokenName(index: number): string {
    const tokenNames = [
      TOKEN_NAMES.VALUE_1,
      TOKEN_NAMES.VALUE_2,
      TOKEN_NAMES.VALUE_3,
      TOKEN_NAMES.VALUE_4,
      TOKEN_NAMES.VALUE_5,
    ];
    return tokenNames[index] || `value${index + 1}`;
  }
}
