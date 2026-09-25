/**
 * Device activity diagnostics - pure logic for finding devices that went silent
 */

import type { DeviceState } from '../interfaces';
import { MS_PER_HOUR } from '../utils/time';

/** Most recent capability update of a device (epoch ms), or null when unknown */
export function lastDeviceUpdate(device: DeviceState): number | null {
  const times = Object.values(device.capabilityUpdated || {});
  return times.length > 0 ? Math.max(...times) : null;
}

/**
 * Keep devices whose most recent capability update is older than the given number of hours,
 * longest silence first. Devices without any timestamp are left out.
 */
export function filterSilentDevices(
  devices: DeviceState[],
  silentForHours: number,
  now: number = Date.now(),
): DeviceState[] {
  const threshold = now - silentForHours * MS_PER_HOUR;
  return devices
    .map((device) => ({ device, last: lastDeviceUpdate(device) }))
    .filter((entry): entry is { device: DeviceState; last: number } => entry.last !== null && entry.last < threshold)
    .sort((a, b) => a.last - b.last)
    .map((entry) => entry.device);
}
