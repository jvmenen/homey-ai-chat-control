/**
 * Get Logic Variables Tool - Retrieve Homey Logic variables
 *
 * Apps have the homey.logic.readonly scope, so the variables are read directly.
 */

import { BaseTool } from './base-tool';
import {
  MCPTool, MCPToolCallResult, HomeyInstance, LogicVariable,
} from '../types';
import { formatLogicVariables } from '../formatters/logic-variables-formatter';
import { Logger } from '../utils/logger';

// Raw logic variable shape as returned by the Homey `logic` API
interface RawLogicVariable {
  id: string;
  name: string;
  type: LogicVariable['type'];
  value: LogicVariable['value'];
}

// Minimal shape of the Homey API client this helper needs
export interface HomeyLogicApiClient {
  logic: {
    getVariables(): Promise<Record<string, RawLogicVariable>>;
  };
}

export async function fetchLogicVariables(homeyApi: HomeyLogicApiClient): Promise<LogicVariable[]> {
  const variablesObj = await homeyApi.logic.getVariables();
  return Object.values(variablesObj).map((v) => ({
    id: v.id,
    name: v.name,
    type: v.type,
    value: v.value,
  }));
}

export class GetLogicVariablesTool extends BaseTool {
  readonly name = 'get_logic_variables';
  private logger: Logger;

  constructor(
    private homey: HomeyInstance,
    private homeyApi: HomeyLogicApiClient,
  ) {
    super();
    this.logger = new Logger(homey, 'GetLogicVariablesTool');
  }

  getDefinition(): MCPTool {
    return {
      name: this.name,
      // eslint-disable-next-line max-len -- single-line tool description text sent to the AI; wrapping would inject a literal newline into it
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

      let variables = await fetchLogicVariables(this.homeyApi);

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

      const output = formatLogicVariables(variables, { filterType, searchName });
      return this.createSuccessResponse(output);
    } catch (error) {
      this.logger.error('Error getting logic variables:', error);
      return this.createErrorResponse(error as Error);
    }
  }
}
