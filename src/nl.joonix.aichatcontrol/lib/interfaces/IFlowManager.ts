/**
 * IFlowManager - Interface for Homey flow discovery and execution
 *
 * Purpose: Decouple flow management from concrete implementation
 * Responsibilities:
 * - Discover flows with MCP trigger cards
 * - Convert flows to MCP tools
 * - Trigger flows with parameters
 * - Manage command registry
 */

import { HomeyFlow, MCPTool, FlowExecutionResult } from '../types';

export interface IFlowManager {
  /**
   * Initialize the flow manager (setup HomeyAPI connection)
   */
  init(): Promise<void>;

  /**
   * Get all flows that start with 'mcp_' prefix
   */
  getMCPFlows(): Promise<HomeyFlow[]>;

  /**
   * Discover flows that use our MCP trigger card
   * Returns flow metadata including command names and parameters
   */
  discoverMCPFlows(): Promise<Array<{
    flowId: string;
    flowName: string;
    command: string;
    description?: string;
    parameters?: string;
  }>>;

  /**
   * Convert discovered MCP flows to MCP tool definitions
   * Parses parameter schemas from flow descriptions
   */
  getToolsFromFlows(): Promise<MCPTool[]>;

  /**
   * Get available MCP tools from registered commands (fallback)
   */
  getToolsFromCommands(): Promise<MCPTool[]>;

  /**
   * Trigger a flow command with parameters
   * @param toolName - The command name to trigger
   * @param parameters - Optional parameters to pass via tokens
   */
  triggerCommand(
    toolName: string,
    parameters?: Record<string, any>
  ): Promise<FlowExecutionResult>;

  /**
   * Register a command as available
   * @param command - The command name to register
   */
  registerCommand(command: string): void;

  /**
   * Get list of registered commands for autocomplete
   */
  getRegisteredCommands(): Array<{ name: string; description?: string }>;

  /**
   * Convert flow name to tool name
   * Example: "mcp_radio_toggle" -> "radio_toggle"
   */
  flowToToolName(flowName: string): string;

  /**
   * Convert tool name to flow name
   * Example: "radio_toggle" -> "mcp_radio_toggle"
   */
  toolNameToFlow(toolName: string): string;

  /**
   * Get flow details by tool name
   */
  getFlowByToolName(toolName: string): Promise<HomeyFlow | null>;

  /**
   * Get complete flow overview for all flows (similar to getHomeStructure)
   * Returns comprehensive flow data including cards, devices, apps for AI analysis
   * @param options - Filter options for flow overview
   */
  getFlowOverview(options?: FlowOverviewOptions): Promise<FlowOverviewData>;
}

/**
 * Options for filtering flow overview
 */
export interface FlowOverviewOptions {
  includeDisabled?: boolean;  // Include disabled flows (default: false)
  deviceIds?: string[];       // Filter by device IDs (OR logic - any match)
  folderPaths?: string[];     // Filter by folder paths (OR logic - any match)
  appIds?: string[];          // Filter by app IDs (OR logic - any match)
}

/**
 * Flow overview data structure (similar to HomeStructure)
 * Contains all flow information in a structured format for XML output
 */
export interface FlowOverviewData {
  flows: FlowOverviewItem[];
  summary: {
    total: number;
    enabled: number;
    disabled: number;
    regular: number;
    advanced: number;
    mcpFlows: number;
  };
}

/**
 * Single flow item in the overview
 */
export interface FlowOverviewItem {
  id: string;
  name: string;
  enabled: boolean;
  folder?: string; // Folder ID if flow is in a folder
  folderName?: string; // Human-readable folder name
  folderPath?: string; // Full folder path (e.g., "Home/Living Room")
  type: 'regular' | 'advanced';
  mcpCommand?: string; // If this is an MCP trigger flow
  cards: FlowCardInfo[];
}

/**
 * Flow card information
 */
export interface FlowCardInfo {
  type: 'trigger' | 'condition' | 'action';
  appId: string; // Extracted from URI
  cardId: string; // Card type ID
  deviceId?: string; // If card references a device
  deviceName?: string; // Optional device name for clarity
  args?: Record<string, unknown>; // Card arguments/parameters
  droptoken?: boolean; // Whether this card drops/provides tokens (for triggers)
  tokens?: Array<{ name: string; type?: string; title?: string }>; // Tokens provided by this card (for triggers)
  tokenInput?: { deviceId: string; capability: string }; // Token consumed by this card (for conditions/actions)
}
