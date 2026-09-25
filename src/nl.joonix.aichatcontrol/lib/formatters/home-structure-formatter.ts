/**
 * Home structure formatter - zones, devices and moods as a nested XML tree
 */

import { escapeXmlText } from './xml-utils';

/**
 * Home structure data (from ZoneDeviceManager.getHomeStructure())
 */
export interface HomeStructure {
  zones: Array<{
    id: string;
    name: string;
    parent: string | null;
    icon: string;
  }>;
  devices: Array<{
    id: string;
    name: string;
    zone: string;
    zoneName: string;
    driverUri: string;
    class: string;
    capabilities: string[];
    available: boolean;
    ready: boolean;
  }>;
  moods: Array<{
    id: string;
    name: string;
    zone: string;
    preset: string | null;
    deviceCount: number;
  }>;
}

/**
 * Format complete home structure (zones + devices + moods) as XML
 * @param structure - Home structure from ZoneDeviceManager
 * @returns Formatted XML string with instructions
 */
export function formatHomeStructure(structure: HomeStructure): string {
  let message = 'Here is your complete home structure in XML format for easy parsing:\n\n';
  message += `SUMMARY: ${structure.zones.length} zones, ${structure.devices.length} devices, ${structure.moods.length} moods\n\n`;
  message += '<home>\n';
  message += buildZoneHierarchyXML(structure.zones, null, structure.devices, structure.moods);
  message += '</home>\n\n';
  message += getHomeStructureInstructions();

  return message;
}

/**
 * Build hierarchical zone XML with nested devices and moods
 * @param zones - All zones
 * @param parentId - Parent zone ID (null for root zones)
 * @param devices - All devices
 * @param moods - All moods
 * @returns XML string
 */
function buildZoneHierarchyXML(
  zones: HomeStructure['zones'],
  parentId: string | null,
  devices: HomeStructure['devices'],
  moods: HomeStructure['moods'],
): string {
  return zones
    .filter((zone) => zone.parent === parentId)
    .map((zone) => buildZoneXML(zone, zones, devices, moods))
    .join('');
}

/** One zone with its devices, its moods and (recursively) its child zones */
function buildZoneXML(
  zone: HomeStructure['zones'][number],
  zones: HomeStructure['zones'],
  devices: HomeStructure['devices'],
  moods: HomeStructure['moods'],
): string {
  // Only include icon if it's not default
  const iconAttr = zone.icon && zone.icon !== 'default' ? ` icon="${escapeXmlText(zone.icon)}"` : '';
  return `  <zone id="${zone.id}" name="${escapeXmlText(zone.name)}"${iconAttr}>\n${
    devices.filter((device) => device.zone === zone.id).map(buildDeviceXML).join('')
  }${buildMoodsXML(moods.filter((mood) => mood.zone === zone.id))
  }${buildZoneHierarchyXML(zones, zone.id, devices, moods)
  }  </zone>\n`;
}

function buildMoodsXML(moodsInZone: HomeStructure['moods']): string {
  if (moodsInZone.length === 0) return '';
  return `    <moods count="${moodsInZone.length}">\n${moodsInZone.map(buildMoodXML).join('')}    </moods>\n`;
}

/**
 * Build XML for a single device
 * @param device - Device data
 * @returns XML string for device
 */
function buildDeviceXML(device: HomeStructure['devices'][0]): string {
  // Extract app ID from driverUri
  const appId = extractAppId(device.driverUri);

  // Use device class as tag name (e.g., <light>, <sensor>, <socket>)
  const deviceTag = device.class || 'device';

  // Capabilities as comma-separated list
  const capsList = device.capabilities.join(',');

  // Only include status/ready if they are NOT the default (available/ready)
  let statusAttr = '';
  if (!device.available) {
    statusAttr += ' status="unavailable"';
  }
  if (!device.ready) {
    statusAttr += ' ready="not-ready"';
  }

  return `    <${deviceTag} id="${device.id}" name="${escapeXmlText(device.name)}" app-id="${escapeXmlText(appId)}"${statusAttr} capabilities="${escapeXmlText(capsList)}" />\n`;
}

/**
 * Build XML for a single mood
 * @param mood - Mood data
 * @returns XML string for mood
 */
function buildMoodXML(mood: HomeStructure['moods'][0]): string {
  const presetAttr = mood.preset ? ` preset="${escapeXmlText(mood.preset)}"` : '';
  return `      <mood id="${mood.id}" name="${escapeXmlText(mood.name)}"${presetAttr} device-count="${mood.deviceCount}" />\n`;
}

/**
 * Extract app ID from driverUri
 * @param driverUri - Driver URI (e.g., 'homey:app:com.athom.hue:driver')
 * @returns App ID (e.g., 'com.athom.hue')
 */
function extractAppId(driverUri: string): string {
  if (!driverUri || driverUri === 'unknown') {
    return 'unknown';
  }

  const parts = driverUri.split(':');
  if (parts.length < 2) {
    return 'unknown';
  }

  // Format: homey:app:com.athom.hue:driver
  if (parts[0] === 'homey' && parts[1] === 'app' && parts.length >= 3) {
    return parts[2];
  }

  // Format: com.athom.hue:driver
  if (parts.length >= 1) {
    return parts[0];
  }

  return 'unknown';
}

/**
 * Get instructions for home structure XML
 */
function getHomeStructureInstructions(): string {
  return `INSTRUCTIONS:
- This is STATIC data - keep it in your context for the entire conversation
- Device tag name indicates type: <light>, <socket>, <sensor>, <thermostat>, etc.
- DEFAULT VALUES (omitted when default): status="available", ready="ready", icon="default"
- If status/ready/icon attributes are MISSING, assume the defaults above
- Moods are scenes that control multiple devices at once (nested under their zone)
- For current values (on/off, temperature, etc.), use get_states tool
- Moods are read-only (activation not supported via API - users can create custom flows)
`;
}
