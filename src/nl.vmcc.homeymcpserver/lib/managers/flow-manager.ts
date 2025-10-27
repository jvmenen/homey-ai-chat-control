/**
 * Flow Manager - Handles Homey flow discovery and execution
 */

import { HomeyFlow, MCPTool, FlowExecutionResult } from '../types';
import { FlowParser } from '../parsers/flow-parser';
import { TOKEN_NAMES } from '../constants';

export class FlowManager {
  private homey: any;
  private homeyApi: any;
  private initialized: boolean = false;
  private triggerCard: any;
  private availableCommands: Set<string> = new Set();
  // Cache parameter order per command for correct token mapping
  private commandParameterOrder: Map<string, string[]> = new Map();

  constructor(homey: any, triggerCard: any) {
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
      const mcpFlows = Object.values(allFlows).filter((flow: any) =>
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
      this.homey.log('╔════════════════════════════════════════════════════════════════════╗');
      this.homey.log('║           STARTING MCP FLOW DISCOVERY                              ║');
      this.homey.log('╚════════════════════════════════════════════════════════════════════╝');

      // Get both regular flows AND advanced flows
      this.homey.log('📡 Fetching regular flows...');
      const regularFlows = await this.homeyApi.flow.getFlows();
      const regularFlowCount = Object.keys(regularFlows).length;
      this.homey.log(`   ✓ Found ${regularFlowCount} regular flows`);

      this.homey.log('📡 Fetching advanced flows...');
      const advancedFlows = await this.homeyApi.flow.getAdvancedFlows();
      const advancedFlowCount = Object.keys(advancedFlows).length;
      this.homey.log(`   ✓ Found ${advancedFlowCount} advanced flows`);

      // Combine both types
      const allFlows = { ...regularFlows, ...advancedFlows };
      const totalFlowCount = Object.keys(allFlows).length;

      this.homey.log('');
      this.homey.log(`📊 Total flows: ${totalFlowCount} (${regularFlowCount} regular + ${advancedFlowCount} advanced)`);
      this.homey.log('');

      const mcpFlows: Array<{ flowId: string; flowName: string; command: string; description?: string }> = [];

      // Log first flow structure for debugging
      const firstFlow = Object.values(allFlows)[0];
      if (firstFlow) {
        this.homey.log('┌─── FLOW STRUCTURE ANALYSIS ───────────────────────────────────────┐');
        this.homey.log('│ Analyzing first flow to understand structure...                  │');
        this.homey.log('└───────────────────────────────────────────────────────────────────┘');

        const firstFlowData = firstFlow as any;
        this.homey.log(`  📋 Flow name: "${firstFlowData.name}"`);
        this.homey.log(`  🆔 Flow ID: ${Object.keys(allFlows)[0]}`);
        this.homey.log(`  🏷️  Flow type: ${firstFlowData.type || 'unknown'}`);
        this.homey.log(`  📌 Enabled: ${firstFlowData.enabled !== false ? 'Yes' : 'No'}`);
        this.homey.log(`  🔑 Properties: ${Object.keys(firstFlowData).join(', ')}`);

        if (firstFlowData.trigger) {
          this.homey.log(`  ✓ Has 'trigger' property (Simple Flow)`);
          this.homey.log(`    - Trigger ID: ${firstFlowData.trigger.id}`);
          this.homey.log(`    - Trigger URI: ${firstFlowData.trigger.uri || 'N/A'}`);
          if (firstFlowData.trigger.args) {
            this.homey.log(`    - Trigger args: ${JSON.stringify(Object.keys(firstFlowData.trigger.args))}`);
          }
        } else {
          this.homey.log(`  ✗ No 'trigger' property`);
        }

        if (firstFlowData.cards) {
          this.homey.log(`  ✓ Has 'cards' property (Advanced Flow)`);
          this.homey.log(`    - Cards type: ${Array.isArray(firstFlowData.cards) ? 'Array' : 'Object'}`);

          if (Array.isArray(firstFlowData.cards)) {
            this.homey.log(`    - Cards count: ${firstFlowData.cards.length}`);
            this.homey.log(`    - Card types: ${firstFlowData.cards.map((c: any) => c.type).join(', ')}`);
          } else {
            const cardKeys = Object.keys(firstFlowData.cards);
            this.homey.log(`    - Cards count: ${cardKeys.length}`);
            this.homey.log(`    - Card IDs: ${cardKeys.slice(0, 3).join(', ')}${cardKeys.length > 3 ? '...' : ''}`);

            // Show types of first few cards
            const cardTypes = Object.values(firstFlowData.cards)
              .slice(0, 5)
              .map((c: any) => c.type)
              .filter(Boolean);
            if (cardTypes.length > 0) {
              this.homey.log(`    - Card types (sample): ${cardTypes.join(', ')}`);
            }
          }
        } else {
          this.homey.log(`  ✗ No 'cards' property`);
        }
        this.homey.log('');
      }

      this.homey.log('┌─── SCANNING ALL FLOWS ────────────────────────────────────────────┐');
      this.homey.log('│ Looking for flows with MCP trigger card...                       │');
      this.homey.log('└───────────────────────────────────────────────────────────────────┘');

      let flowIndex = 0;
      for (const [flowId, flow] of Object.entries(allFlows)) {
        flowIndex++;
        const flowData = flow as any;
        const flowName = flowData.name || 'Unnamed flow';

        // Determine if this is a regular or advanced flow
        const isAdvancedFlow = flowId in advancedFlows;
        const flowTypeLabel = isAdvancedFlow ? '🔷 Advanced' : '📄 Regular';

        this.homey.log(`\n[${flowIndex}/${totalFlowCount}] 🔍 Scanning: "${flowName}" (${flowId.substring(0, 8)}...) ${flowTypeLabel}`);

        // Check if flow is enabled
        if (flowData.enabled === false) {
          this.homey.log(`    ⏸️  Flow is DISABLED - skipping`);
          continue;
        }

        // Use FlowParser to extract MCP flow info (can return multiple for advanced flows)
        const parser = new FlowParser();
        const flowInfos = parser.parseFlow(flowData);

        if (flowInfos.length > 0) {
          if (flowInfos.length === 1) {
            this.homey.log(`    ✅ MATCH! Found MCP trigger with command "${flowInfos[0].command}"`);
          } else {
            this.homey.log(`    ✅ MATCH! Found ${flowInfos.length} MCP triggers in this advanced flow`);
          }

          for (const flowInfo of flowInfos) {
            if (flowInfos.length > 1) {
              this.homey.log(`       → Command: "${flowInfo.command}"${flowInfo.cardId ? ` (card: ${flowInfo.cardId.substring(0, 8)}...)` : ''}`);
            }

            mcpFlows.push(flowInfo);
            this.registerCommand(flowInfo.command);

            if (flowInfo.description) {
              this.homey.log(`    📝 Parameter definition: ${flowInfo.description}`);
            }
          }
        } else {
          // Log flow type for debugging
          if (flowData.trigger) {
            this.homey.log(`    ↪️  Simple flow with different trigger: ${flowData.trigger.id}`);
          } else if (flowData.cards) {
            this.homey.log(`    ↪️  Advanced flow without MCP trigger`);
          } else {
            this.homey.log(`    ⚠️  WARNING: Flow has neither 'trigger' nor 'cards' property!`);
            this.homey.log(`    📋 Flow properties: ${Object.keys(flowData).join(', ')}`);
          }
        }
      }

      this.homey.log('');
      this.homey.log('╔════════════════════════════════════════════════════════════════════╗');
      this.homey.log('║           FLOW DISCOVERY COMPLETE                                  ║');
      this.homey.log('╚════════════════════════════════════════════════════════════════════╝');
      this.homey.log(`✅ Found ${mcpFlows.length} flow(s) with MCP triggers out of ${totalFlowCount} total flows`);
      this.homey.log(`   (Scanned: ${regularFlowCount} regular + ${advancedFlowCount} advanced)`);

      if (mcpFlows.length > 0) {
        this.homey.log('\n📋 Summary of discovered MCP flows:');
        mcpFlows.forEach((flow, index) => {
          const isAdvanced = flow.flowId in advancedFlows;
          const typeLabel = isAdvanced ? '🔷 Advanced' : '📄 Regular';
          this.homey.log(`   ${index + 1}. "${flow.flowName}" ${typeLabel}`);
          this.homey.log(`      Command: ${flow.command}`);
          this.homey.log(`      Flow ID: ${flow.flowId}`);
        });
      } else {
        this.homey.log('\n⚠️  No flows found using the MCP trigger card!');
        this.homey.log('   To create an MCP flow:');
        this.homey.log('   1. Open the Homey app');
        this.homey.log('   2. Create a new flow (regular or advanced)');
        this.homey.log('   3. Add trigger: "MCP command received"');
        this.homey.log('   4. Configure a command name');
        this.homey.log('   5. Add your desired actions');
      }

      this.homey.log('');
      return mcpFlows;
    } catch (error) {
      this.homey.error('╔════════════════════════════════════════════════════════════════════╗');
      this.homey.error('║           ERROR IN FLOW DISCOVERY                                  ║');
      this.homey.error('╚════════════════════════════════════════════════════════════════════╝');
      this.homey.error('❌ FlowManager: Error discovering MCP flows:', error);
      this.homey.error('Stack trace:', (error as Error).stack);
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
    properties: Record<string, any>;
    required: string[];
    parameterNames: string[];
  } {
    const properties: Record<string, any> = {};
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
      const propSchema: any = {
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

      this.homey.log(`Triggering flow card "mcp_command_received" with command="${toolName}"`);
      this.homey.log(`Tokens: ${JSON.stringify(tokens)}`);
      this.homey.log('Any flows listening for this command will now execute...');

      await this.triggerCard.trigger(tokens, state);

      this.homey.log(`✓ Flow card triggered successfully for command: "${toolName}"`);
      this.homey.log('========================================');

      return {
        success: true,
        message: `Command '${toolName}' triggered successfully`,
      };
    } catch (error: any) {
      this.homey.error('========================================');
      this.homey.error(`✗ FlowManager: Failed to trigger command "${toolName}"`);
      this.homey.error('Error:', error);
      this.homey.error('========================================');
      return {
        success: false,
        error: error.message || 'Unknown error',
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
      const flow = Object.values(flows).find(
        (f: any) => f.name.toLowerCase() === flowName.toLowerCase()
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
