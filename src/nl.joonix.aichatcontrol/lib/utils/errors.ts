/**
 * Custom error classes for Homey MCP Server
 * Provides consistent, type-safe error handling across the application
 */

/**
 * Base error class for all Homey MCP errors
 */
export class HomeyMCPError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'HomeyMCPError';
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Device not found error
 */
export class DeviceNotFoundError extends HomeyMCPError {
  constructor(deviceId: string) {
    super(`Device ${deviceId} not found`, 'DEVICE_NOT_FOUND');
    this.name = 'DeviceNotFoundError';
  }
}

/**
 * Zone not found error
 */
export class ZoneNotFoundError extends HomeyMCPError {
  constructor(zoneId: string) {
    super(`Zone ${zoneId} not found`, 'ZONE_NOT_FOUND');
    this.name = 'ZoneNotFoundError';
  }
}

/**
 * Flow not found error
 */
export class FlowNotFoundError extends HomeyMCPError {
  constructor(flowIdentifier: string) {
    super(`Flow "${flowIdentifier}" not found`, 'FLOW_NOT_FOUND');
    this.name = 'FlowNotFoundError';
  }
}

/**
 * Capability not found error
 */
export class CapabilityNotFoundError extends HomeyMCPError {
  constructor(deviceName: string, capability: string) {
    super(`Device "${deviceName}" does not have capability "${capability}"`, 'CAPABILITY_NOT_FOUND');
    this.name = 'CapabilityNotFoundError';
  }
}

/**
 * Capability not writable error
 */
export class CapabilityNotWritableError extends HomeyMCPError {
  constructor(capability: string) {
    super(`Capability "${capability}" is not writable`, 'CAPABILITY_NOT_WRITABLE');
    this.name = 'CapabilityNotWritableError';
  }
}

/**
 * Capability value validation error
 */
export class CapabilityValueError extends HomeyMCPError {
  constructor(message: string) {
    super(message, 'CAPABILITY_VALUE_ERROR');
    this.name = 'CapabilityValueError';
  }
}

/**
 * API initialization error
 */
export class APIInitializationError extends HomeyMCPError {
  constructor(apiName: string, originalError?: Error) {
    const message = originalError
      ? `Failed to initialize ${apiName}: ${originalError.message}`
      : `Failed to initialize ${apiName}`;
    super(message, 'API_INIT_ERROR');
    this.name = 'APIInitializationError';
  }
}

/**
 * Tool not found error
 */
export class ToolNotFoundError extends HomeyMCPError {
  constructor(toolName: string) {
    super(`Tool "${toolName}" not found`, 'TOOL_NOT_FOUND');
    this.name = 'ToolNotFoundError';
  }
}

/**
 * Invalid parameter error
 */
export class InvalidParameterError extends HomeyMCPError {
  constructor(parameterName: string, reason: string) {
    super(`Invalid parameter "${parameterName}": ${reason}`, 'INVALID_PARAMETER');
    this.name = 'InvalidParameterError';
  }
}
