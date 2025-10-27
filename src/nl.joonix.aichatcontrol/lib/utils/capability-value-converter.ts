/**
 * Capability Value Converter - Type conversion and validation for device capabilities
 */

import { CapabilityValueError } from './errors';

export interface DeviceCapability {
  type: string;
  min?: number;
  max?: number;
  values?: any[];
}

/**
 * Utility class for converting and validating capability values
 * Handles type conversion from MCP/JSON (often strings) to proper types
 */
export class CapabilityValueConverter {
  /**
   * Convert and validate a value based on capability definition
   */
  static convert(capabilityDef: DeviceCapability, value: any): any {
    const { type } = capabilityDef;

    // Convert based on type
    let convertedValue: any;

    switch (type) {
      case 'boolean':
        convertedValue = this.toBoolean(value);
        break;

      case 'number':
        convertedValue = this.toNumber(value);
        break;

      case 'string':
        convertedValue = this.toString(value);
        break;

      default:
        // Unknown type, pass through
        convertedValue = value;
        break;
    }

    // Validate the converted value
    this.validate(capabilityDef, convertedValue);

    return convertedValue;
  }

  /**
   * Convert value to boolean
   * Handles string "true"/"false", numbers 1/0, and boolean values
   */
  private static toBoolean(value: any): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1') {
        return true;
      }
      if (lower === 'false' || lower === '0') {
        return false;
      }
      throw new CapabilityValueError(`Cannot convert string "${value}" to boolean (must be "true" or "false")`);
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    throw new CapabilityValueError(`Cannot convert ${typeof value} to boolean`);
  }

  /**
   * Convert value to number
   * Handles string numbers and numeric values
   */
  private static toNumber(value: any): number {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const num = parseFloat(value);
      if (isNaN(num)) {
        throw new CapabilityValueError(`Cannot convert "${value}" to number`);
      }
      return num;
    }

    throw new CapabilityValueError(`Cannot convert ${typeof value} to number (expected number or string)`);
  }

  /**
   * Convert value to string
   */
  private static toString(value: any): string {
    if (typeof value === 'string') {
      return value;
    }

    return String(value);
  }

  /**
   * Validate converted value against capability constraints
   */
  private static validate(capabilityDef: DeviceCapability, value: any): void {
    const { type, min, max, values } = capabilityDef;

    // Type validation after conversion
    if (type === 'number' && typeof value !== 'number') {
      throw new CapabilityValueError(`Expected number but got ${typeof value}`);
    }

    if (type === 'boolean' && typeof value !== 'boolean') {
      throw new CapabilityValueError(`Expected boolean but got ${typeof value}`);
    }

    // Range validation for numbers
    if (type === 'number') {
      if (min !== undefined && value < min) {
        throw new CapabilityValueError(`Value ${value} is below minimum ${min}`);
      }

      if (max !== undefined && value > max) {
        throw new CapabilityValueError(`Value ${value} is above maximum ${max}`);
      }
    }

    // Enum validation (if values are specified)
    if (values && values.length > 0) {
      if (!values.includes(value)) {
        throw new CapabilityValueError(`Value ${value} is not one of allowed values: ${values.join(', ')}`);
      }
    }
  }
}
