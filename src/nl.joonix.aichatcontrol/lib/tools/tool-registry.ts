/**
 * Tool Registry - Central management for all MCP tools
 */

import { MCPTool, MCPToolCallResult } from '../types';
import { MCPToolHandler } from './base-tool';
import { ToolNotFoundError } from '../utils/errors';

/**
 * Registry for managing MCP tool handlers
 * Provides centralized tool registration and execution
 */
export class ToolRegistry {
  private tools: Map<string, MCPToolHandler> = new Map();

  /**
   * Register a tool handler
   * @param tool - Tool handler to register
   * @throws Error if tool with same name already exists
   */
  register(tool: MCPToolHandler): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Get all registered tool definitions
   * Used for MCP tools/list response
   */
  getAllDefinitions(): MCPTool[] {
    return Array.from(this.tools.values()).map((tool) => tool.getDefinition());
  }

  /**
   * Execute a tool by name
   * @param name - Tool name to execute
   * @param args - Arguments to pass to the tool
   * @returns Tool execution result
   * @throws Error if tool not found
   */
  async execute(name: string, args: Record<string, unknown>): Promise<MCPToolCallResult> {
    const tool = this.tools.get(name);

    if (!tool) {
      throw new ToolNotFoundError(name);
    }

    try {
      return await tool.execute(args);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // Return formatted error response
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error executing tool '${name}': ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Check if a tool is registered
   * @param name - Tool name to check
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get count of registered tools
   */
  count(): number {
    return this.tools.size;
  }

  /**
   * Get all registered tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }
}
