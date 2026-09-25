/**
 * System health formatter - renders a SystemHealthSummary as XML for the AI
 */

import type {
  SystemHealthSummary, AppHealth, UsageConsumer, StorageSummary, MemorySummary,
} from '../diagnostics/system-health';
import { xmlAttrs } from './xml-utils';

const INSTRUCTIONS = `INSTRUCTIONS:
- reboot-reason tells why Homey last started (e.g. "reboot-ota" = firmware update, "unexpected" = power loss, crash or forced restart)
- Homey firmware updates reboot Homey; a boot date shortly after a new homey-version usually means an update
- Apps are sorted by memory use; a single app using far more memory than similar apps can cause slowness or restarts
- crash-count and crash-message show apps that crashed; their devices and flow cards stop working until the app restarts
- undervoltage or throttling points to a power supply problem
- wifi-strength is a percentage; Homey on 5 GHz or Ethernet keeps its own Wi-Fi away from the 2.4 GHz Zigbee radio
- MAC addresses, hostnames and cloud IDs are intentionally left out
`;

function renderSummaryLine(health: SystemHealthSummary): string {
  let line = `SUMMARY: last reboot ${health.bootDate ?? 'unknown'} (reason: ${health.rebootReason ?? 'unknown'})`;
  if (health.memory?.freePercent != null) line += `, ${health.memory.freePercent}% memory free`;
  if (health.apps) {
    const crashed = health.apps.filter((app) => app.crashed || app.state === 'crashed').length;
    line += `, ${health.apps.length} apps, ${crashed} crashed`;
  }
  return line;
}

function renderConsumers(consumers: UsageConsumer[]): string[] {
  return consumers.map((consumer) => `    <consumer${xmlAttrs({ name: consumer.name, mb: consumer.mb })} />`);
}

function renderMemory(memory: MemorySummary | null): string[] {
  if (!memory) return ['  <!-- memory information not available -->'];
  return [
    `  <memory${xmlAttrs({
      'total-mb': memory.totalMb, 'free-mb': memory.freeMb, 'free-percent': memory.freePercent, 'swap-used-mb': memory.swapMb,
    })}>`,
    ...renderConsumers(memory.top),
    '  </memory>',
  ];
}

function renderStorage(storage: StorageSummary | null): string[] {
  if (!storage) return ['  <!-- storage information not available -->'];
  return [
    `  <storage${xmlAttrs({ 'total-mb': storage.totalMb, 'free-mb': storage.freeMb, 'free-percent': storage.freePercent })}>`,
    ...renderConsumers(storage.top),
    '  </storage>',
  ];
}

// Only deviations from the normal state are shown (disabled, crashed, update available)
function renderApp(app: AppHealth): string {
  return `    <app${xmlAttrs({
    id: app.id,
    name: app.name,
    version: app.version,
    state: app.state,
    enabled: app.enabled ? undefined : false,
    crashed: app.crashed ? true : undefined,
    'crash-count': app.crashedCount > 0 ? app.crashedCount : undefined,
    'crash-message': app.crashedMessage,
    'update-available': app.updateAvailable ? true : undefined,
    'memory-mb': app.memoryMb,
    'cpu-percent': app.cpuPercent,
  })} />`;
}

function renderApps(apps: AppHealth[] | null): string[] {
  if (!apps) return [];
  return [`  <apps count="${apps.length}">`, ...apps.map(renderApp), '  </apps>'];
}

function renderHardware(health: SystemHealthSummary): string {
  return `  <hardware${xmlAttrs({
    'temperature-c': health.temperatureC,
    'load-average': health.loadAverage?.join(' '),
    'undervoltage-now': health.undervoltageNow,
    'undervoltage-since-boot': health.undervoltageSinceBoot,
    'throttled-now': health.throttledNow,
    'throttled-since-boot': health.throttledSinceBoot,
    'temperature-limit-since-boot': health.temperatureLimitSinceBoot,
    'frequency-capped-since-boot': health.frequencyCappedSinceBoot,
  })} />`;
}

function renderNetwork(network: SystemHealthSummary['network']): string {
  return `  <network${xmlAttrs({
    'wifi-connected': network.wifiConnected,
    'wifi-ssid': network.wifiSsid,
    'wifi-band': network.wifiBand,
    'wifi-frequency-mhz': network.wifiFrequencyMhz,
    'wifi-strength': network.wifiStrength,
    'wifi-address': network.wifiAddress,
    'ethernet-connected': network.ethernetConnected,
    'ethernet-address': network.ethernetAddress,
  })} />`;
}

export function formatSystemHealth(health: SystemHealthSummary): string {
  return [
    'Homey system health in XML format for easy parsing:',
    '',
    renderSummaryLine(health),
    '',
    `<homey-system-health${xmlAttrs({ 'homey-version': health.homeyVersion, model: health.model, timezone: health.timezone })}>`,
    `  <boot${xmlAttrs({ 'boot-date': health.bootDate, 'reboot-reason': health.rebootReason, 'uptime-hours': health.uptimeHours })} />`,
    renderHardware(health),
    renderNetwork(health.network),
    ...renderMemory(health.memory),
    ...renderStorage(health.storage),
    ...renderApps(health.apps),
    '</homey-system-health>',
    '',
    INSTRUCTIONS,
  ].join('\n');
}
