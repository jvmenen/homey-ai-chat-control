import { BaseTool } from './base-tool.js';
import type { InsightsManager, InsightResolution } from '../managers/insights-manager.js';
import { XMLFormatter } from '../formatters/xml-formatter.js';
import type { MCPToolCallResult, MCPTool } from '../types.js';

/**
 * Arguments for get_insight_data tool
 */
export interface GetInsightDataArgs {
  logIds: string[];
  resolution?: InsightResolution;
}

/**
 * Tool: get_insight_data
 * Retrieve historical time-series data for specific insight logs
 */
export class GetInsightDataTool extends BaseTool {
  readonly name = 'get_insight_data';

  constructor(private readonly insightsManager: InsightsManager) {
    super();
  }

  getDefinition(): MCPTool {
    return {
      name: 'get_insight_data',
      description:
        'Get historical time-series data for specific insight logs. ' +
        'Use get_insight_logs first to discover available log IDs. ' +
        'This tool retrieves actual data points with timestamps and values, ' +
        'allowing you to analyze trends, calculate statistics, or answer questions about past states. ' +
        'Returns XML format with chronologically sorted entries.',
      inputSchema: {
        type: 'object',
        properties: {
          logIds: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Array of insight log IDs to retrieve data for. Get these IDs from get_insight_logs tool. ' +
              'Can request multiple logs at once for comparison or analysis.',
          },
          resolution: {
            type: 'string',
            enum: [
              'lastHour',
              'last6Hours',
              'last24Hours',
              'last7Days',
              'last14Days',
              'last31Days',
              'today',
              'thisWeek',
              'thisMonth',
              'thisYear',
            ],
            description:
              'Optional: Time range and aggregation level. ' +
              'Shorter periods (lastHour, last6Hours) provide more detailed data points. ' +
              'Longer periods (last31Days, thisYear) provide aggregated/summarized data. ' +
              'Default behavior uses maximum available resolution.',
          },
        },
        required: ['logIds'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    const typedArgs = args as unknown as GetInsightDataArgs;
    try {
      // Validate input
      if (!typedArgs.logIds || typedArgs.logIds.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: logIds parameter is required and must contain at least one log ID',
            },
          ],
          isError: true,
        };
      }

      // Get insight data with optional resolution
      const data = await this.insightsManager.getInsightData(typedArgs.logIds, typedArgs.resolution);

      // Format as XML
      const xmlOutput = XMLFormatter.formatInsightData(data, typedArgs.resolution);

      return {
        content: [
          {
            type: 'text',
            text: xmlOutput,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred while retrieving insight data';

      return {
        content: [
          {
            type: 'text',
            text: `Error retrieving insight data: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
}
