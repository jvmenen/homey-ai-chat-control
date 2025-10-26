/**
 * Type definitions for Homey MCP Server
 */

/**
 * Homey Flow structure (from Homey API)
 * Represents both simple flows (with trigger) and advanced flows (with cards)
 */
export interface HomeyFlow {
  /** Unique flow identifier */
  id: string;
  /** Flow name */
  name: string;
  /** Whether the flow is enabled */
  enabled: boolean;
  /** Optional folder/category */
  folder?: string;
  /** Simple flow trigger (regular flows) */
  trigger?: FlowTrigger;
  /** Advanced flow cards (advanced flows) - can be array or object */
  cards?: FlowCard[] | Record<string, FlowCard>;
}

/**
 * Flow trigger card definition
 * Used in simple flows to define the trigger condition
 */
export interface FlowTrigger {
  /** Trigger card ID (e.g., 'mcp_command_received') */
  id: string;
  /** Full URI (e.g., 'homey:app:nl.vmcc.homeymcpserver:mcp_command_received') */
  uri?: string;
  /** Trigger arguments configured by user in the flow */
  args?: Record<string, any>;
}

/**
 * Flow card (trigger, condition, or action)
 * Used in advanced flows
 */
export interface FlowCard {
  /** Card ID */
  id: string;
  /** Card type */
  type: 'trigger' | 'condition' | 'action';
  /** Card arguments configured by user */
  args?: Record<string, any>;
  /** Optional card URI */
  uri?: string;
}

/**
 * MCP Tool definition structure
 * Follows Model Context Protocol specification
 */
export interface MCPTool {
  /** Tool name (must be unique) */
  name: string;
  /** Human-readable description of what the tool does */
  description: string;
  /** JSON Schema defining the tool's input parameters */
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * Flow execution result
 * Returned when triggering a Homey flow
 */
export interface FlowExecutionResult {
  /** Whether the flow was triggered successfully */
  success: boolean;
  /** Optional success message */
  message?: string;
  /** Optional error message if failed */
  error?: string;
}

/**
 * MCP Tool call result
 * Standard response format for MCP tools
 */
export interface MCPToolCallResult {
  /** Content blocks returned by the tool */
  content: Array<{
    type: 'text';
    text: string;
  }>;
  /** Whether this result represents an error */
  isError?: boolean;
}

/**
 * Homey Zone representation
 * A zone is a physical location in the home (room, floor, etc.)
 */
export interface HomeyZone {
  /** Unique zone identifier */
  id: string;
  /** Zone name (e.g., "Living Room") */
  name: string;
  /** Parent zone ID (null for root zones) */
  parent: string | null;
  /** Icon identifier */
  icon: string;
  /** Whether any sensors in this zone are active/triggered */
  active: boolean;
  /** List of devices/sensors that triggered active state */
  activeOrigins: string[];
  /** Timestamp of last activity */
  activeLastUpdated: string | null;
}

/**
 * Homey Device representation
 * Represents a smart home device (light, sensor, thermostat, etc.)
 */
export interface HomeyDevice {
  /** Unique device identifier */
  id: string;
  /** Device name (user-configured) */
  name: string;
  /** Zone ID where device is located */
  zone: string;
  /** Zone name (enriched from zone lookup) */
  zoneName?: string;
  /** Driver URI (identifies device type/driver) */
  driverUri: string;
  /** Device class (e.g., 'light', 'sensor', 'thermostat') */
  class: string;
  /** List of capability IDs this device supports */
  capabilities: string[];
  /** Full capability objects with current values */
  capabilitiesObj: Record<string, DeviceCapability>;
  /** Whether device is currently available/reachable */
  available: boolean;
  /** Whether device is ready for use */
  ready: boolean;
}

/**
 * Device Capability definition
 * Represents a controllable/readable property of a device
 */
export interface DeviceCapability {
  /** Capability ID (e.g., 'onoff', 'dim', 'target_temperature') */
  id: string;
  /** Current value of the capability */
  value: any;
  /** Data type ('boolean', 'number', 'string', 'enum') */
  type: string;
  /** Human-readable title */
  title: string;
  /** Optional units (e.g., '°C', '%', 'W') */
  units?: string;
  /** Whether capability can be read */
  getable: boolean;
  /** Whether capability can be written/controlled */
  setable: boolean;
  /** Minimum value (for number types) */
  min?: number;
  /** Maximum value (for number types) */
  max?: number;
  /** Allowed values (for enum types) */
  values?: any[];
}

/**
 * Zone hierarchy structure
 * Recursive tree structure of zones and their devices
 */
export interface ZoneHierarchy {
  /** The zone */
  zone: HomeyZone;
  /** Child zones (sub-zones) */
  children: ZoneHierarchy[];
  /** Devices in this zone */
  devices: HomeyDevice[];
}

/**
 * Temperature reading from a single device
 */
export interface TemperatureReading {
  /** Device ID */
  deviceId: string;
  /** Device name */
  deviceName: string;
  /** Temperature value */
  temperature: number;
  /** Temperature units (°C or °F) */
  units: string;
}

/**
 * Aggregated temperature readings for a zone
 */
export interface ZoneTemperatureResult {
  /** Zone ID */
  zoneId: string;
  /** Zone name */
  zoneName: string;
  /** Individual temperature readings from devices */
  readings: TemperatureReading[];
  /** Average temperature across all devices */
  average?: number;
  /** Minimum temperature reading */
  min?: number;
  /** Maximum temperature reading */
  max?: number;
}
