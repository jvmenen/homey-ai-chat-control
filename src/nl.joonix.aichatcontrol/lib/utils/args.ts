/**
 * Helpers for reading MCP tool arguments
 */

/**
 * Read a positive number argument, falling back to a default when it is missing or invalid.
 * An optional maximum caps the value.
 */
export function positiveNumberArg(value: unknown, fallback: number, max?: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return max !== undefined ? Math.min(n, max) : n;
}

/** Read an optional positive number argument; undefined when missing or invalid */
export function optionalPositiveNumberArg(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Read an optional non-empty string argument */
export function optionalStringArg(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}
