/**
 * Base Tool - Foundation for all MCP tool handlers
 */

import { MCPTool, MCPToolCallResult } from '../types';

/**
 * Interface that all MCP tool handlers must implement
 */
export interface MCPToolHandler {
  /** Unique tool name (e.g., 'get_home_structure') */
  readonly name: string;

  /**
   * Get the MCP tool definition (name, description, input schema)
   * This is used for the tools/list response
   */
  getDefinition(): MCPTool;

  /**
   * Execute the tool with given arguments
   * @param args - Arguments from MCP tools/call request
   * @returns Tool execution result with content array
   */
  execute(args: any): Promise<MCPToolCallResult>;
}

/**
 * Abstract base class for tool implementations
 * Provides common functionality like response formatting
 */
export abstract class BaseTool implements MCPToolHandler {
  abstract readonly name: string;
  abstract getDefinition(): MCPTool;
  abstract execute(args: any): Promise<MCPToolCallResult>;

  /**
   * Create a successful tool response
   * @param text - Response text to send to the client
   */
  protected createSuccessResponse(text: string): MCPToolCallResult {
    return {
      content: [
        {
          type: 'text',
          text,
        },
      ],
    };
  }

  /**
   * Create an error tool response
   * @param error - Error object or message
   */
  protected createErrorResponse(error: Error | string): MCPToolCallResult {
    const message = error instanceof Error ? error.message : error;
    return {
      content: [
        {
          type: 'text',
          text: `❌ Error: ${message}`,
        },
      ],
      isError: true,
    };
  }

  /**
   * Helper to validate required arguments
   * @param args - Arguments object
   * @param required - Array of required argument names
   * @throws Error if any required argument is missing
   */
  protected validateRequiredArgs(args: any, required: string[]): void {
    const missing = required.filter(
      (name) => args[name] === undefined || args[name] === null
    );

    if (missing.length > 0) {
      throw new Error(`Missing required arguments: ${missing.join(', ')}`);
    }
  }
}
