/**
 * Search Tools Tool - Progressive disclosure tool discovery
 */

import { BaseTool } from './base-tool';
import { MCPTool, MCPToolCallResult, HomeyInstance } from '../types';
import { searchTools, ToolMetadata } from './tool-metadata';
import { FlowManager } from '../managers/flow-manager';
import { ToolRegistry } from './tool-registry';
import { Logger } from '../utils/logger';

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
  private logger: Logger;

  constructor(
    private homey: HomeyInstance,
    private toolRegistry: ToolRegistry,
    private flowManager?: FlowManager
  ) {
    super();
    this.logger = new Logger(homey, 'SearchToolsTool');
  }

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
        'SEARCH BEHAVIOR:\n' +
        '- Query is split into individual words\n' +
        '- Matches if ANY word appears in tool name or description\n' +
        '- Case-insensitive matching\n' +
        '\n' +
        'MULTILINGUAL TIP:\n' +
        '- Tools may be in different languages (English, Dutch, etc.)\n' +
        '- For best results, include BOTH English AND user language terms\n' +
        '- Example: "lights lampen" (English + Dutch) or "temperature temperatuur"\n' +
        '- This ensures you find both built-in tools (often English) and custom flows (user language)\n' +
        '\n' +
        'EXAMPLES:\n' +
        '- search_tools({ query: "lights" }) → finds set_light, control_zone_lights\n' +
        '- search_tools({ query: "lights lampen" }) → finds both English and Dutch tools\n' +
        '- search_tools({ query: "temperature temp" }) → broader search\n' +
        '- search_tools({ query: "radio speaker audio" }) → matches ANY of these words\n' +
        '- search_tools({ category: "control" }) → lists all control tools\n' +
        '\n' +
        'RETURNS: Tool names, descriptions, and full parameter schemas. Use use_tool to execute them.',
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

      // Search through static tool metadata
      const results = searchTools(typedArgs.query, typedArgs.category);

      // Also search flow-based tools if FlowManager is available
      let flowResults: Array<{ name: string; description: string; category: 'flows' }> = [];
      if (this.flowManager) {
        try {
          const flowTools = await this.flowManager.getToolsFromFlows();

          // Split query into words for flexible matching
          const queryWords = typedArgs.query.toLowerCase().split(/\s+/).filter(w => w.length > 0);

          flowResults = flowTools
            .filter((tool) => {
              // Category filter
              if (typedArgs.category && typedArgs.category !== 'flows') {
                return false;
              }

              // Word-based search: match if ANY query word appears in name or description
              const searchText = `${tool.name} ${tool.description}`.toLowerCase();
              return queryWords.some(word => searchText.includes(word));
            })
            .map((tool) => ({
              name: tool.name,
              description: tool.description,
              category: 'flows' as const,
            }));
        } catch (error) {
          this.logger.error('Error searching flow-based tools:', error);
          // Continue with just static tools if flow search fails
        }
      }

      const totalResults = results.length + flowResults.length;

      if (totalResults === 0) {
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
      const formatted = await this.formatSearchResults(results, flowResults, typedArgs.query);
      return this.createSuccessResponse(formatted);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred while searching tools';
      return this.createErrorResponse(errorMessage);
    }
  }

  /**
   * Format search results as readable text
   */
  private async formatSearchResults(
    results: ToolMetadata[],
    flowResults: Array<{ name: string; description: string; category: 'flows' }>,
    query: string
  ): Promise<string> {
    const totalResults = results.length + flowResults.length;
    let output = `🔍 Found ${totalResults} tool${totalResults === 1 ? '' : 's'} matching "${query}"\n\n`;

    // Group static tools by category
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

    // Format each category (static tools)
    for (const [category, tools] of Object.entries(byCategory)) {
      output += `📂 ${category.toUpperCase()}\n`;

      for (const tool of tools) {
        output += `\n• ${tool.name}\n`;
        output += `  ${tool.shortDescription}\n`;

        // Get and show full parameter schema
        const fullDefinition = this.toolRegistry.getToolDefinition(tool.name);
        if (fullDefinition?.inputSchema) {
          output += this.formatInputSchema(fullDefinition.inputSchema);
        } else {
          // Fallback to old format if no schema available
          const requirements: string[] = [];
          if (tool.requiresDeviceId) requirements.push('deviceId');
          if (tool.requiresZoneId) requirements.push('zoneId');
          if (requirements.length > 0) {
            output += `  Requires: ${requirements.join(', ')}\n`;
          }
        }

        output += `  Tags: ${tool.tags.join(', ')}\n`;
      }

      output += '\n';
    }

    // Format flow-based tools separately
    if (flowResults.length > 0) {
      output += `📂 FLOWS (Custom flow-based tools)\n`;

      // Get flow tools to access their full schemas
      let flowToolsMap: Map<string, MCPTool> = new Map();
      if (this.flowManager) {
        try {
          const flowTools = await this.flowManager.getToolsFromFlows();
          flowTools.forEach(tool => flowToolsMap.set(tool.name, tool));
        } catch (error) {
          this.logger.error('Error fetching flow tool schemas:', error);
        }
      }

      for (const tool of flowResults) {
        output += `\n• ${tool.name}\n`;
        output += `  ${tool.description}\n`;

        // Show parameter schema if available
        const fullFlowTool = flowToolsMap.get(tool.name);
        if (fullFlowTool?.inputSchema) {
          output += this.formatInputSchema(fullFlowTool.inputSchema);
        }
      }

      output += '\n';
    }

    output +=
      '💡 NEXT STEP: Use the use_tool tool to execute any of these tools.\n' +
      '   Example: use_tool({ name: "set_light", arguments: { ... } })';

    return output;
  }

  /**
   * Format JSON Schema inputSchema as readable parameter list
   */
  private formatInputSchema(schema: any): string {
    if (!schema || !schema.properties) {
      return '';
    }

    let output = '  Parameters:\n';
    const required = schema.required || [];

    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const prop = propSchema as any;
      const isRequired = required.includes(propName);
      const requiredMark = isRequired ? '(required)' : '(optional)';

      // Build parameter line: name, required/optional, type
      output += `    - ${propName} ${requiredMark}: ${prop.type || 'any'}`;

      // Add enum values if present
      if (prop.enum) {
        output += ` [${prop.enum.join('|')}]`;
      }

      // Add description on new line if present
      if (prop.description) {
        output += `\n      ${prop.description}`;
      }

      output += '\n';
    }

    return output;
  }
}
