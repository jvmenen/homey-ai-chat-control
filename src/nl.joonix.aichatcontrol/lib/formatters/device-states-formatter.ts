/**
 * Device states formatter - current device values as XML, one element per device
 */

import type { DeviceState, DeviceStatesResult } from '../interfaces';
import { escapeXml } from './xml-utils';
import { hoursSince } from '../utils/time';

/**
 * Format device states as XML: one element per device, capability values as attributes
 * @param states - Device states from ZoneDeviceManager
 * @param filters - Optional filter info for the summary
 * @param options - includeTimestamps adds per-capability update times; silent describes a silent-device query
 */
export function formatDeviceStates(
  states: DeviceStatesResult,
  filters?: { zoneId?: string; deviceIds?: string[]; capability?: string },
  options?: { includeTimestamps?: boolean; silent?: { hours: number; checked: number } },
): string {
  const now = Date.now();
  let message = 'Current device states in XML format for easy parsing:\n\n';

  if (options?.silent) {
    message += `SUMMARY: ${states.devices.length} of ${options.silent.checked} device(s) reported nothing`
      + ` for more than ${options.silent.hours} hours (longest silence first)\n\n`;
  }

  const filterSummary = [];
  if (filters?.zoneId) filterSummary.push(`zone-id="${filters.zoneId}"`);
  if (filters?.capability) filterSummary.push(`capability="${filters.capability}"`);
  if (filters?.deviceIds) filterSummary.push(`device-count="${filters.deviceIds.length}"`);
  if (options?.silent) filterSummary.push(`silent-for-hours="${options.silent.hours}"`);

  message += `<states${filterSummary.length > 0 ? ` ${filterSummary.join(' ')}` : ''}>\n`;

  if (states.devices.length === 0) {
    message += '  <!-- No devices found matching the filters -->\n';
  }
  for (const device of states.devices) {
    message += `${renderDeviceState(device, options?.includeTimestamps === true, now)}\n`;
  }

  if (states.activeZones && states.activeZones.length > 0) {
    message += `\n  <active-zones count="${states.activeZones.length}">\n`;
    states.activeZones.forEach((zone) => {
      const origins = zone.activeOrigins.length > 0 ? ` origins="${zone.activeOrigins.join(', ')}"` : '';
      message += `    <zone id="${zone.id}" name="${escapeXml(zone.name)}"${origins} />\n`;
    });
    message += '  </active-zones>\n';
  }

  message += '</states>\n\n';
  message += getDeviceStatesInstructions();

  return message;
}

// Attributes of the device element itself; a capability with one of these names gets a "cap." prefix
const DEVICE_ATTRIBUTES = new Set(['id', 'name', 'zone-id', 'last-update', 'hours-since-update', 'no-value']);

function capabilityAttributeName(capability: string): string {
  const safe = capability.replace(/[^A-Za-z0-9_.-]/g, '_');
  return DEVICE_ATTRIBUTES.has(safe) ? `cap.${safe}` : safe;
}

function capabilityValueText(value: unknown): string {
  return value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/**
 * One device as a single element. The device-level last update is always included (cheap, and it
 * reveals silent devices); per-capability timestamps only on request. Capabilities without a value
 * are listed once in no-value.
 */
function renderDeviceState(device: DeviceState, includeTimestamps: boolean, now: number): string {
  const tag = device.class || 'device';
  let element = `  <${tag} id="${device.id}" name="${escapeXml(device.name)}" zone-id="${device.zone}"`;

  const updateTimes = Object.values(device.capabilityUpdated || {});
  if (updateTimes.length > 0) {
    const lastUpdate = Math.max(...updateTimes);
    element += ` last-update="${new Date(lastUpdate).toISOString()}" hours-since-update="${hoursSince(lastUpdate, now)}"`;
  }

  const withoutValue: string[] = [];
  for (const [capability, value] of Object.entries(device.capabilities)) {
    if (value === null || value === undefined) {
      withoutValue.push(capability);
      continue;
    }
    const attribute = capabilityAttributeName(capability);
    element += ` ${attribute}="${escapeXml(capabilityValueText(value))}"`;
    const updated = includeTimestamps ? device.capabilityUpdated?.[capability] : undefined;
    if (updated) element += ` ${attribute}.updated="${new Date(updated).toISOString()}"`;
  }
  if (withoutValue.length > 0) element += ` no-value="${escapeXml(withoutValue.join(','))}"`;

  return `${element} />`;
}

/**
 * Get instructions for device states XML
 */
function getDeviceStatesInstructions(): string {
  return `INSTRUCTIONS:
- Device tag name indicates type: <light>, <socket>, <sensor>, etc.
- Each capability value is an attribute of the device, named after the capability (e.g. onoff="true" dim="0.5" measure_temperature="21.3")
- Booleans are "true"/"false", numbers are plain numbers; object values are JSON
- no-value lists capabilities for which Homey has no value (never reported or not applicable)
- A capability named like a device attribute (id, name, ...) is shown with a "cap." prefix
- Active zones show which rooms currently have motion/presence detected
- Use get_home_structure to look up zone name from zone-id
- last-update on a device is the UTC time Homey last received any value from it; <capability>.updated (only with include_timestamps) is the same per value; hours-since-update is relative to now
- A long silence is a strong sign of a dead or disconnected device for sensors that report regularly (temperature, motion, battery), but a contact that simply stayed closed also stays silent
`;
}
