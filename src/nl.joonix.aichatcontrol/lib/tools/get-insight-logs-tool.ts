import { BaseTool } from './base-tool.js';
import type { InsightsManager } from '../managers/insights-manager.js';
import { XMLFormatter } from '../formatters/xml-formatter.js';
import type { MCPToolCallResult, MCPTool } from '../types.js';

/**
 * Arguments for get_insight_logs tool
 */
export interface GetInsightLogsArgs {
  deviceIds?: string[];
  zoneId?: string;
  logType?: 'number' | 'boolean';
}

/**
 * Tool: get_insight_logs
 * Retrieve available insight logs (historical data tracking) for devices
 */
export class GetInsightLogsTool extends BaseTool {
  readonly name = 'get_insight_logs';

  constructor(private readonly insightsManager: InsightsManager) {
    super();
  }

  getDefinition(): MCPTool {
    return {
      name: 'get_insight_logs',
      description:
        'Get a list of all available insight logs (historical data tracking) for Homey devices. ' +
        'Insights track metrics like temperature, power consumption, humidity, on/off states, motion detection, etc. over time. ' +
        'Use this tool to discover what historical data is available, then use get_insight_data to retrieve actual time-series entries. ' +
        'Returns XML format with log metadata including device and zone information.',
      inputSchema: {
        type: 'object',
        properties: {
          deviceIds: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Optional: Filter logs to specific device IDs. Useful when you want to see what insights are available for particular devices.',
          },
          zoneId: {
            type: 'string',
            description:
              'Optional: Filter logs to devices in a specific zone (room). Useful for getting insights for all devices in one location.',
          },
          logType: {
            type: 'string',
            enum: ['number', 'boolean'],
            description:
              'Optional: Filter by log type. "number" = numeric metrics (temperature, power, etc.), "boolean" = on/off states (motion, door open/closed, etc.)',
          },
        },
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    const typedArgs = args as unknown as GetInsightLogsArgs;
    try {
      // Get insight logs with optional filters
      const logs = await this.insightsManager.getInsightsOverview({
        deviceIds: typedArgs.deviceIds,
        zoneId: typedArgs.zoneId,
        logType: typedArgs.logType,
      });

      // Format as XML
      const xmlOutput = XMLFormatter.formatInsightLogs(logs);

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
        error instanceof Error ? error.message : 'Unknown error occurred while retrieving insight logs';

      return {
        content: [
          {
            type: 'text',
            text: `Error retrieving insight logs: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
}
