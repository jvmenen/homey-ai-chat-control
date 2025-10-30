/**
 * Flow Manager - Handles Homey flow discovery and execution
 */

import type { HomeyAPIV3Local } from 'homey-api';
import { HomeyFlow, MCPTool, FlowExecutionResult, HomeyInstance } from '../types';
import { FlowParser } from '../parsers/flow-parser';
import { TOKEN_NAMES, MCP_TRIGGER_IDS } from '../constants';
import {
  IFlowManager,
  FlowOverviewData,
  FlowOverviewItem,
  FlowCardInfo,
  FlowOverviewOptions,
} from '../interfaces';

// FlowCardTrigger doesn't export properly, use any for now
type FlowCardTrigger = any;

// Type for flow card from Homey API
interface HomeyAPICard {
  id: string;
  type: string;
  uri?: string;
  args?: Record<string, unknown>;
  droptoken?: boolean | string; // Boolean: produces tokens, String: consumes token (e.g., "homey:device:id|capability")
  tokens?: Array<{ name: string; type?: string; title?: string }>;
}

// Type for flow objects from Homey API (simplified, as the actual type is complex)
interface HomeyAPIFlow {
  id?: string;
  name: string;
  enabled?: boolean;
  type?: string;
  trigger?: HomeyAPICard;
  cards?: Record<string, HomeyAPICard> | Array<HomeyAPICard>;
  [key: string]: unknown;
}

export class FlowManager implements IFlowManager {
  private homey: HomeyInstance;
  private homeyApi!: any; // HomeyAPIV3Local type doesn't include .flow property
  private initialized: boolean = false;
  private triggerCard: FlowCardTrigger;
  private availableCommands: Set<string> = new Set();
  // Cache parameter order per command for correct token mapping
  private commandParameterOrder: Map<string, string[]> = new Map();

  constructor(homey: HomeyInstance, triggerCard: FlowCardTrigger) {
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
    // Note: Case-insensitive type matching (String, string, NUMBER, etc.)
    const paramRegex = /^\s*(\w+):\s*(string|number|boolean)(?:\(([^)]+)\))?(\?)?\s*-\s*(.+)$/gim;
    let match;

    while ((match = paramRegex.exec(description)) !== null) {
      const [, paramName, paramType, validation, isOptional, paramDescription] = match;

      parameterNames.push(paramName);

      // Build property schema
      // Normalize type to lowercase (String -> string, NUMBER -> number, etc.)
      const propSchema: Record<string, unknown> = {
        type: paramType.toLowerCase(),
        description: paramDescription.trim(),
      };

      // Handle validation
      if (validation) {
        const normalizedType = paramType.toLowerCase();
        if (normalizedType === 'number') {
          // Parse range: "0-100" or "0-100.5"
          const rangeMatch = validation.match(/^([\d.]+)-([\d.]+)$/);
          if (rangeMatch) {
            propSchema.minimum = parseFloat(rangeMatch[1]);
            propSchema.maximum = parseFloat(rangeMatch[2]);
            this.homey.log(`   📝 Number range: ${propSchema.minimum}-${propSchema.maximum}`);
          }
        } else if (normalizedType === 'string') {
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
      this.homey.log(`State: ${JSON.stringify(state)}`);
      this.homey.log(`Tokens: ${JSON.stringify(tokens)}`);
      this.homey.log('Any flows listening for this command will now execute...');

      // Trigger with tokens (for flow usage) and state (for run listener matching)
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

  /**
   * Get complete flow overview (similar to getHomeStructure)
   * Returns all flows with cards, devices, and apps for AI analysis
   */
  async getFlowOverview(options: FlowOverviewOptions = {}): Promise<FlowOverviewData> {
    const { includeDisabled = false, deviceIds, folderPaths, appIds } = options;
    await this.init();

    try {
      this.homey.log('📋 Getting complete flow overview...');

      // Get both regular and advanced flows
      const regularFlows = await this.homeyApi.flow.getFlows();
      const advancedFlows = await this.homeyApi.flow.getAdvancedFlows();

      // Get all flow folders for name/path resolution
      const flowFolders = await this.homeyApi.flow.getFlowFolders();
      this.homey.log(`   Found ${Object.keys(flowFolders).length} flow folders`);

      // Get all devices for app ID lookup
      const devices = await this.homeyApi.devices.getDevices();
      const deviceToAppMap = new Map<string, string>();
      for (const [deviceId, device] of Object.entries(devices)) {
        const dev = device as any;
        // Extract app ID from driverId (format: homey:app:com.athom.hue:driver:bulb)
        if (dev.driverId) {
          const appMatch = dev.driverId.match(/homey:app:([^:]+)/);
          if (appMatch) {
            deviceToAppMap.set(deviceId, appMatch[1]);
          }
        }
      }

      // Build folder hierarchy map (folderId -> { name, parent, path })
      const folderMap = this.buildFolderHierarchy(flowFolders);

      // Combine and process all flows
      const allFlows = { ...regularFlows, ...advancedFlows };
      const flowItems: FlowOverviewItem[] = [];

      // Summary counters
      let totalCount = 0;
      let enabledCount = 0;
      let disabledCount = 0;
      let regularCount = 0;
      let advancedCount = 0;
      let mcpFlowCount = 0;

      for (const [flowId, flowData] of Object.entries(allFlows)) {
        const flow = flowData as HomeyAPIFlow;

        // Skip disabled flows if not requested
        const isEnabled = flow.enabled !== false;
        if (!isEnabled && !includeDisabled) {
          continue;
        }

        totalCount++;
        if (isEnabled) {
          enabledCount++;
        } else {
          disabledCount++;
        }

        // Determine flow type
        const isAdvanced = !!flow.cards;
        const flowType: 'regular' | 'advanced' = isAdvanced ? 'advanced' : 'regular';

        if (isAdvanced) {
          advancedCount++;
        } else {
          regularCount++;
        }

        // Check if this is an MCP trigger flow
        const mcpCommand = this.extractMCPCommand(flow);
        if (mcpCommand) {
          mcpFlowCount++;
        }

        // Extract cards
        const cards = this.extractFlowCards(flow);

        // Enrich cards with app ID from device lookup
        for (const card of cards) {
          if (card.deviceId && card.appId === 'unknown') {
            const appId = deviceToAppMap.get(card.deviceId);
            if (appId) {
              card.appId = appId;
            }
          }
        }

        // Extract folder information
        const folderId = (flow as any).folder;
        const folderInfo = folderId ? folderMap.get(folderId) : undefined;

        const flowItem: FlowOverviewItem = {
          id: flowId,
          name: flow.name,
          enabled: isEnabled,
          folder: folderId,
          folderName: folderInfo?.name,
          folderPath: folderInfo?.path,
          type: flowType,
          mcpCommand,
          cards,
        };

        // Apply filters
        if (!this.matchesFilters(flowItem, { deviceIds, folderPaths, appIds })) {
          continue;
        }

        flowItems.push(flowItem);
      }

      this.homey.log(`📋 Flow overview: ${totalCount} flows (${enabledCount} enabled, ${disabledCount} disabled, ${mcpFlowCount} MCP flows)`);

      return {
        flows: flowItems,
        summary: {
          total: totalCount,
          enabled: enabledCount,
          disabled: disabledCount,
          regular: regularCount,
          advanced: advancedCount,
          mcpFlows: mcpFlowCount,
        },
      };
    } catch (error) {
      this.homey.error('FlowManager: Error getting flow overview:', error);
      throw error;
    }
  }

  /**
   * Extract MCP command name from flow if it's an MCP trigger flow
   */
  private extractMCPCommand(flow: HomeyAPIFlow): string | undefined {
    // Check simple flow trigger
    if (flow.trigger && this.isMCPTrigger(flow.trigger.id)) {
      const command = flow.trigger.args?.command;
      return typeof command === 'string' ? command : undefined;
    }

    // Check advanced flow cards
    if (flow.cards) {
      const cardsArray = Array.isArray(flow.cards)
        ? flow.cards
        : Object.values(flow.cards);

      for (const card of cardsArray) {
        if (card.type === 'trigger' && card.id && this.isMCPTrigger(card.id)) {
          const command = card.args?.command;
          return typeof command === 'string' ? command : undefined;
        }
      }
    }

    return undefined;
  }

  /**
   * Check if a trigger ID is an MCP trigger
   */
  private isMCPTrigger(triggerId: string): boolean {
    return triggerId === MCP_TRIGGER_IDS.SHORT || triggerId === MCP_TRIGGER_IDS.FULL;
  }

  /**
   * Extract all cards from a flow (trigger, conditions, actions)
   */
  private extractFlowCards(flow: HomeyAPIFlow): FlowCardInfo[] {
    const cards: FlowCardInfo[] = [];

    // Handle simple flow (single trigger)
    if (flow.trigger) {
      const cardInfo = this.parseCard('trigger', flow.trigger);
      if (cardInfo) {
        cards.push(cardInfo);
      }
    }

    // Handle advanced flow (multiple cards)
    if (flow.cards) {
      const cardsArray = Array.isArray(flow.cards)
        ? flow.cards
        : Object.values(flow.cards);

      for (const card of cardsArray) {
        if (!card.id || !card.type) continue;

        const cardInfo = this.parseCard(card.type as any, card);
        if (cardInfo) {
          cards.push(cardInfo);
        }
      }
    }

    return cards;
  }

  /**
   * Parse a single card to extract app ID, card ID, and device info
   */
  private parseCard(
    type: 'trigger' | 'condition' | 'action',
    card: HomeyAPICard
  ): FlowCardInfo | null {
    const cardId = card.id;
    const uri = card.uri;
    const args = card.args;

    // Extract app ID from URI (format: homey:app:com.athom.hue:...)
    const appId = this.extractAppId(uri || cardId);

    // Extract device ID from args or URI/cardId
    const deviceId = this.extractDeviceId(args, uri || cardId);

    // Extract token information
    let droptoken: boolean | undefined = undefined;
    let tokens: Array<{ name: string; type?: string; title?: string }> | undefined = undefined;
    let tokenInput: { deviceId: string; capability: string } | undefined = undefined;

    // Parse droptoken - can be boolean (produces tokens) or string (consumes token)
    if (card.droptoken) {
      if (typeof card.droptoken === 'string') {
        // Droptoken is a string like "homey:device:ID|capability" - this card CONSUMES a token
        const match = card.droptoken.match(/homey:device:([^|]+)\|(.+)/);
        if (match) {
          tokenInput = {
            deviceId: match[1],
            capability: match[2],
          };
        }
      } else if (typeof card.droptoken === 'boolean') {
        // Droptoken is true - this card PRODUCES tokens
        droptoken = card.droptoken;
        tokens = card.tokens || undefined;
      }
    }

    return {
      type,
      appId,
      cardId,
      deviceId,
      args: args || undefined, // Include card arguments
      droptoken,
      tokens,
      tokenInput,
    };
  }

  /**
   * Extract app ID from URI or card ID
   * Examples:
   * - "homey:app:com.athom.hue:trigger:light_on" -> "com.athom.hue"
   * - "homey:manager:logic:gt" -> "homey:manager:logic" (system card)
   * - "com.athom.hue" -> "com.athom.hue"
   */
  private extractAppId(uriOrCardId: string): string {
    if (!uriOrCardId) {
      return 'unknown';
    }

    // Handle URI format: homey:app:com.athom.hue:...
    if (uriOrCardId.startsWith('homey:app:')) {
      const parts = uriOrCardId.split(':');
      if (parts.length >= 3) {
        return parts[2];
      }
    }

    // Handle system cards: homey:manager:logic:gt -> homey:manager:logic
    if (uriOrCardId.startsWith('homey:manager:')) {
      const parts = uriOrCardId.split(':');
      if (parts.length >= 3) {
        return `${parts[0]}:${parts[1]}:${parts[2]}`; // e.g., "homey:manager:logic"
      }
    }

    // Handle direct app ID format: com.athom.hue
    if (uriOrCardId.includes('.')) {
      const parts = uriOrCardId.split(':');
      return parts[0];
    }

    return 'unknown';
  }

  /**
   * Extract device ID from card arguments or URI/cardId
   * Common patterns: device, deviceId, deviceUri in args, or homey:device:ID in URI
   */
  private extractDeviceId(args?: Record<string, unknown>, uriOrCardId?: string): string | undefined {
    // First, try to extract from URI/cardId (format: homey:device:DEVICE_ID:...)
    if (uriOrCardId) {
      const deviceMatch = uriOrCardId.match(/homey:device:([^:]+)/);
      if (deviceMatch) {
        return deviceMatch[1];
      }
    }

    // Fallback to extracting from args
    if (!args) {
      return undefined;
    }

    // Try common device argument names
    const deviceValue = args.device || args.deviceId || args.deviceUri;

    if (typeof deviceValue === 'string') {
      return deviceValue;
    }

    // Device might be an object with an id property
    if (deviceValue && typeof deviceValue === 'object' && 'id' in deviceValue) {
      return (deviceValue as any).id;
    }

    return undefined;
  }

  /**
   * Build folder hierarchy map with names and full paths
   * Returns a map of folderId -> { name, parent, path }
   */
  private buildFolderHierarchy(flowFolders: Record<string, any>): Map<string, { name: string; parent: string | null; path: string }> {
    const folderMap = new Map<string, { name: string; parent: string | null; path: string }>();

    // First pass: store basic folder info
    for (const [folderId, folder] of Object.entries(flowFolders)) {
      folderMap.set(folderId, {
        name: folder.name || 'Unknown',
        parent: folder.parent || null,
        path: '', // Will be computed in second pass
      });
    }

    // Second pass: build full paths by walking up the hierarchy
    for (const [folderId, folderInfo] of folderMap.entries()) {
      const pathParts: string[] = [];
      let currentId: string | null = folderId;

      // Walk up the hierarchy to build the full path
      while (currentId) {
        const current = folderMap.get(currentId);
        if (!current) break;

        pathParts.unshift(current.name);
        currentId = current.parent;
      }

      // Update the path
      folderInfo.path = pathParts.join('/');
    }

    return folderMap;
  }

  /**
   * Check if a flow matches the given filters (OR logic within each filter type)
   * Returns true if flow passes all filter criteria (AND between filter types)
   */
  private matchesFilters(
    flow: FlowOverviewItem,
    filters: { deviceIds?: string[]; folderPaths?: string[]; appIds?: string[] }
  ): boolean {
    const { deviceIds, folderPaths, appIds } = filters;

    // Device filter: Flow must contain at least one of the specified devices
    if (deviceIds && deviceIds.length > 0) {
      const flowDeviceIds = flow.cards
        .map(card => card.deviceId)
        .filter((id): id is string => !!id);

      const hasMatchingDevice = deviceIds.some(filterId => flowDeviceIds.includes(filterId));
      if (!hasMatchingDevice) {
        return false;
      }
    }

    // Folder filter: Flow must be in one of the specified folders
    if (folderPaths && folderPaths.length > 0) {
      if (!flow.folderPath) {
        return false; // No folder = doesn't match
      }

      const hasMatchingFolder = folderPaths.some(filterPath =>
        flow.folderPath === filterPath
      );
      if (!hasMatchingFolder) {
        return false;
      }
    }

    // App filter: Flow must use at least one of the specified apps
    if (appIds && appIds.length > 0) {
      const flowAppIds = flow.cards.map(card => card.appId);

      const hasMatchingApp = appIds.some(filterId => flowAppIds.includes(filterId));
      if (!hasMatchingApp) {
        return false;
      }
    }

    // All filters passed (or no filters specified)
    return true;
  }
}
