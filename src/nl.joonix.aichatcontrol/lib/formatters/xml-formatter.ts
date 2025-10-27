/**
 * XML Formatter - Format data structures as XML for MCP responses
 */

/**
 * Device states data (from ZoneDeviceManager.getStates())
 */
interface DeviceStates {
  devices: Array<{
    id: string;
    name: string;
    zone: string;
    class: string;
    capabilities: Record<string, any>;
  }>;
  activeZones?: Array<{
    id: string;
    name: string;
    active: boolean;
    activeOrigins: string[];
  }>;
}

/**
 * Home structure data (from ZoneDeviceManager.getHomeStructure())
 */
interface HomeStructure {
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
}

/**
 * Format home structure and device data as XML
 */
export class XMLFormatter {
  /**
   * Format complete home structure (zones + devices) as XML
   * @param structure - Home structure from ZoneDeviceManager
   * @returns Formatted XML string with instructions
   */
  static formatHomeStructure(structure: HomeStructure): string {
    let message = `Here is your complete home structure in XML format for easy parsing:\n\n`;
    message += `SUMMARY: ${structure.zones.length} zones, ${structure.devices.length} devices\n\n`;
    message += `<home>\n`;
    message += this.buildZoneHierarchyXML(structure.zones, null, structure.devices);
    message += `</home>\n\n`;
    message += this.getHomeStructureInstructions();

    return message;
  }

  /**
   * Build hierarchical zone XML with nested devices
   * @param zones - All zones
   * @param parentId - Parent zone ID (null for root zones)
   * @param devices - All devices
   * @returns XML string
   */
  private static buildZoneHierarchyXML(
    zones: HomeStructure['zones'],
    parentId: string | null,
    devices: HomeStructure['devices']
  ): string {
    let xml = '';
    const children = zones.filter((z) => z.parent === parentId);

    children.forEach((zone) => {
      // Only include icon if it's not default
      const iconAttr = zone.icon && zone.icon !== 'default' ? ` icon="${zone.icon}"` : '';
      xml += `  <zone id="${zone.id}" name="${zone.name}"${iconAttr}>\n`;

      // Add devices in this zone
      const devicesInZone = devices.filter((d) => d.zone === zone.id);
      devicesInZone.forEach((device) => {
        xml += this.buildDeviceXML(device);
      });

      // Recurse for child zones
      const childXML = this.buildZoneHierarchyXML(zones, zone.id, devices);
      if (childXML) {
        xml += childXML;
      }

      xml += `  </zone>\n`;
    });

    return xml;
  }

  /**
   * Build XML for a single device
   * @param device - Device data
   * @returns XML string for device
   */
  private static buildDeviceXML(device: HomeStructure['devices'][0]): string {
    // Extract app ID from driverUri
    const appId = this.extractAppId(device.driverUri);

    // Use device class as tag name (e.g., <light>, <sensor>, <socket>)
    const deviceTag = device.class || 'device';

    // Capabilities as comma-separated list
    const capsList = device.capabilities.join(',');

    // Only include status/ready if they are NOT the default (available/ready)
    let statusAttr = '';
    if (!device.available) {
      statusAttr += ` status="unavailable"`;
    }
    if (!device.ready) {
      statusAttr += ` ready="not-ready"`;
    }

    return `    <${deviceTag} id="${device.id}" name="${device.name}" app="${appId}"${statusAttr} capabilities="${capsList}" />\n`;
  }

  /**
   * Extract app ID from driverUri
   * @param driverUri - Driver URI (e.g., 'homey:app:com.athom.hue:driver')
   * @returns App ID (e.g., 'com.athom.hue')
   */
  private static extractAppId(driverUri: string): string {
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
  private static getHomeStructureInstructions(): string {
    return `INSTRUCTIONS:
- This is STATIC data - keep it in your context for the entire conversation
- Use device "id" attribute to control devices
- Use zone "id" attribute for zone-based operations
- Device tag name indicates type: <light>, <socket>, <sensor>, <thermostat>, etc.
- "app" attribute shows which Homey app controls this device (e.g., com.athom.hue = Philips Hue)
- "capabilities" attribute is comma-separated list of what you can read/control
- DEFAULT VALUES (omitted when default): status="available", ready="ready", icon="default"
- If status/ready/icon attributes are MISSING, assume the defaults above
- Only non-default values are shown (e.g., status="unavailable" means device is offline)
- For current values (on/off, temperature, etc.), use get_states tool
`;
  }

  /**
   * Format device states as XML
   * @param states - Device states from ZoneDeviceManager
   * @param filters - Optional filter info for summary
   * @returns Formatted XML string with instructions
   */
  static formatDeviceStates(
    states: DeviceStates,
    filters?: { zoneId?: string; deviceIds?: string[]; capability?: string }
  ): string {
    let message = `Current device states in XML format for easy parsing:\n\n`;

    const filterSummary = [];
    if (filters?.zoneId) filterSummary.push(`zone="${filters.zoneId}"`);
    if (filters?.capability) filterSummary.push(`capability="${filters.capability}"`);
    if (filters?.deviceIds) filterSummary.push(`deviceCount="${filters.deviceIds.length}"`);

    message += `<states${filterSummary.length > 0 ? ' ' + filterSummary.join(' ') : ''}>\n`;

    if (states.devices.length === 0) {
      message += `  <!-- No devices found matching the filters -->\n`;
    } else {
      states.devices.forEach((device) => {
        const deviceTag = device.class || 'device';
        message += `  <${deviceTag} id="${device.id}" name="${device.name}" zone="${device.zone}">\n`;

        const capEntries = Object.entries(device.capabilities);
        if (capEntries.length > 0) {
          capEntries.forEach(([cap, value]) => {
            const valueType = typeof value;
            const valueStr = String(value);

            if (typeof value === 'boolean') {
              message += `    <capability name="${cap}" type="${valueType}" value="${value}" state="${value ? 'on' : 'off'}" />\n`;
            } else {
              message += `    <capability name="${cap}" type="${valueType}" value="${valueStr}" />\n`;
            }
          });
        } else {
          message += `    <!-- No readable capabilities -->\n`;
        }

        message += `  </${deviceTag}>\n`;
      });
    }

    // Show active zones
    if (states.activeZones && states.activeZones.length > 0) {
      message += `\n  <active-zones count="${states.activeZones.length}">\n`;
      states.activeZones.forEach((zone) => {
        const origins = zone.activeOrigins.length > 0 ? ` origins="${zone.activeOrigins.join(', ')}"` : '';
        message += `    <zone id="${zone.id}" name="${zone.name}"${origins} />\n`;
      });
      message += `  </active-zones>\n`;
    }

    message += `</states>\n\n`;
    message += this.getDeviceStatesInstructions();

    return message;
  }

  /**
   * Get instructions for device states XML
   */
  private static getDeviceStatesInstructions(): string {
    return `INSTRUCTIONS:
- Device tag name indicates type: <light>, <socket>, <sensor>, etc.
- Use device "id" attribute to control devices
- Boolean capabilities have "state" attribute (on/off) for easy checking
- "value" contains the raw value, "type" shows the data type
- Active zones show which rooms currently have motion/presence detected
- Use get_home_structure to look up zone name from zone ID
`;
  }
}
