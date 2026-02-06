/**
 * Set Mood Tool - Activate a mood (light scene)
 */

import { BaseTool } from './base-tool';
import { MCPTool, MCPToolCallResult, HomeyInstance, HomeyMood } from '../types';
import { IZoneDeviceManager } from '../interfaces';
import { Logger } from '../utils/logger';

export class SetMoodTool extends BaseTool {
  readonly name = 'set_mood';
  private logger: Logger;

  constructor(
    private homey: HomeyInstance,
    private zoneDeviceManager: IZoneDeviceManager
  ) {
    super();
    this.logger = new Logger(homey, 'SetMoodTool');
  }

  getDefinition(): MCPTool {
    return {
      name: this.name,
      description: `Activate a mood (light scene) directly.

PURPOSE: Turn on a mood to set multiple devices to pre-configured states.

WHEN TO USE:
- When user wants to activate a scene/mood
- "Set the living room to movie mode"
- "Activate the romantic mood"

PARAMETERS:
- moodId (optional): Exact UUID of the mood
- moodName (optional): Mood name (case-insensitive matching)
- Must provide either moodId OR moodName

WHAT IT DOES:
- Activates the mood using Homey's setMood API
- All devices in the mood will be set to their configured states
- This happens instantly and directly

EXAMPLE: "Activate the Movie Night mood"`,
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
          new Error('Either moodId or moodName must be provided')
        );
      }

      this.logger.log(`🎭 Activating mood: ${moodId || moodName}`);

      // Find mood by name if provided
      let targetMoodId = moodId;
      let mood: HomeyMood | null = null;

      if (!targetMoodId && moodName) {
        const moods = await this.zoneDeviceManager.getMoods();
        const foundMood = this.findMoodByName(moods, moodName);

        if (!foundMood) {
          return this.createErrorResponse(
            new Error(
              `Mood not found: "${moodName}"\n\nAvailable moods:\n${this.formatAvailableMoods(moods)}`
            )
          );
        }

        mood = foundMood;
        targetMoodId = foundMood.id;
      } else {
        // Verify mood exists by ID
        mood = await this.zoneDeviceManager.getMood(targetMoodId!);
        if (!mood) {
          return this.createErrorResponse(new Error(`Mood not found with ID: ${targetMoodId}`));
        }
      }

      // Get zone name for confirmation message
      const zone = await this.zoneDeviceManager.getZone(mood.zone);
      const zoneName = zone ? zone.name : mood.zone;

      // Activate mood using direct API
      await this.zoneDeviceManager.setMood(mood.id);

      let message = `🎭 Mood Activated\n\n`;
      message += `Mood: ${mood.name}\n`;
      message += `Zone: ${zoneName}\n`;
      message += `Devices: ${Object.keys(mood.devices).length}`;
      if (mood.preset) {
        message += `\nPreset: ${mood.preset}`;
      }

      return this.createSuccessResponse(message);
    } catch (error) {
      this.logger.error('Error activating mood:', error);
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
