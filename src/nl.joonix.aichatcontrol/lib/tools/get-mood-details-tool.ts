/**
 * Get Mood Details Tool - Get detailed configuration of a mood (light scene)
 */

import { BaseTool } from './base-tool';
import {
  MCPTool, MCPToolCallResult, HomeyInstance, HomeyMood,
} from '../types';
import { IZoneDeviceManager } from '../interfaces';
import { formatMoodDetails } from '../formatters/moods-formatter';
import { Logger } from '../utils/logger';

export class GetMoodDetailsTool extends BaseTool {
  readonly name = 'get_mood_details';
  private logger: Logger;

  constructor(
    private homey: HomeyInstance,
    private zoneDeviceManager: IZoneDeviceManager,
  ) {
    super();
    this.logger = new Logger(homey, 'GetMoodDetailsTool');
  }

  getDefinition(): MCPTool {
    return {
      name: this.name,
      description: `Get detailed configuration of a specific mood (light scene).

PURPOSE: View which devices are in a mood and their configured states.

WHEN TO USE:
- When user asks "what devices are in mood X?"
- When checking mood configuration before activation
- When planning to modify or recreate a mood

PARAMETERS:
- moodId (optional): Exact UUID of the mood
- moodName (optional): Mood name (case-insensitive, fuzzy matching)
- Must provide either moodId OR moodName

WHAT YOU GET:
- Mood name, zone, preset type
- List of devices with their names (resolved from device lookup)
- Configured state for each device (on/off, dim level, color settings)
- Formatted in readable format with device names (not just IDs)

EXAMPLE: "Show me the 'Movie Night' mood configuration"`,
      inputSchema: {
        type: 'object',
        properties: {
          moodId: {
            type: 'string',
            description: 'Optional: Exact UUID of the mood',
          },
          moodName: {
            type: 'string',
            description: 'Optional: Mood name (case-insensitive matching)',
          },
        },
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    try {
      const moodId = args.moodId as string | undefined;
      const moodName = args.moodName as string | undefined;

      // Validate: at least one parameter required
      if (!moodId && !moodName) {
        return this.createErrorResponse(
          new Error('Either moodId or moodName must be provided'),
        );
      }

      this.logger.log(`🎭 Getting mood details: ${moodId || moodName}`);

      // Find mood by name if provided
      let targetMoodId = moodId;
      if (!targetMoodId && moodName) {
        const moods = await this.zoneDeviceManager.getMoods();
        const foundMood = this.findMoodByName(moods, moodName);

        if (!foundMood) {
          return this.createErrorResponse(
            new Error(
              `Mood not found: "${moodName}"\n\nAvailable moods:\n${this.formatAvailableMoods(moods)}`,
            ),
          );
        }

        targetMoodId = foundMood.id;
      }

      // Get mood details
      const mood = await this.zoneDeviceManager.getMood(targetMoodId!);

      if (!mood) {
        return this.createErrorResponse(new Error(`Mood not found with ID: ${targetMoodId}`));
      }

      // Get zone name
      const zone = await this.zoneDeviceManager.getZone(mood.zone);
      const zoneName = zone ? zone.name : mood.zone;

      // Get device details
      const deviceDetails: Array<{ id: string; name: string; state: Record<string, unknown> }> = [];

      this.logger.log(`📋 Processing ${Object.keys(mood.devices).length} devices in mood`);

      for (const [deviceId, deviceData] of Object.entries(mood.devices)) {
        try {
          const device = await this.zoneDeviceManager.getDevice(deviceId);
          const deviceName = device ? device.name : `Unknown Device (${deviceId})`;

          // Normalize state structure (might be .state or direct)
          const rawData = deviceData as { state?: Record<string, unknown> } | Record<string, unknown>;
          const state = (rawData as { state?: Record<string, unknown> }).state
            || (rawData as Record<string, unknown>);

          // Ensure state is an object
          if (typeof state !== 'object' || state === null) {
            this.logger.log(`⚠️ Invalid state for device ${deviceId}, using empty object`);
            deviceDetails.push({
              id: deviceId,
              name: deviceName,
              state: {},
            });
          } else {
            deviceDetails.push({
              id: deviceId,
              name: deviceName,
              state,
            });
          }
        } catch {
          // Device might have been deleted but still in mood
          this.logger.log(`Warning: Device ${deviceId} in mood but not found`);
          deviceDetails.push({
            id: deviceId,
            name: '(deleted device)',
            state: {},
          });
        }
      }

      this.logger.log(`📦 Formatting mood details with ${deviceDetails.length} devices`);

      // Format output
      try {
        const formattedOutput = formatMoodDetails(mood, deviceDetails, zoneName);
        this.logger.log(`✅ Successfully formatted mood details (${formattedOutput.length} chars)`);
        return this.createSuccessResponse(formattedOutput);
      } catch (formatError) {
        this.logger.error('❌ Error formatting mood details:', formatError);
        throw formatError;
      }
    } catch (error) {
      this.logger.error('Error getting mood details:', error);
      return this.createErrorResponse(error as Error);
    }
  }

  /**
   * Find mood by name using fuzzy matching
   */
  private findMoodByName(moods: HomeyMood[], name: string): HomeyMood | null {
    const lowerName = name.toLowerCase().trim();

    // Exact match first
    const exactMatch = moods.find((m) => m.name.toLowerCase() === lowerName);
    if (exactMatch) return exactMatch;

    // Partial match fallback
    return moods.find((m) => m.name.toLowerCase().includes(lowerName)) || null;
  }

  /**
   * Format available moods for error message
   */
  private formatAvailableMoods(moods: HomeyMood[]): string {
    if (moods.length === 0) {
      return '(No moods found)';
    }

    return moods
      .map((m) => {
        const preset = m.preset ? ` (preset: ${m.preset})` : '';
        return `- ${m.name}${preset}`;
      })
      .join('\n');
  }
}
