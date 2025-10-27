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
}
