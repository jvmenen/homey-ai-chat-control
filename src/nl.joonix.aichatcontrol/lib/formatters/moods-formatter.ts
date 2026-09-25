/**
 * Moods formatter - mood details and the moods a device appears in, as XML
 */

import { escapeXmlText } from './xml-utils';

/**
 * Format mood details with device information
 * @param mood - Mood data
 * @param deviceDetails - Array of device details (id, name, state)
 * @param zoneName - Zone name
 * @returns Formatted XML string with instructions
 */
export function formatMoodDetails(
  mood: { id: string; name: string; zone: string; preset: string | null },
  deviceDetails: Array<{ id: string; name: string; state: Record<string, unknown> }>,
  zoneName: string,
): string {
  try {
    let message = 'Mood Details:\n\n';
    message += `<mood id="${escapeXmlText(mood.id)}" name="${escapeXmlText(mood.name)}"`;
    message += ` zone-name="${escapeXmlText(zoneName)}"`;
    if (mood.preset) {
      message += ` preset="${escapeXmlText(mood.preset)}"`;
    }
    message += ` device-count="${deviceDetails.length}">\n`;

    if (deviceDetails.length === 0) {
      message += '  <!-- No devices in this mood -->\n';
    } else {
      for (const device of deviceDetails) {
        try {
          message += `  <device id="${escapeXmlText(device.id)}" name="${escapeXmlText(device.name)}">\n`;
          message += '    <state';

          // Format state capabilities
          const stateEntries = Object.entries(device.state || {});
          if (stateEntries.length > 0) {
            for (const [key, value] of stateEntries) {
              // Skip null/undefined values
              if (value === null || value === undefined) continue;

              const escapedKey = escapeXmlText(String(key));
              const escapedValue = escapeXmlText(String(value));
              message += ` ${escapedKey}="${escapedValue}"`;
            }
          }

          message += ' />\n';
          message += '  </device>\n';
        } catch (deviceError) {
          // Log error but continue with other devices
          // eslint-disable-next-line no-console -- formatter module has no Homey instance/logger to report through
          console.error(`Error formatting device ${device.id}:`, deviceError);
          message += `  <!-- Error formatting device ${escapeXmlText(device.id)} -->\n`;
        }
      }
    }

    message += '</mood>\n\n';
    message += getMoodDetailsInstructions();

    return message;
  } catch (error) {
    // eslint-disable-next-line no-console -- formatter module has no Homey instance/logger to report through
    console.error('Error in formatMoodDetails:', error);
    throw new Error(`Failed to format mood details: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get instructions for mood details XML
 */
function getMoodDetailsInstructions(): string {
  return `INSTRUCTIONS:
- This shows a mood's complete configuration (light scene)
- Each device shows its configured state when this mood activates
- State values: onoff (boolean), dim (0-1), light_mode, light_temperature (0-1), etc.
- Use set_mood to activate this configuration (requires flow-based activation)
- Moods control multiple devices at once to create scenes like "Movie Night" or "Reading Mode"
`;
}

/**
 * Format device appearance in moods
 * @param deviceId - Device ID
 * @param deviceName - Device name
 * @param moodsWithDevice - Array of moods that include this device
 * @returns Formatted XML string with instructions
 */
export function formatDeviceInMoods(
  deviceId: string,
  deviceName: string,
  moodsWithDevice: Array<{
    mood: { id: string; name: string; preset: string | null };
    zoneName: string;
    state: Record<string, unknown>;
  }>,
): string {
  let message = 'Device in Moods Search:\n\n';
  message += `<device-in-moods device-id="${escapeXmlText(deviceId)}"`;
  message += ` device-name="${escapeXmlText(deviceName)}"`;
  message += ` found-in="${moodsWithDevice.length}">\n`;

  if (moodsWithDevice.length === 0) {
    message += '  <!-- Device is not used in any moods (safe to remove/migrate) -->\n';
  } else {
    for (const { mood, zoneName, state } of moodsWithDevice) {
      message += `  <mood id="${escapeXmlText(mood.id)}" name="${escapeXmlText(mood.name)}"`;
      message += ` zone-name="${escapeXmlText(zoneName)}"`;
      if (mood.preset) {
        message += ` preset="${escapeXmlText(mood.preset)}"`;
      }
      message += '>\n';

      message += '    <state';

      // Format state capabilities
      const stateEntries = Object.entries(state);
      if (stateEntries.length > 0) {
        for (const [key, value] of stateEntries) {
          message += ` ${escapeXmlText(key)}="${escapeXmlText(String(value))}"`;
        }
      }

      message += ' />\n';
      message += '  </mood>\n';
    }
  }

  message += '</device-in-moods>\n\n';
  message += getDeviceInMoodsInstructions();

  return message;
}

/**
 * Get instructions for device in moods XML
 */
function getDeviceInMoodsInstructions(): string {
  return `INSTRUCTIONS:
- Shows which moods include this device
- found-in="0" means device is not in any moods (safe to remove/migrate)
- found-in > 0 means device is used in moods (update moods before removing device)
- Each mood shows the device's configured state for that scene
- Useful for device migrations or cleanup operations
- If removing this device, you may need to update these moods first
`;
}
