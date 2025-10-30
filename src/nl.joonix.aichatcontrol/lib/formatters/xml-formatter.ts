/**
 * XML Formatter - Format data structures as XML for MCP responses
 */

import { FlowOverviewData } from '../interfaces';

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

    return `    <${deviceTag} id="${device.id}" name="${device.name}" app-id="${appId}"${statusAttr} capabilities="${capsList}" />\n`;
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
- Device tag name indicates type: <light>, <socket>, <sensor>, <thermostat>, etc.
- DEFAULT VALUES (omitted when default): status="available", ready="ready", icon="default"
- If status/ready/icon attributes are MISSING, assume the defaults above
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
    if (filters?.zoneId) filterSummary.push(`zone-id="${filters.zoneId}"`);
    if (filters?.capability) filterSummary.push(`capability="${filters.capability}"`);
    if (filters?.deviceIds) filterSummary.push(`device-count="${filters.deviceIds.length}"`);

    message += `<states${filterSummary.length > 0 ? ' ' + filterSummary.join(' ') : ''}>\n`;

    if (states.devices.length === 0) {
      message += `  <!-- No devices found matching the filters -->\n`;
    } else {
      states.devices.forEach((device) => {
        const deviceTag = device.class || 'device';
        message += `  <${deviceTag} id="${device.id}" name="${device.name}" zone-id="${device.zone}">\n`;

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
- Boolean capabilities have "state" attribute (on/off) for easy checking
- Active zones show which rooms currently have motion/presence detected
- Use get_home_structure to look up zone name from zone-id
`;
  }

  /**
   * Format complete flow overview as XML (similar to formatHomeStructure)
   * @param overview - Flow overview data from FlowManager
   * @returns Formatted XML string with instructions
   */
  static formatFlowOverview(overview: FlowOverviewData): string {
    const { summary } = overview;

    let message = `Here is your complete flow overview in XML format for easy parsing:\n\n`;
    message += `SUMMARY: ${summary.total} flows (${summary.enabled} enabled, ${summary.disabled} disabled, ${summary.mcpFlows} MCP flows)\n\n`;
    message += `<flows total="${summary.total}" enabled="${summary.enabled}" disabled="${summary.disabled}">\n`;

    for (const flow of overview.flows) {
      message += this.buildFlowXML(flow);
    }

    message += `</flows>\n\n`;
    message += this.getFlowOverviewInstructions();

    return message;
  }

  /**
   * Build XML for a single flow
   */
  private static buildFlowXML(flow: FlowOverviewData['flows'][0]): string {
    let xml = `  <flow id="${this.escapeXml(flow.id)}" name="${this.escapeXml(flow.name)}"`;

    // Only include non-default values
    if (flow.type === 'advanced') {
      xml += ` type="advanced"`;
    }

    if (flow.folderPath) {
      xml += ` folder-path="${this.escapeXml(flow.folderPath)}"`;
    } else if (flow.folder) {
      // Fallback to folder ID if path not available
      xml += ` folder-id="${this.escapeXml(flow.folder)}"`;
    }

    if (!flow.enabled) {
      xml += ` enabled="false"`;
    }

    if (flow.mcpCommand) {
      xml += ` mcp-command="${this.escapeXml(flow.mcpCommand)}"`;
    }

    xml += `>\n`;

    // Add cards
    for (const card of flow.cards) {
      xml += `    <${card.type}`;
      xml += ` app-id="${this.escapeXml(card.appId)}"`;
      xml += ` card-id="${this.escapeXml(card.cardId)}"`;

      if (card.deviceId) {
        xml += ` device-id="${this.escapeXml(card.deviceId)}"`;
      }

      // Check if we have args, tokens, or tokenInput to display
      const hasArgs = card.args && Object.keys(card.args).length > 0;
      const hasTokens = card.tokens && card.tokens.length > 0;
      const hasTokenInput = !!card.tokenInput;

      if (hasArgs || hasTokens || hasTokenInput) {
        xml += `>\n`;

        // Add card arguments if present
        if (hasArgs) {
          for (const [key, value] of Object.entries(card.args!)) {
            // Skip device-related args as they're already in device attribute
            if (key === 'device' || key === 'deviceId' || key === 'deviceUri') continue;

            const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
            xml += `      <arg name="${this.escapeXml(key)}" value="${this.escapeXml(valueStr)}" />\n`;
          }
        }

        // Add token input if present (token consumed by this card)
        if (hasTokenInput) {
          xml += `      <token-input device-id="${this.escapeXml(card.tokenInput!.deviceId)}" capability="${this.escapeXml(card.tokenInput!.capability)}" />\n`;
        }

        // Add tokens if present (tokens provided by trigger cards)
        if (hasTokens) {
          for (const token of card.tokens!) {
            const tokenName = token.name || 'unknown';
            const tokenType = token.type || '';
            const tokenTitle = token.title || tokenName;
            xml += `      <token name="${this.escapeXml(tokenName)}" type="${this.escapeXml(tokenType)}" title="${this.escapeXml(tokenTitle)}" />\n`;
          }
        }

        xml += `    </${card.type}>\n`;
      } else {
        xml += ` />\n`;
      }
    }

    xml += `  </flow>\n`;

    return xml;
  }

  /**
   * Escape XML special characters
   */
  private static escapeXml(str: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Get instructions for flow overview XML
   */
  private static getFlowOverviewInstructions(): string {
    return `INSTRUCTIONS:
- This shows ALL flows in your Homey (automation logic)
- DEFAULT VALUES (omitted when default): enabled="true", type="regular"
- If enabled/type attributes are MISSING, assume the defaults above
- Cards show the automation logic: <trigger>, <condition>, <action>
- <arg> elements show card parameters (e.g., temperature value, duration, etc.)
- <token-input> shows when a card CONSUMES a dynamic variable from another device
- <token> elements show when a trigger PRODUCES dynamic variables for use in other cards
- Use get_home_structure to look up device names from device IDs
`;
  }
}
