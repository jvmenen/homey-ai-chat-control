/**
 * Application-wide constants
 */

/**
 * MCP Trigger Card identifiers used in Homey flows
 */
export const MCP_TRIGGER_IDS = {
  /** Short form trigger ID */
  SHORT: 'mcp_command_received',
  /** Full URI form trigger ID */
  FULL: 'homey:app:nl.vmcc.homeymcpserver:mcp_command_received',
  /** Suffix used to match trigger IDs */
  SUFFIX: ':mcp_command_received',
} as const;

/**
 * Common device capability names
 */
export const CAPABILITY_NAMES = {
  /** On/Off capability */
  ONOFF: 'onoff',
  /** Dim level (0-1) */
  DIM: 'dim',
  /** Target temperature (°C) */
  TARGET_TEMPERATURE: 'target_temperature',
  /** Measured temperature (°C) */
  MEASURE_TEMPERATURE: 'measure_temperature',
  /** Volume level (0-1) */
  VOLUME_SET: 'volume_set',
  /** Light hue (0-1) */
  LIGHT_HUE: 'light_hue',
  /** Light saturation (0-1) */
  LIGHT_SATURATION: 'light_saturation',
  /** Light temperature (0-1) */
  LIGHT_TEMPERATURE: 'light_temperature',
  /** Light mode */
  LIGHT_MODE: 'light_mode',
} as const;

/**
 * Flow token names for parameter passing
 */
export const TOKEN_NAMES = {
  /** Command name token */
  COMMAND: 'command',
  /** First value token */
  VALUE_1: 'value1',
  /** Second value token */
  VALUE_2: 'value2',
  /** Third value token */
  VALUE_3: 'value3',
  /** Fourth value token */
  VALUE_4: 'value4',
  /** Fifth value token */
  VALUE_5: 'value5',
} as const;

/**
 * MCP Server configuration
 */
export const MCP_SERVER_CONFIG = {
  /** Protocol version */
  PROTOCOL_VERSION: '2025-06-18',
  /** Server name */
  SERVER_NAME: 'homey-mcp-server',
  /** Server version */
  SERVER_VERSION: '0.1.0',
  /** HTTP server port */
  HTTP_PORT: 3000,
  /** HTTP server host (bind to all interfaces) */
  HTTP_HOST: '0.0.0.0',
} as const;

/**
 * JSON-RPC error codes
 */
export const JSONRPC_ERROR_CODES = {
  /** Parse error */
  PARSE_ERROR: -32700,
  /** Invalid request */
  INVALID_REQUEST: -32600,
  /** Method not found */
  METHOD_NOT_FOUND: -32601,
  /** Invalid params */
  INVALID_PARAMS: -32602,
  /** Internal error */
  INTERNAL_ERROR: -32603,
} as const;

/**
 * Cache configuration (for future use when Task #9 is implemented)
 */
export const CACHE_CONFIG = {
  /** Cache TTL in milliseconds (5 seconds) */
  TTL: 5000,
  /** Maximum cache size */
  MAX_SIZE: 1000,
} as const;
