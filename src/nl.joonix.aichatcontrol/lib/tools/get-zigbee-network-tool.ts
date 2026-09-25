/**
 * Get Zigbee Network Tool - Diagnose the Homey Zigbee mesh
 *
 * Reads the Zigbee manager state (requires homey.system.readonly, which apps have).
 * The summary logic lives in diagnostics/zigbee-network, the XML in its formatter.
 */

import { BaseTool } from './base-tool';
import { MCPTool, MCPToolCallResult, HomeyInstance } from '../types';
import { Logger } from '../utils/logger';
import { optionalStringArg, positiveNumberArg } from '../utils/args';
import { RawZigbeeState, ZigbeeFilters, summarizeZigbeeState } from '../diagnostics/zigbee-network';
import { formatZigbeeNetwork } from '../formatters/zigbee-network-formatter';

// Minimal shape of the Homey API client this tool needs
export interface HomeyZigbeeApiClient {
  zigbee: {
    getState(): Promise<RawZigbeeState>;
  };
}

export const DEFAULT_STALE_AFTER_HOURS = 24;

export function parseZigbeeFilters(args: Record<string, unknown>): ZigbeeFilters {
  return {
    nameFilter: optionalStringArg(args.name_filter),
    nodeType: args.node_type === 'router' || args.node_type === 'enddevice' ? args.node_type : undefined,
    onlyIssues: args.only_issues === true,
    staleAfterHours: positiveNumberArg(args.stale_after_hours, DEFAULT_STALE_AFTER_HOURS),
  };
}

export class GetZigbeeNetworkTool extends BaseTool {
  readonly name = 'get_zigbee_network';
  private logger: Logger;

  constructor(
    private homey: HomeyInstance,
    private homeyApi: HomeyZigbeeApiClient,
  ) {
    super();
    this.logger = new Logger(homey, 'GetZigbeeNetworkTool');
  }

  getDefinition(): MCPTool {
    return {
      name: this.name,
      // eslint-disable-next-line max-len -- description text for the AI; its first paragraph is one long line on purpose
      description: `Diagnose the Homey Zigbee mesh network: which devices are routers or end devices, when each device was last seen, packet statistics and error rates, and the route (via which routers) Homey uses to reach each device. Read-only; the network key is never included.

WHEN TO USE:
- A Zigbee device (door/window sensor, motion sensor, remote, bulb) stops responding, "freezes" or drops out
- To find which router a battery device is connected through
- To spot noisy or unreliable routers (high error rate, unusually high rx counts)
- To list devices that have not been heard from for a long time

PARAMETERS:
- name_filter (optional): partial device name, case-insensitive (e.g. "deur", "sensor")
- node_type (optional): "router" or "enddevice"
- only_issues (optional): only return nodes that are stale or have a high transmit error rate
- stale_after_hours (optional, default 24): a node not seen for longer than this is marked stale

EXAMPLE: "Why does my back door sensor keep dropping out?" → name_filter: "achterdeur", then check its route and the health of the routers in that route.`,
      inputSchema: {
        type: 'object',
        properties: {
          name_filter: {
            type: 'string',
            description: 'Only include nodes whose name contains this text (case-insensitive)',
          },
          node_type: {
            type: 'string',
            enum: ['router', 'enddevice'],
            description: 'Only include routers (mains-powered, relay traffic) or end devices (usually battery-powered)',
          },
          only_issues: {
            type: 'boolean',
            description: 'Only include nodes that are stale or have a high transmit error rate',
          },
          stale_after_hours: {
            type: 'number',
            description: 'Mark a node as stale when not seen for more than this many hours (default 24)',
          },
        },
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    try {
      const filters = parseZigbeeFilters(args);
      this.logger.log('Getting Zigbee network state', filters);

      const raw = await this.homeyApi.zigbee.getState();
      return this.createSuccessResponse(formatZigbeeNetwork(summarizeZigbeeState(raw, filters), filters));
    } catch (error) {
      this.logger.error('Error getting Zigbee network state:', error);
      return this.createErrorResponse(error as Error);
    }
  }
}
