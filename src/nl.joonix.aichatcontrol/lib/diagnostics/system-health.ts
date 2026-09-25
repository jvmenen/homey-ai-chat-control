/**
 * Homey system health diagnostics - pure logic
 *
 * Turns system info, memory/storage usage and the app list into a health summary.
 * Only whitelisted fields are copied (no MAC addresses, cloud IDs or hostnames).
 */

// Raw shapes (only the fields read here)
export interface RawSystemInfo {
  homeyVersion?: string;
  homeyModelName?: string;
  timezone?: string;
  bootDate?: string;
  rebootReason?: string;
  uptime?: number;
  loadavg?: number[];
  videoCoreTemperature?: number;
  videoCoreUnderVoltageCurrently?: boolean;
  videoCoreUndervoltageOccured?: boolean;
  videoCoreThrottleCurrently?: boolean;
  videoCoreThrottleOccured?: boolean;
  videoCoreSoftTemperatureLimitActiveOccured?: boolean;
  videoCoreArmFrequencyCappedOccured?: boolean;
  wifiConnected?: boolean;
  wifiSsid?: string;
  wifiFrequency?: number;
  wifiStrength?: number;
  wifiAddress?: string;
  ethernetConnected?: boolean;
  ethernetAddress?: string | null;
}

export interface RawUsageInfo {
  total?: number;
  free?: number;
  swap?: number;
  types?: Record<string, { name?: string; size?: number }>;
}

export interface RawApp {
  id?: string;
  name?: string;
  version?: string;
  state?: string;
  enabled?: boolean;
  crashed?: boolean;
  crashedCount?: number;
  crashedMessage?: string | null;
  updateAvailable?: unknown;
  usage?: { cpu?: number; mem?: number };
}

export interface UsageConsumer {
  name: string;
  mb: number;
}

export interface AppHealth {
  id: string;
  name: string;
  version?: string;
  state: string;
  enabled: boolean;
  crashed: boolean;
  crashedCount: number;
  crashedMessage?: string;
  updateAvailable: boolean;
  memoryMb: number | null;
  cpuPercent: number | null;
}

export interface StorageSummary {
  totalMb: number | null;
  freeMb: number | null;
  freePercent: number | null;
  top: UsageConsumer[];
}

export interface MemorySummary extends StorageSummary {
  swapMb: number | null;
}

export interface SystemHealthSummary {
  homeyVersion?: string;
  model?: string;
  timezone?: string;
  bootDate?: string;
  rebootReason?: string;
  uptimeHours: number | null;
  loadAverage?: number[];
  temperatureC?: number;
  undervoltageNow?: boolean;
  undervoltageSinceBoot?: boolean;
  throttledNow?: boolean;
  throttledSinceBoot?: boolean;
  temperatureLimitSinceBoot?: boolean;
  frequencyCappedSinceBoot?: boolean;
  network: {
    wifiConnected?: boolean;
    wifiSsid?: string;
    wifiBand?: string;
    wifiFrequencyMhz?: number;
    wifiStrength?: number;
    wifiAddress?: string;
    ethernetConnected?: boolean;
    ethernetAddress?: string;
  };
  memory: MemorySummary | null;
  storage: StorageSummary | null;
  apps: AppHealth[] | null;
}

const MB = 1024 * 1024;
const toMb = (bytes: number | undefined) => (typeof bytes === 'number' ? Math.round(bytes / MB) : null);
const percent = (part: number | undefined, total: number | undefined) => (
  typeof part === 'number' && typeof total === 'number' && total > 0 ? Math.round((part / total) * 100) : null
);

function wifiBand(freq: number | undefined): string | undefined {
  if (typeof freq !== 'number') return undefined;
  if (freq >= 2400 && freq < 2500) return '2.4 GHz';
  if (freq >= 4900 && freq < 5900) return '5 GHz';
  if (freq >= 5925) return '6 GHz';
  return undefined;
}

function topConsumers(info: RawUsageInfo, topN: number, exclude: string[] = []): UsageConsumer[] {
  return Object.entries(info.types || {})
    .filter(([key]) => !exclude.includes(key))
    .map(([key, t]) => ({ name: t.name || key, mb: toMb(t.size) ?? 0 }))
    .sort((a, b) => b.mb - a.mb)
    .slice(0, topN);
}

function summarizeNetwork(info: RawSystemInfo): SystemHealthSummary['network'] {
  return {
    wifiConnected: info.wifiConnected,
    wifiSsid: info.wifiSsid,
    wifiBand: wifiBand(info.wifiFrequency),
    wifiFrequencyMhz: info.wifiFrequency,
    wifiStrength: info.wifiStrength,
    wifiAddress: info.wifiAddress,
    ethernetConnected: info.ethernetConnected,
    ethernetAddress: info.ethernetAddress || undefined,
  };
}

function summarizeMemory(memory: RawUsageInfo, topN: number): MemorySummary {
  return {
    totalMb: toMb(memory.total),
    freeMb: toMb(memory.free),
    freePercent: percent(memory.free, memory.total),
    swapMb: toMb(memory.swap),
    top: topConsumers(memory, topN),
  };
}

function summarizeStorage(storage: RawUsageInfo, topN: number): StorageSummary {
  return {
    totalMb: toMb(storage.total),
    freeMb: toMb(storage.free),
    freePercent: percent(storage.free, storage.total),
    // swap is a fixed reservation, not a consumer worth reporting
    top: topConsumers(storage, topN, ['swap']),
  };
}

function summarizeApp(app: RawApp): AppHealth {
  return {
    id: app.id || 'unknown',
    name: app.name || app.id || 'unknown',
    version: app.version,
    state: app.state || 'unknown',
    enabled: app.enabled !== false,
    crashed: app.crashed === true,
    crashedCount: app.crashedCount ?? 0,
    crashedMessage: app.crashedMessage || undefined,
    updateAvailable: Boolean(app.updateAvailable),
    memoryMb: toMb(app.usage?.mem),
    cpuPercent: typeof app.usage?.cpu === 'number' ? Math.round(app.usage.cpu * 10) / 10 : null,
  };
}

const byMemoryDescending = (a: AppHealth, b: AppHealth) => (b.memoryMb ?? 0) - (a.memoryMb ?? 0);

/**
 * Build a whitelisted health summary from raw API responses.
 * Any part may be null when its API call failed.
 */
export function summarizeSystemHealth(
  info: RawSystemInfo | null,
  memory: RawUsageInfo | null,
  storage: RawUsageInfo | null,
  apps: Record<string, RawApp> | null,
  topN: number,
): SystemHealthSummary {
  const system = info || {};
  return {
    homeyVersion: system.homeyVersion,
    model: system.homeyModelName,
    timezone: system.timezone,
    bootDate: system.bootDate,
    rebootReason: system.rebootReason,
    uptimeHours: typeof system.uptime === 'number' ? Math.round((system.uptime / 3600) * 10) / 10 : null,
    loadAverage: system.loadavg?.map((load) => Math.round(load * 100) / 100),
    temperatureC: system.videoCoreTemperature,
    undervoltageNow: system.videoCoreUnderVoltageCurrently,
    undervoltageSinceBoot: system.videoCoreUndervoltageOccured,
    throttledNow: system.videoCoreThrottleCurrently,
    throttledSinceBoot: system.videoCoreThrottleOccured,
    temperatureLimitSinceBoot: system.videoCoreSoftTemperatureLimitActiveOccured,
    frequencyCappedSinceBoot: system.videoCoreArmFrequencyCappedOccured,
    network: summarizeNetwork(system),
    memory: memory ? summarizeMemory(memory, topN) : null,
    storage: storage ? summarizeStorage(storage, topN) : null,
    apps: apps ? Object.values(apps).map(summarizeApp).sort(byMemoryDescending) : null,
  };
}
