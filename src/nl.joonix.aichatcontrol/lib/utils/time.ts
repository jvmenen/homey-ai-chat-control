/**
 * Time helpers shared by diagnostic tools
 */

export const MS_PER_HOUR = 3600000;

/** Hours elapsed since an epoch-ms timestamp, rounded to one decimal */
export function hoursSince(epochMs: number, now: number = Date.now()): number {
  return Math.round(((now - epochMs) / MS_PER_HOUR) * 10) / 10;
}

/**
 * Normalize a Homey timestamp to epoch ms.
 * Capability timestamps from the Homey REST client are Date objects; other API data has numbers or ISO strings.
 */
export function toEpochMs(value: unknown): number | null {
  let ms: number | null = null;
  if (value instanceof Date) ms = value.getTime();
  else if (typeof value === 'number') ms = value;
  else if (typeof value === 'string') ms = Date.parse(value);
  return ms !== null && Number.isFinite(ms) && ms > 0 ? ms : null;
}
