import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { HomeyRestClient } from '../lib/api/homey-rest-client';
import { filterSilentDevices, lastDeviceUpdate } from '../lib/diagnostics/device-activity';
import { formatDeviceStates } from '../lib/formatters/device-states-formatter';
import { ZoneDeviceManager } from '../lib/managers/zone-device-manager';
import { GetStatesTool } from '../lib/tools/get-states-tool';
import type { DeviceState } from '../lib/interfaces';
import { fakeHomey, resultText, HOUR } from './helpers';

const NOW = Date.now();

const device = (name: string, updatedHoursAgo: number[], capabilities: Record<string, unknown> = {}): DeviceState => ({
  id: `id-${name}`,
  name,
  zone: 'zone-1',
  class: 'sensor',
  capabilities,
  capabilityUpdated: Object.fromEntries(updatedHoursAgo.map((h, i) => [`cap${i}`, NOW - h * HOUR])),
});

describe('device activity', () => {
  it('takes the most recent capability update as the device update', () => {
    assert.equal(lastDeviceUpdate(device('a', [10, 2, 50])), NOW - 2 * HOUR);
    assert.equal(lastDeviceUpdate(device('none', [])), null);
  });

  it('keeps only devices silent for longer than the threshold, longest silence first', () => {
    const devices = [device('recent', [1]), device('week', [200]), device('year', [9000]), device('none', [])];
    assert.deepEqual(filterSilentDevices(devices, 168, NOW).map((d) => d.name), ['year', 'week']);
  });
});

describe('formatDeviceStates', () => {
  const states = {
    devices: [{
      id: 'd1',
      name: 'Lamp "Bar" & co',
      zone: 'z1',
      class: 'light',
      capabilities: {
        onoff: true, dim: 0.5, light_mode: null, id: 'clash', speaker_track: 'Tom & Jerry <live>', 'measure_power.phase1': 12, extra: { a: 1 },
      },
      capabilityUpdated: { onoff: NOW - 2 * HOUR, dim: NOW - 5 * HOUR },
    }],
  };

  it('renders capability values as attributes of one device element', () => {
    const xml = formatDeviceStates(states);
    const line = xml.split('\n').find((l) => l.includes('<light '))!;
    assert.match(line, / onoff="true" dim="0.5"/);
    assert.match(line, / measure_power.phase1="12"/);
    assert.match(line, / no-value="light_mode"/);
    assert.match(line, /\/>$/);
    assert.ok(!xml.split('INSTRUCTIONS')[0].includes('<capability '), 'no separate capability elements');
  });

  it('escapes names and values and prefixes capabilities that clash with device attributes', () => {
    const line = formatDeviceStates(states).split('\n').find((l) => l.includes('<light '))!;
    assert.match(line, /name="Lamp &quot;Bar&quot; &amp; co"/);
    assert.match(line, /speaker_track="Tom &amp; Jerry &lt;live&gt;"/);
    assert.match(line, / cap\.id="clash"/);
    assert.match(line, / extra="\{&quot;a&quot;:1\}"/);
  });

  it('always shows the device last-update, per-capability times only on request', () => {
    const plain = formatDeviceStates(states);
    assert.match(plain, /last-update="[^"]+" hours-since-update="2"/);
    assert.ok(!plain.includes('.updated='));
    const detailed = formatDeviceStates(states, undefined, { includeTimestamps: true });
    assert.match(detailed, / onoff="true" onoff\.updated="/);
  });
});

describe('ZoneDeviceManager.getStates timestamps', () => {
  // Regression: the Homey API client hands out lastUpdated as a Date object; the first version only read numbers
  const lastUpdated = new Date(NOW - 3 * HOUR);
  const rawDevice = {
    id: 'dev',
    name: 'Door',
    zone: 'zone',
    class: 'sensor',
    capabilities: ['alarm_contact'],
    capabilitiesObj: {
      alarm_contact: {
        id: 'alarm_contact', value: false, getable: true, setable: false, type: 'boolean', lastUpdated,
      },
    },
  };
  const api = {
    devices: { getDevices: async () => ({ dev: rawDevice }), getDevice: async () => rawDevice },
    zones: {
      getZones: async () => ({
        zone: {
          id: 'zone', name: 'Hall', parent: null, active: false,
        },
      }),
      getZone: async () => null,
    },
  };

  it('reads Date objects as update times', async () => {
    const states = await new ZoneDeviceManager(fakeHomey(), api as unknown as HomeyRestClient).getStates();
    assert.equal(states.devices[0].capabilityUpdated?.alarm_contact, lastUpdated.getTime());
  });

  it('finds the device through get_states silent_for_hours', async () => {
    const tool = new GetStatesTool(fakeHomey(), new ZoneDeviceManager(fakeHomey(), api as unknown as HomeyRestClient));
    const text = resultText(await tool.execute({ silent_for_hours: 1 }));
    assert.match(text, /SUMMARY: 1 of 1 device/);
    assert.match(text, /name="Door"/);
    const none = resultText(await tool.execute({ silent_for_hours: 5 }));
    assert.match(none, /SUMMARY: 0 of 1 device/);
  });
});
