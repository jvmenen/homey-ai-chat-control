/**
 * Type definitions for Homey MCP Server
 */

// Homey Flow structure (from Homey API)
export interface HomeyFlow {
  id: string;
  name: string;
  enabled: boolean;
  folder?: string;
  trigger?: any;
}

// MCP Tool structure
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// Flow execution result
export interface FlowExecutionResult {
  success: boolean;
  message?: string;
  error?: string;
}

// MCP Tool call result
export interface MCPToolCallResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

// Zone types
export interface HomeyZone {
  id: string;
  name: string;
  parent: string | null;
  icon: string;
  active: boolean;
  activeOrigins: string[];
  activeLastUpdated: string | null;
}

// Device types
export interface HomeyDevice {
  id: string;
  name: string;
  zone: string;
  zoneName?: string;
  driverUri: string;
  class: string;
  capabilities: string[];
  capabilitiesObj: Record<string, DeviceCapability>;
  available: boolean;
  ready: boolean;
}

export interface DeviceCapability {
  id: string;
  value: any;
  type: string;
  title: string;
  units?: string;
  getable: boolean;
  setable: boolean;
}

// Zone hierarchy structure
export interface ZoneHierarchy {
  zone: HomeyZone;
  children: ZoneHierarchy[];
  devices: HomeyDevice[];
}

// Temperature reading result
export interface TemperatureReading {
  deviceId: string;
  deviceName: string;
  temperature: number;
  units: string;
}

export interface ZoneTemperatureResult {
  zoneId: string;
  zoneName: string;
  readings: TemperatureReading[];
  average?: number;
  min?: number;
  max?: number;
}
