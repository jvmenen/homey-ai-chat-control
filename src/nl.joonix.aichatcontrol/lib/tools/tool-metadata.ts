/**
 * Tool Metadata Registry
 *
 * Lightweight metadata for all tools to support progressive disclosure.
 * This allows search_tools to return quick summaries without loading full definitions.
 */

export interface ToolMetadata {
  name: string;
  category: 'core' | 'control' | 'query' | 'insights' | 'flows' | 'apps';
  shortDescription: string;
  tags: string[];
  requiresDeviceId?: boolean;
  requiresZoneId?: boolean;
}

/**
 * Tool metadata for all registered tools
 * Used by search_tools for discovery
 */
export const TOOL_METADATA: Record<string, ToolMetadata> = {
  // ===== CORE TOOLS (always in tools/list) =====
  get_home_structure: {
    name: 'get_home_structure',
    category: 'core',
    shortDescription: 'Get complete home layout with zones and all devices',
    tags: ['structure', 'zones', 'devices', 'overview', 'layout'],
  },

  get_states: {
    name: 'get_states',
    category: 'core',
    shortDescription: 'Get current state values for all devices or specific devices',
    tags: ['states', 'values', 'status', 'current', 'capabilities'],
  },

  get_flow_overview: {
    name: 'get_flow_overview',
    category: 'core',
    shortDescription: 'List all available Homey flows and their trigger commands',
    tags: ['flows', 'list', 'overview', 'commands'],
  },

  // ===== CONTROL TOOLS (discovered via search_tools) =====
  set_light: {
    name: 'set_light',
    category: 'control',
    shortDescription: 'Control light brightness (0-100), color, and power state',
    tags: ['lights', 'control', 'brightness', 'dim', 'color', 'on', 'off'],
    requiresDeviceId: true,
  },

  set_thermostat: {
    name: 'set_thermostat',
    category: 'control',
    shortDescription: 'Set thermostat target temperature in Celsius',
    tags: ['thermostat', 'temperature', 'heating', 'climate', 'control'],
    requiresDeviceId: true,
  },

  control_device: {
    name: 'control_device',
    category: 'control',
    shortDescription: 'Universal device control - set any capability on any device',
    tags: ['control', 'device', 'universal', 'capability', 'set'],
    requiresDeviceId: true,
  },

  toggle_device: {
    name: 'toggle_device',
    category: 'control',
    shortDescription: 'Toggle device on/off state',
    tags: ['toggle', 'switch', 'on', 'off', 'control'],
    requiresDeviceId: true,
  },

  control_zone_lights: {
    name: 'control_zone_lights',
    category: 'control',
    shortDescription: 'Control all lights in a zone simultaneously',
    tags: ['lights', 'zone', 'bulk', 'control', 'brightness'],
    requiresZoneId: true,
  },

  control_zone_capability: {
    name: 'control_zone_capability',
    category: 'control',
    shortDescription: 'Control any capability for all devices in a zone',
    tags: ['zone', 'bulk', 'control', 'capability', 'universal'],
    requiresZoneId: true,
  },

  // ===== INSIGHTS TOOLS =====
  get_insight_logs: {
    name: 'get_insight_logs',
    category: 'insights',
    shortDescription: 'List available insight logs (sensors, meters, etc.)',
    tags: ['insights', 'logs', 'sensors', 'meters', 'list', 'discovery'],
  },

  get_insight_data: {
    name: 'get_insight_data',
    category: 'insights',
    shortDescription: 'Get historical time-series data for insight logs',
    tags: ['insights', 'data', 'history', 'timeseries', 'graphs', 'trends'],
  },

  // ===== APPS TOOLS =====
  get_installed_apps: {
    name: 'get_installed_apps',
    category: 'apps',
    shortDescription: 'List all installed Homey apps with version info',
    tags: ['apps', 'installed', 'list', 'versions'],
  },

  // ===== FLOWS TOOLS =====
  refresh_homey_flows: {
    name: 'refresh_homey_flows',
    category: 'flows',
    shortDescription: 'Refresh the list of available flows and flow-based tools',
    tags: ['flows', 'refresh', 'reload', 'update'],
  },

  // NOTE: trigger_any_flow is NOT in metadata - it's internal only
  // Used by mcp-server-manager for flow-based tools delegation
};

/**
 * Get metadata for a specific tool
 */
export function getToolMetadata(toolName: string): ToolMetadata | undefined {
  return TOOL_METADATA[toolName];
}

/**
 * Get all tool names by category
 */
export function getToolsByCategory(category: ToolMetadata['category']): string[] {
  return Object.values(TOOL_METADATA)
    .filter((meta) => meta.category === category)
    .map((meta) => meta.name);
}

/**
 * Check if a tool is a core tool (always in tools/list)
 */
export function isCoreToolMetadata(toolName: string): boolean {
  const meta = TOOL_METADATA[toolName];
  return meta?.category === 'core';
}

/**
 * Search tools by query string
 * Searches in name, description, and tags
 */
export function searchTools(query: string, category?: ToolMetadata['category']): ToolMetadata[] {
  const lowerQuery = query.toLowerCase();

  return Object.values(TOOL_METADATA).filter((meta) => {
    // Category filter
    if (category && meta.category !== category) {
      return false;
    }

    // Text search
    const searchText = `${meta.name} ${meta.shortDescription} ${meta.tags.join(' ')}`.toLowerCase();
    return searchText.includes(lowerQuery);
  });
}
