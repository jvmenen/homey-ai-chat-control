import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeSystemHealth, RawSystemInfo } from '../lib/diagnostics/system-health';
import { formatSystemHealth } from '../lib/formatters/system-health-formatter';
import { GetHomeySystemHealthTool, HomeySystemApiClient } from '../lib/tools/get-homey-system-health-tool';
import { fakeHomey, resultText } from './helpers';

const MB = 1024 * 1024;

const info: RawSystemInfo & Record<string, unknown> = {
  homeyVersion: '13.5.0',
  homeyModelName: 'Homey Pro (Early 2023)',
  bootDate: '2026-09-23T21:07:37.453Z',
  rebootReason: 'unexpected',
  uptime: 36000,
  videoCoreTemperature: 58.4,
  wifiConnected: true,
  wifiSsid: 'IoT-5',
  wifiFrequency: 5240,
  wifiStrength: 61,
  wifiAddress: '10.0.0.10',
  ethernetConnected: false,
  // fields that must never reach the output
  wifiMac: '90:13:DA:00:00:01',
  cloudId: 'cloud-id-secret',
  hostname: 'homey-cloud-id-secret.local',
};

const memory = {
  total: 1896 * MB,
  free: 380 * MB,
  swap: 29 * MB,
  types: { homey: { name: 'Homey', size: 334 * MB }, 'homey:app:tuya': { name: 'Tuya', size: 67 * MB } },
};

const storage = {
  total: 2535 * MB,
  free: 1090 * MB,
  types: { swap: { name: 'Swap', size: 1024 * MB }, insights: { name: 'Insights', size: 12 * MB } },
};

const apps = {
  small: {
    id: 'small', name: 'Small', state: 'running', usage: { mem: 20 * MB, cpu: 0 },
  },
  big: {
    id: 'big', name: 'Big', state: 'running', usage: { mem: 90 * MB, cpu: 1.23 },
  },
  broken: {
    id: 'broken', name: 'Broken', state: 'crashed', crashed: true, crashedCount: 3, crashedMessage: 'boom',
  },
};

describe('summarizeSystemHealth', () => {
  const summary = summarizeSystemHealth(info, memory, storage, apps, 5);

  it('never outputs MAC address, cloud ID or hostname', () => {
    const output = formatSystemHealth(summary);
    for (const secret of ['90:13:DA', 'cloud-id-secret']) assert.ok(!output.includes(secret), secret);
  });

  it('derives the Wi-Fi band from the frequency', () => {
    assert.equal(summary.network.wifiBand, '5 GHz');
    assert.equal(summarizeSystemHealth({ wifiFrequency: 2437 }, null, null, null, 5).network.wifiBand, '2.4 GHz');
  });

  it('reports memory in MB with the biggest consumers first', () => {
    assert.equal(summary.memory?.freePercent, 20);
    assert.deepEqual(summary.memory?.top.map((c) => c.name), ['Homey', 'Tuya']);
  });

  it('leaves swap out of the storage consumers', () => {
    assert.deepEqual(summary.storage?.top.map((c) => c.name), ['Insights']);
  });

  it('sorts apps by memory and keeps crash details', () => {
    assert.deepEqual(summary.apps?.map((a) => a.id), ['big', 'small', 'broken']);
    const broken = summary.apps?.find((a) => a.id === 'broken');
    assert.equal(broken?.crashedCount, 3);
    assert.equal(broken?.crashedMessage, 'boom');
    assert.equal(summary.apps?.[0].cpuPercent, 1.2);
  });

  it('copes with missing parts', () => {
    const partial = summarizeSystemHealth(null, null, null, null, 5);
    assert.equal(partial.memory, null);
    assert.equal(partial.apps, null);
    assert.match(formatSystemHealth(partial), /memory information not available/);
  });
});

describe('GetHomeySystemHealthTool', () => {
  const api = (overrides: Partial<HomeySystemApiClient['system']> = {}): HomeySystemApiClient => ({
    system: {
      getInfo: async () => info,
      getMemoryInfo: async () => memory,
      getStorageInfo: async () => storage,
      ...overrides,
    },
    apps: { getApps: async () => apps },
  });

  it('still reports the other parts when one call fails', async () => {
    const tool = new GetHomeySystemHealthTool(fakeHomey(), api({
      getStorageInfo: async () => {
        throw new Error('nope');
      },
    }));
    const text = resultText(await tool.execute({}));
    assert.match(text, /storage information not available/);
    assert.match(text, /reboot-reason="unexpected"/);
    assert.match(text, /crash-count="3"/);
  });

  it('returns an error when nothing can be read', async () => {
    const fail = async () => {
      throw new Error('down');
    };
    const tool = new GetHomeySystemHealthTool(fakeHomey(), {
      system: { getInfo: fail, getMemoryInfo: fail, getStorageInfo: fail },
      apps: { getApps: fail },
    });
    assert.equal((await tool.execute({})).isError, true);
  });
});
