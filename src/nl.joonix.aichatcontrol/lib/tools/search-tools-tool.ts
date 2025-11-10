/**
 * Search Tools Tool - Progressive disclosure tool discovery
 */

import { BaseTool } from './base-tool';
import { MCPTool, MCPToolCallResult } from '../types';
import { searchTools, ToolMetadata } from './tool-metadata';

/**
 * Arguments for search_tools
 */
export interface SearchToolsArgs {
  query: string;
  category?: 'core' | 'control' | 'query' | 'insights' | 'flows' | 'apps';
}

/**
 * Tool: search_tools
 * Discover available Homey tools by query
 */
export class SearchToolsTool extends BaseTool {
  readonly name = 'search_tools';

  getDefinition(): MCPTool {
    return {
      name: 'search_tools',
      description:
        'Search for available Homey control and query tools. ' +
        'Use this to discover tools for specific tasks before using them. ' +
        '\n\n' +
        'WHEN TO USE:\n' +
        '- When you need to control devices but don\'t know which tool to use\n' +
        '- When looking for specific functionality (e.g., "lights", "temperature")\n' +
        '- To explore what tools are available for a category\n' +
        '\n' +
        'EXAMPLES:\n' +
        '- search_tools({ query: "lights" }) → finds set_light, control_zone_lights\n' +
        '- search_tools({ query: "temperature" }) → finds set_thermostat, control_device\n' +
        '- search_tools({ query: "insights" }) → finds get_insight_logs, get_insight_data\n' +
        '- search_tools({ category: "control" }) → lists all control tools\n' +
        '\n' +
        'RETURNS: Tool names, descriptions, and tags. Use use_tool to execute them.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Search query to find tools (e.g., "lights", "temperature", "flows"). ' +
              'Searches in tool names, descriptions, and tags.',
          },
          category: {
            type: 'string',
            enum: ['core', 'control', 'query', 'insights', 'flows', 'apps'],
            description:
              'Optional: Filter by tool category. ' +
              'control=device/zone control, insights=historical data, flows=automation.',
          },
        },
        required: ['query'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    try {
      const typedArgs = args as unknown as SearchToolsArgs;

      // Validate query
      if (!typedArgs.query || typedArgs.query.trim().length === 0) {
        return this.createErrorResponse('Query parameter is required and cannot be empty');
      }

      // Search through metadata
      const results = searchTools(typedArgs.query, typedArgs.category);

      if (results.length === 0) {
        return this.createSuccessResponse(
          `No tools found matching query "${typedArgs.query}"${
            typedArgs.category ? ` in category "${typedArgs.category}"` : ''
          }.\n\n` +
            'Try:\n' +
            '- Broader search terms (e.g., "light" instead of "brightness")\n' +
            '- Different category\n' +
            '- Removing category filter'
        );
      }

      // Format results
      const formatted = this.formatSearchResults(results, typedArgs.query);
      return this.createSuccessResponse(formatted);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred while searching tools';
      return this.createErrorResponse(errorMessage);
    }
  }

  /**
   * Format search results as readable text
   */
  private formatSearchResults(results: ToolMetadata[], query: string): string {
    let output = `🔍 Found ${results.length} tool${results.length === 1 ? '' : 's'} matching "${query}"\n\n`;

    // Group by category
    const byCategory = results.reduce(
      (acc, tool) => {
        if (!acc[tool.category]) {
          acc[tool.category] = [];
        }
        acc[tool.category].push(tool);
        return acc;
      },
      {} as Record<string, ToolMetadata[]>
    );

    // Format each category
    for (const [category, tools] of Object.entries(byCategory)) {
      output += `📂 ${category.toUpperCase()}\n`;

      for (const tool of tools) {
        output += `\n• ${tool.name}\n`;
        output += `  ${tool.shortDescription}\n`;

        // Add requirement hints
        const requirements: string[] = [];
        if (tool.requiresDeviceId) requirements.push('deviceId');
        if (tool.requiresZoneId) requirements.push('zoneId');
        if (requirements.length > 0) {
          output += `  Requires: ${requirements.join(', ')}\n`;
        }

        output += `  Tags: ${tool.tags.join(', ')}\n`;
      }

      output += '\n';
    }

    output +=
      '💡 NEXT STEP: Use the use_tool tool to execute any of these tools.\n' +
      '   Example: use_tool({ name: "set_light", arguments: { ... } })';

    return output;
  }
}
