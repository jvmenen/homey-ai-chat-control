/**
 * Application-wide constants
 */

/**
 * MCP Trigger Card identifiers used in Homey flows
 */
export const MCP_TRIGGER_IDS = {
  /** Short form trigger ID */
  SHORT: 'ai_tool_call',
  /** Full URI form trigger ID */
  FULL: 'homey:app:nl.joonix.aichatcontrol:ai_tool_call',
  /** Suffix used to match trigger IDs */
  SUFFIX: ':ai_tool_call',
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
