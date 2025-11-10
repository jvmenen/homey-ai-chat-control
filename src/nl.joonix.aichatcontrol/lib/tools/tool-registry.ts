/**
 * Tool Registry - Central management for all MCP tools
 *
 * Supports progressive disclosure pattern:
 * - Core tools: Always in tools/list (frequently used, foundational)
 * - Meta tools: Discovery tools (search_tools, use_tool)
 * - Discovered tools: Hidden from tools/list, accessible via meta tools
 */

import { MCPTool, MCPToolCallResult } from '../types';
import { MCPToolHandler } from './base-tool';
import { ToolNotFoundError, HomeyMCPError } from '../utils/errors';
import { isCoreToolMetadata } from './tool-metadata';

/**
 * Registry for managing MCP tool handlers
 * Provides centralized tool registration and execution
 */
export class ToolRegistry {
  private tools: Map<string, MCPToolHandler> = new Map();
  private metaTools: Set<string> = new Set(); // search_tools, use_tool

  /**
   * Register a tool handler
   * @param tool - Tool handler to register
   * @throws Error if tool with same name already exists
   */
  register(tool: MCPToolHandler): void {
    if (this.tools.has(tool.name)) {
      throw new HomeyMCPError(`Tool '${tool.name}' is already registered`, 'TOOL_ALREADY_REGISTERED');
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Register a meta tool (discovery tools like search_tools, use_tool)
   * Meta tools are always included in tools/list
   */
  registerMeta(tool: MCPToolHandler): void {
    this.register(tool);
    this.metaTools.add(tool.name);
  }

  /**
   * Get tool definitions for MCP tools/list response
   * Returns only core tools + meta tools (progressive disclosure)
   */
  getAllDefinitions(): MCPTool[] {
    const definitions: MCPTool[] = [];

    for (const [name, tool] of this.tools.entries()) {
      // Include if it's a core tool (based on metadata) or a meta tool
      if (isCoreToolMetadata(name) || this.metaTools.has(name)) {
        definitions.push(tool.getDefinition());
      }
    }

    return definitions;
  }

  /**
   * Get ALL tool definitions including discovered/hidden tools
   * Used for internal purposes, not for tools/list
   */
  getAllToolsIncludingHidden(): MCPTool[] {
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
