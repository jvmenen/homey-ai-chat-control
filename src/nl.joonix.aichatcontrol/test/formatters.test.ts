import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatHomeStructure } from '../lib/formatters/home-structure-formatter';
import { formatDeviceStates } from '../lib/formatters/device-states-formatter';
import { formatDeviceInMoods } from '../lib/formatters/moods-formatter';
import { formatFlowOverview } from '../lib/formatters/flow-overview-formatter';

const TRICKY = 'Tom & "Jerry" <co>';
const ESCAPED = 'Tom &amp; &quot;Jerry&quot; &lt;co&gt;';

/** XML body without the plain-text header and instructions */
const xmlBody = (text: string, root: string) => text.slice(text.indexOf(`<${root}`), text.indexOf(`</${root}>`));

describe('formatters escape names from Homey', () => {
  it('home structure: zone, device and mood names', () => {
    const xml = formatHomeStructure({
      zones: [{
        id: 'z', name: TRICKY, parent: null, icon: 'default',
      }],
      devices: [{
        id: 'd', name: TRICKY, zone: 'z', zoneName: TRICKY, driverUri: 'homey:app:com.x:drv', class: 'light', capabilities: ['onoff'], available: true, ready: true,
      }],
      moods: [{
        id: 'm', name: TRICKY, zone: 'z', preset: TRICKY, deviceCount: 1,
      }],
    });
    const body = xmlBody(xml, 'home');
    assert.equal(body.split(ESCAPED).length - 1, 4, 'zone name, device name, mood name and preset');
    assert.ok(!body.includes(TRICKY));
  });

  it('device states: active zone names', () => {
    const xml = formatDeviceStates({
      devices: [],
      activeZones: [{
        id: 'z', name: TRICKY, active: true, activeOrigins: [],
      }],
    });
    assert.ok(xmlBody(xml, 'states').includes(`name="${ESCAPED}"`));
  });

  it('moods: preset names', () => {
    const xml = formatDeviceInMoods('d', 'Lamp', [{ mood: { id: 'm', name: 'M', preset: TRICKY }, zoneName: 'Z', state: {} }]);
    assert.ok(!xmlBody(xml, 'device-in-moods').includes(TRICKY));
  });
});

describe('flow overview cards', () => {
  const overview = (cards: Parameters<typeof formatFlowOverview>[0]['flows'][number]['cards']) => formatFlowOverview({
    summary: {
      total: 1, enabled: 1, disabled: 0, regular: 1, advanced: 0, mcpFlows: 0,
    },
    flows: [{
      id: 'f', name: 'F', enabled: true, type: 'regular', cards,
    }],
  });

  it('renders a card without args, tokens or token input as a self-closing element', () => {
    assert.match(overview([{ type: 'action', appId: 'a', cardId: 'c' }]), /<action app-id="a" card-id="c" \/>/);
  });

  it('leaves device references out of the args and shows the rest', () => {
    const xml = overview([{
      type: 'condition', appId: 'a', cardId: 'c', deviceId: 'd1', args: { device: { id: 'd1' }, threshold: 5, mode: { a: 1 } },
    }]);
    assert.match(xml, /<condition app-id="a" card-id="c" device-id="d1">/);
    assert.match(xml, /<arg name="threshold" value="5" \/>/);
    assert.match(xml, /<arg name="mode" value="\{&quot;a&quot;:1\}" \/>/);
    assert.ok(!xml.includes('name="device"'));
  });

  it('shows token input and tokens with defaults for missing fields', () => {
    const xml = overview([{
      type: 'trigger', appId: 'a', cardId: 'c', tokenInput: { deviceId: 'd2', capability: 'measure_luminance' }, tokens: [{ name: 'lux' }, { name: '' }],
    }]);
    assert.match(xml, /<token-input device-id="d2" capability="measure_luminance" \/>/);
    assert.match(xml, /<token name="lux" type="" title="lux" \/>/);
    assert.match(xml, /<token name="unknown" type="" title="unknown" \/>/);
  });
});
