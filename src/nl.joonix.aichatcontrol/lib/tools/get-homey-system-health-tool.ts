/**
 * Get Homey System Health Tool - Diagnose the Homey hub itself
 *
 * Requires homey.system.readonly and homey.app.readonly.
 * The summary logic lives in diagnostics/system-health, the XML in its formatter.
 */

import { BaseTool } from './base-tool';
import { MCPTool, MCPToolCallResult, HomeyInstance } from '../types';
import { Logger } from '../utils/logger';
import { positiveNumberArg } from '../utils/args';
import {
  RawSystemInfo, RawUsageInfo, RawApp, summarizeSystemHealth,
} from '../diagnostics/system-health';
import { formatSystemHealth } from '../formatters/system-health-formatter';

// Minimal shape of the Homey API client this tool needs
export interface HomeySystemApiClient {
  system: {
    getInfo(): Promise<RawSystemInfo>;
    getMemoryInfo(): Promise<RawUsageInfo>;
    getStorageInfo(): Promise<RawUsageInfo>;
  };
  apps: {
    getApps(): Promise<Record<string, RawApp>>;
  };
}

export const DEFAULT_TOP_CONSUMERS = 8;
const MAX_TOP_CONSUMERS = 50;

export class GetHomeySystemHealthTool extends BaseTool {
  readonly name = 'get_homey_system_health';
  private logger: Logger;

  constructor(
    private homey: HomeyInstance,
    private homeyApi: HomeySystemApiClient,
  ) {
    super();
    this.logger = new Logger(homey, 'GetHomeySystemHealthTool');
  }

  getDefinition(): MCPTool {
    return {
      name: this.name,
      // eslint-disable-next-line max-len -- description text for the AI; its first paragraph is one long line on purpose
      description: `Diagnose the health of the Homey hub itself: last reboot time and reason, uptime, temperature, undervoltage and throttling, Wi-Fi band and signal or Ethernet, free memory and storage (with the biggest consumers), and per app whether it runs or crashed, how often it crashed and how much memory and CPU it uses.

WHEN TO USE:
- Homey restarted, became slow or unresponsive, or automations stopped for a while
- An app or its devices stopped working (check crashed state and crash count)
- Suspected memory pressure or a memory-hungry app
- Checking whether Homey is on 2.4 GHz or 5 GHz Wi-Fi, or on Ethernet

PARAMETERS:
- include_apps (optional, default true): include per-app state and resource usage
- top (optional, default 8): number of biggest memory/storage consumers to list

TIP: reboot-reason "reboot-ota" means a Homey firmware update caused the last restart.`,
      inputSchema: {
        type: 'object',
        properties: {
          include_apps: {
            type: 'boolean',
            description: 'Include per-app state, crash count and resource usage (default true)',
          },
          top: {
            type: 'number',
            description: 'Number of biggest memory and storage consumers to list (default 8)',
          },
        },
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    try {
      const includeApps = args.include_apps !== false;
      const topN = Math.round(positiveNumberArg(args.top, DEFAULT_TOP_CONSUMERS, MAX_TOP_CONSUMERS));

      this.logger.log('Getting Homey system health', { includeApps, topN });

      // Each part is fetched independently so one failing call does not hide the rest
      const [info, memory, storage, apps] = await Promise.all([
        this.tryFetch('system info', () => this.homeyApi.system.getInfo()),
        this.tryFetch('memory info', () => this.homeyApi.system.getMemoryInfo()),
        this.tryFetch('storage info', () => this.homeyApi.system.getStorageInfo()),
        includeApps ? this.tryFetch('apps', () => this.homeyApi.apps.getApps()) : Promise.resolve(null),
      ]);

      if (!info && !memory && !storage && !apps) {
        throw new Error('Unable to read any system information from Homey');
      }

      const summary = summarizeSystemHealth(info, memory, storage, apps, topN);
      return this.createSuccessResponse(formatSystemHealth(summary));
    } catch (error) {
      this.logger.error('Error getting system health:', error);
      return this.createErrorResponse(error as Error);
    }
  }

  private async tryFetch<T>(label: string, fetch: () => Promise<T>): Promise<T | null> {
    try {
      return await fetch();
    } catch (error) {
      this.logger.error(`System health: ${label} failed`, error);
      return null;
    }
  }
}
