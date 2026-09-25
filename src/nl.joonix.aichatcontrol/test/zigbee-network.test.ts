import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeZigbeeState, hasIssue, RawZigbeeState } from '../lib/diagnostics/zigbee-network';
import { formatZigbeeNetwork } from '../lib/formatters/zigbee-network-formatter';
import { GetZigbeeNetworkTool, parseZigbeeFilters } from '../lib/tools/get-zigbee-network-tool';
import { fakeHomey, resultText, HOUR } from './helpers';

const NOW = Date.parse('2026-09-25T12:00:00Z');
const NETWORK_KEY = '21:5a:00:00:de:ad:be:ef:00:11:22:33:44:55:66:77';

// Shaped after a real Homey Pro 2023 Zigbee state, with invented names and a fake key
function rawState(): RawZigbeeState & Record<string, unknown> {
  return {
    zigbee_ready: true,
    availability: { zigbee: 'available' },
    controllerState: {
      panId: 29047,
      extendedPanId: 'ex:te:nd:ed:pa:ni:d0:00',
      IEEEAddress: '3c:2e:f5:ff:fe:00:00:01',
      networkKey: NETWORK_KEY,
      networkKeyFrameCounter: 56188929,
      channel: 11,
      softwareVersion: '9.1.0-0',
      routes: {
        3920: [],
        13766: [3920],
        2626: [49431, 50693],
        55386: [49431],
      },
    } as RawZigbeeState['controllerState'],
    nodes: {
      a: { networkAddress: 0, name: 'Homey', type: 'coordinator' },
      b: {
        networkAddress: 3920,
        name: 'Kitchen ceiling',
        type: 'router',
        modelId: 'TRADFRI bulb',
        manufacturerName: 'IKEA of Sweden',
        swBuildId: '1.0.021',
        lastSeen: NOW - 0.5 * HOUR,
        stats: {
          tx: 3546, txSuccess: 3542, txError: 4, rx: 3073,
        },
      },
      c: {
        networkAddress: 49431,
        name: 'Bedroom lamp',
        type: 'router',
        lastSeen: NOW - HOUR,
        stats: {
          tx: 800, txSuccess: 700, txError: 100, rx: 130,
        },
      },
      d: {
        nwkAddr: 13766,
        name: 'Back door',
        deviceType: 'enddevice',
        lastSeen: NOW - 2 * HOUR,
        stats: {
          tx: 4, txSuccess: 4, txError: 0, rx: 11,
        },
      },
      e: {
        networkAddress: 10340,
        name: 'Front door',
        lastSeen: NOW - 6000 * HOUR,
        stats: {
          tx: 0, txSuccess: 0, txError: 0, rx: 0,
        },
      },
      f: {
        networkAddress: 55386,
        name: 'Remote',
        type: 'enddevice',
        lastSeen: NOW - HOUR,
        stats: {
          tx: 158, txSuccess: 105, txError: 53, rx: 118,
        },
      },
      g: {
        networkAddress: 2626, name: 'Motion attic', lastSeen: NOW - HOUR, stats: { rx: 1483 },
      },
    },
  };
}

const ALL = { staleAfterHours: 24 };

describe('summarizeZigbeeState', () => {
  it('never copies the network key or other controller secrets', () => {
    const output = formatZigbeeNetwork(summarizeZigbeeState(rawState(), ALL, NOW), ALL);
    for (const secret of [NETWORK_KEY, '56188929', 'ex:te:nd:ed', '3c:2e:f5:ff:fe:00:00:01', 'networkKey']) {
      assert.ok(!output.includes(secret), `output must not contain ${secret}`);
    }
  });

  it('counts the whole network, independent of filters', () => {
    const summary = summarizeZigbeeState(rawState(), { staleAfterHours: 24, nameFilter: 'door' }, NOW);
    assert.equal(summary.totalNodes, 7);
    assert.equal(summary.routers, 2);
    assert.equal(summary.endDevices, 2);
    assert.equal(summary.unknownType, 2);
    assert.deepEqual(summary.nodes.map((n) => n.name), ['Back door', 'Front door']);
  });

  it('resolves routes to router names and counts how often a router is used', () => {
    const { nodes } = summarizeZigbeeState(rawState(), ALL, NOW);
    const byName = new Map(nodes.map((n) => [n.name, n]));
    assert.deepEqual(byName.get('Back door')?.routeVia, ['Kitchen ceiling']);
    assert.deepEqual(byName.get('Motion attic')?.routeVia, ['Bedroom lamp', 'unknown node 50693']);
    assert.equal(byName.get('Bedroom lamp')?.routesThrough, 2);
    assert.equal(byName.get('Kitchen ceiling')?.routesThrough, 1);
  });

  it('reads the address from nwkAddr when networkAddress is missing', () => {
    const backDoor = summarizeZigbeeState(rawState(), ALL, NOW).nodes.find((n) => n.name === 'Back door');
    assert.equal(backDoor?.networkAddress, 13766);
    assert.equal(backDoor?.type, 'enddevice');
  });

  it('marks nodes stale after the threshold, but never the coordinator', () => {
    const { nodes } = summarizeZigbeeState(rawState(), { staleAfterHours: 1.5 }, NOW);
    const stale = nodes.filter((n) => n.stale).map((n) => n.name).sort();
    assert.deepEqual(stale, ['Back door', 'Front door']);
  });

  it('only reports an error rate with enough transmissions', () => {
    const byName = new Map(summarizeZigbeeState(rawState(), ALL, NOW).nodes.map((n) => [n.name, n]));
    assert.equal(byName.get('Back door')?.txErrorRate, null);
    assert.equal(byName.get('Remote')?.txErrorRate, 33.5);
    assert.equal(byName.get('Bedroom lamp')?.txErrorRate, 12.5);
  });

  it('only_issues keeps stale nodes and nodes with a high error rate', () => {
    const { nodes } = summarizeZigbeeState(rawState(), { staleAfterHours: 24, onlyIssues: true }, NOW);
    assert.deepEqual(nodes.map((n) => n.name), ['Bedroom lamp', 'Remote', 'Front door']);
    assert.ok(nodes.every(hasIssue));
  });

  it('sorts coordinator, routers, end devices, unknown; then by name', () => {
    const types = summarizeZigbeeState(rawState(), ALL, NOW).nodes.map((n) => n.type);
    assert.deepEqual(types, ['coordinator', 'router', 'router', 'enddevice', 'enddevice', 'unknown', 'unknown']);
  });

  it('accepts nodes as an array', () => {
    const raw = rawState();
    raw.nodes = Object.values(raw.nodes as Record<string, never>);
    assert.equal(summarizeZigbeeState(raw, ALL, NOW).totalNodes, 7);
  });
});

describe('parseZigbeeFilters', () => {
  it('uses defaults for missing or invalid arguments', () => {
    assert.deepEqual(parseZigbeeFilters({ stale_after_hours: -3, node_type: 'lamp', name_filter: '' }), {
      nameFilter: undefined, nodeType: undefined, onlyIssues: false, staleAfterHours: 24,
    });
  });
});

describe('GetZigbeeNetworkTool', () => {
  it('returns the formatted network without secrets', async () => {
    const tool = new GetZigbeeNetworkTool(fakeHomey(), { zigbee: { getState: async () => rawState() } });
    const text = resultText(await tool.execute({ name_filter: 'door' }));
    assert.match(text, /<node name="Back door"/);
    assert.ok(!text.includes(NETWORK_KEY));
  });

  it('turns an API failure into an error result', async () => {
    const tool = new GetZigbeeNetworkTool(fakeHomey(), {
      zigbee: {
        getState: async () => {
          throw new Error('offline');
        },
      },
    });
    const result = await tool.execute({});
    assert.equal(result.isError, true);
    assert.match(resultText(result), /offline/);
  });
});
