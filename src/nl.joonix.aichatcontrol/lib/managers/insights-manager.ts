import type { HomeyRestClient } from '../api/homey-rest-client';
import type { ZoneDeviceManager } from './zone-device-manager';
import type { HomeyInstance } from '../types';
import { Logger } from '../utils/logger';

export interface InsightLog {
  id: string;
  title: string;
  type: 'number' | 'boolean';
  units?: string;
  titleTrue?: string;
  titleFalse?: string;
  decimals?: number;
  ownerId: string;
  ownerName: string;
  zoneName?: string;
  zoneId?: string;
}

export interface InsightLogEntry {
  timestamp: string;
  value: number | boolean;
}

export interface InsightLogWithData {
  id: string;
  title: string;
  type: 'number' | 'boolean';
  units?: string;
  entries: InsightLogEntry[];
}

export interface GetInsightsOverviewFilters {
  deviceIds?: string[];
  zoneId?: string;
  logType?: 'number' | 'boolean';
}

export type InsightResolution =
  | 'lastHour'
  | 'last6Hours'
  | 'last24Hours'
  | 'last7Days'
  | 'last14Days'
  | 'last31Days'
  | 'today'
  | 'thisWeek'
  | 'thisMonth'
  | 'thisYear';

// Raw insight log shape as returned by the Homey `insights` API
interface RawInsightLog {
  id?: string;
  ownerUri?: string;
  ownerId?: string;
  title?: string;
  type?: 'number' | 'boolean';
  units?: string;
  titleTrue?: string;
  titleFalse?: string;
  decimals?: number;
}

/**
 * Manager for Homey Insights operations
 * Handles discovery and retrieval of insight logs and their historical data
 */
export class InsightsManager {
  private logger: Logger;

  constructor(
    private readonly homeyApi: HomeyRestClient,
    private readonly zoneDeviceManager: ZoneDeviceManager,
    homey: HomeyInstance,
  ) {
    this.logger = new Logger(homey, 'InsightsManager');
  }

  /**
   * Get an overview of all available insight logs with device and zone information
   */
  async getInsightsOverview(filters?: GetInsightsOverviewFilters): Promise<InsightLog[]> {
    // Get all logs from Homey API
    const logsObj = await this.homeyApi.insights.getLogs<RawInsightLog>();
    const logs = Object.values(logsObj);

    // Get device and zone information for enrichment
    const homeStructure = await this.zoneDeviceManager.getHomeStructure();
    const deviceMap = new Map(homeStructure.devices.map((d) => [d.id, d]));
    const zoneMap = new Map(homeStructure.zones.map((z) => [z.id, z]));

    // Transform and enrich logs with device/zone information
    const enrichedLogs: InsightLog[] = [];

    for (const log of logs) {
      // Parse owner ID from ownerUri (format: "homey:device:deviceId" or similar)
      const ownerIdMatch = log.ownerUri?.match(/homey:device:([^:]+)/);
      const ownerId = ownerIdMatch ? ownerIdMatch[1] : (log.ownerId || '');

      // Get device information
      const device = deviceMap.get(ownerId);
      if (!device) {
        // Skip logs without valid device
        continue;
      }

      // Apply filters
      if (filters?.deviceIds && !filters.deviceIds.includes(ownerId)) {
        continue;
      }

      if (filters?.zoneId && device.zone !== filters.zoneId) {
        continue;
      }

      if (filters?.logType && log.type !== filters.logType) {
        continue;
      }

      // Get zone information
      const zone = zoneMap.get(device.zone);

      enrichedLogs.push({
        id: log.id as string,
        title: (log.title as string) || 'Unknown',
        type: log.type as 'number' | 'boolean',
        units: log.units as string | undefined,
        titleTrue: log.titleTrue as string | undefined,
        titleFalse: log.titleFalse as string | undefined,
        decimals: log.decimals as number | undefined,
        ownerId,
        ownerName: device.name,
        zoneName: zone?.name,
        zoneId: device.zone,
      });
    }

    // Sort by zone name, then device name, then title
    enrichedLogs.sort((a, b) => {
      const zoneCompare = (a.zoneName || '').localeCompare(b.zoneName || '');
      if (zoneCompare !== 0) return zoneCompare;

      const deviceCompare = a.ownerName.localeCompare(b.ownerName);
      if (deviceCompare !== 0) return deviceCompare;

      return a.title.localeCompare(b.title);
    });

    return enrichedLogs;
  }

  /**
   * Get historical data for specific insight logs
   */
  async getInsightData(
    logIds: string[],
    resolution?: InsightResolution,
  ): Promise<InsightLogWithData[]> {
    const results: InsightLogWithData[] = [];

    for (const logId of logIds) {
      try {
        // Get the log metadata first
        const log = await this.homeyApi.insights.getLog<RawInsightLog>({ id: logId });

        // Get log entries with optional resolution
        const entriesResponse = await this.homeyApi.insights.getLogEntries<{ values?: unknown[] }>({
          id: logId,
          resolution,
        });

        // The API returns an object with metadata and a 'values' array
        // values is an array of [timestamp, value] tuples
        const transformedEntries: InsightLogEntry[] = [];

        if (entriesResponse && Array.isArray(entriesResponse.values)) {
          for (const entry of entriesResponse.values) {
            // Each entry is [timestamp, value] or an object with t and v properties
            let timestamp: string;
            let value: number | boolean;

            if (Array.isArray(entry) && entry.length === 2) {
              // Format: [timestamp, value]
              timestamp = new Date(entry[0]).toISOString();
              value = entry[1];
            } else if (entry && typeof entry === 'object' && 't' in entry && 'v' in entry) {
              // Format: { t: timestamp, v: value }
              const { t, v } = entry as { t: string | number; v: number | boolean };
              timestamp = new Date(t).toISOString();
              value = v;
            } else {
              // Unknown format, skip
              continue;
            }

            transformedEntries.push({ timestamp, value });
          }
        }

        // Sort by timestamp (chronological order)
        transformedEntries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        results.push({
          id: logId,
          title: (log.title as string) || 'Unknown',
          type: log.type as 'number' | 'boolean',
          units: log.units as string | undefined,
          entries: transformedEntries,
        });
      } catch (error) {
        // Log error but continue with other logs
        this.logger.error(`Failed to get insight data for log ${logId}:`, error);

        // Add empty result to indicate the log was requested but failed
        results.push({
          id: logId,
          title: 'Error',
          type: 'number',
          entries: [],
        });
      }
    }

    return results;
  }

  /**
   * Get insight logs for a specific device
   */
  async getDeviceInsightLogs(deviceId: string): Promise<InsightLog[]> {
    return this.getInsightsOverview({ deviceIds: [deviceId] });
  }

  /**
   * Get insight logs for all devices in a specific zone
   */
  async getZoneInsightLogs(zoneId: string): Promise<InsightLog[]> {
    return this.getInsightsOverview({ zoneId });
  }
}
