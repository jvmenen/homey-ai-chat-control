/**
 * Get Logic Variables Tool - Retrieve Homey Logic variables
 *
 * Note: Uses logic.getState() (requires homey.system.readonly) instead of
 * logic.getVariables() (requires homey.logic.readonly) because the latter
 * scope is not available to apps via createAppAPI.
 */

import { BaseTool } from './base-tool';
import { MCPTool, MCPToolCallResult, HomeyInstance, LogicVariable } from '../types';
import { XMLFormatter } from '../formatters/xml-formatter';
import { Logger } from '../utils/logger';

/**
 * Helper to fetch logic variables using getState() fallback
 * getVariables() requires homey.logic.readonly which isn't available to apps.
 * getState() requires homey.system.readonly which IS available.
 */
export async function fetchLogicVariables(homeyApi: any, logger: Logger): Promise<LogicVariable[]> {
  try {
    // Try getVariables() first (requires homey.logic.readonly)
    const variablesObj = await homeyApi.logic.getVariables();
    return Object.values(variablesObj).map((v: any) => ({
      id: v.id,
      name: v.name,
      type: v.type,
      value: v.value,
    }));
  } catch (error: any) {
    // If scope error, fall back to getState() (requires homey.system.readonly)
    if (error?.statusCode === 403 || error?.message?.includes('Missing Scopes')) {
      logger.log('getVariables() failed with scope error, falling back to getState()');
      const state = await homeyApi.logic.getState();

      // getState() returns the manager state which may contain variables
      if (state && typeof state === 'object') {
        // The state object may have a 'variable' key with all variables
        const variablesObj = state.variable || state.variables || state;
        if (typeof variablesObj === 'object') {
          return Object.values(variablesObj)
            .filter((v: any) => v && v.id && v.name && v.type !== undefined)
            .map((v: any) => ({
              id: v.id,
              name: v.name,
              type: v.type,
              value: v.value,
            }));
        }
      }

      throw new Error('Unable to retrieve logic variables: getState() did not return variable data');
    }
    throw error;
  }
}

export class GetLogicVariablesTool extends BaseTool {
  readonly name = 'get_logic_variables';
  private logger: Logger;

  constructor(
    private homey: HomeyInstance,
    private homeyApi: any
  ) {
    super();
    this.logger = new Logger(homey, 'GetLogicVariablesTool');
  }

  getDefinition(): MCPTool {
    return {
      name: this.name,
      description: `Retrieve all Homey Logic variables with their current values. Logic variables are used in flows for dynamic automation behavior, storing values like thresholds, counters, flags, and text. Can filter by variable type or search by name.

WHEN TO USE:
- When user asks about logic variables or their values
- Before updating a variable (to find its ID)
- To check current thresholds or flags used in flows

PARAMETERS:
- filter_type (optional): Filter by variable type ("number", "boolean", "string")
- search_name (optional): Search by (partial) variable name (case-insensitive)

EXAMPLE: "Show me all lux-related variables" → search_name: "lux"`,
      inputSchema: {
        type: 'object',
        properties: {
          filter_type: {
            type: 'string',
            enum: ['number', 'boolean', 'string'],
            description: 'Filter by variable type',
          },
          search_name: {
            type: 'string',
            description: 'Search by (partial) variable name (case-insensitive)',
          },
        },
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    try {
      const filterType = args.filter_type as string | undefined;
      const searchName = args.search_name as string | undefined;

      this.logger.log('Getting logic variables', { filterType, searchName });

      let variables = await fetchLogicVariables(this.homeyApi, this.logger);

      // Apply type filter
      if (filterType) {
        variables = variables.filter((v) => v.type === filterType);
      }

      // Apply name search
      if (searchName) {
        const lowerSearch = searchName.toLowerCase();
        variables = variables.filter((v) => v.name.toLowerCase().includes(lowerSearch));
      }

      // Sort by name for consistent output
      variables.sort((a, b) => a.name.localeCompare(b.name));

      const output = XMLFormatter.formatLogicVariables(variables, { filterType, searchName });
      return this.createSuccessResponse(output);
    } catch (error) {
      this.logger.error('Error getting logic variables:', error);
      return this.createErrorResponse(error as Error);
    }
  }
}
