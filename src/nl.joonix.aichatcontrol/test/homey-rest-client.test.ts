import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'http';
import type { AddressInfo } from 'net';
import {
  HomeyRestClient, HttpResponse, HttpTransport, nodeHttpTransport,
} from '../lib/api/homey-rest-client';
import { HomeyApiError } from '../lib/utils/errors';

interface SentRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

function fakeHomey(responses: HttpResponse[]) {
  const sent: SentRequest[] = [];
  const transport: HttpTransport = async (url, options) => {
    sent.push({
      url, method: options.method, headers: options.headers, body: options.body,
    });
    const response = responses.shift();
    if (!response) throw new Error(`Unexpected request ${options.method} ${url}`);
    return response;
  };
  let tokenCalls = 0;
  const client = new HomeyRestClient({
    baseUrl: 'http://127.0.0.1:80/',
    homeyId: 'homey-1',
    getToken: async () => {
      tokenCalls += 1;
      return `token-${tokenCalls}`;
    },
    transport,
  });
  return { client, sent, tokenCalls: () => tokenCalls };
}

const ok = (body: unknown): HttpResponse => ({ status: 200, body: JSON.stringify(body) });

describe('HomeyRestClient', () => {
  it('calls the manager path with the owner token and Homey id', async () => {
    const { client, sent } = fakeHomey([ok({ z1: { id: 'z1', name: 'Woonkamer' } })]);

    const zones = await client.zones.getZones();

    assert.deepEqual(zones, { z1: { id: 'z1', name: 'Woonkamer' } });
    assert.equal(sent[0].url, 'http://127.0.0.1:80/api/manager/zones/zone');
    assert.equal(sent[0].method, 'GET');
    assert.equal(sent[0].headers.Authorization, 'Bearer token-1');
    assert.equal(sent[0].headers['X-Homey-ID'], 'homey-1');
    assert.equal(sent[0].body, undefined);
  });

  it('fetches the token once and reuses it', async () => {
    const { client, tokenCalls } = fakeHomey([ok({}), ok({})]);

    await client.apps.getApps();
    await client.flow.getFlows();

    assert.equal(tokenCalls(), 1);
  });

  it('cleans up devices like homey-api did', async () => {
    const { client } = fakeHomey([ok({
      d1: {
        id: 'd1',
        driverUri: 'old',
        insights: [],
        capabilitiesObj: { onoff: { value: true, lastUpdated: '2026-09-25T10:00:00.000Z' }, dim: { value: 1 } },
      },
    })]);

    const devices = await client.devices.getDevices<Record<string, unknown>>();
    const device = devices.d1 as { capabilitiesObj: Record<string, { lastUpdated?: unknown }> };

    assert.equal('driverUri' in devices.d1, false);
    assert.equal('insights' in devices.d1, false);
    assert.ok(device.capabilitiesObj.onoff.lastUpdated instanceof Date);
    assert.equal((device.capabilitiesObj.onoff.lastUpdated as Date).toISOString(), '2026-09-25T10:00:00.000Z');
    assert.equal(device.capabilitiesObj.dim.lastUpdated, undefined);
  });

  it('sets a capability value with a JSON body', async () => {
    const { client, sent } = fakeHomey([{ status: 200, body: '' }]);

    await client.devices.setCapabilityValue({ deviceId: 'd1', capabilityId: 'dim', value: 0.4 });

    assert.equal(sent[0].method, 'PUT');
    assert.equal(sent[0].url, 'http://127.0.0.1:80/api/manager/devices/device/d1/capability/dim');
    assert.equal(sent[0].headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(sent[0].body as string), { value: 0.4 });
  });

  it('activates a mood with a POST', async () => {
    const { client, sent } = fakeHomey([{ status: 204, body: '' }]);

    await client.moods.setMood({ id: 'm1' });

    assert.equal(sent[0].method, 'POST');
    assert.equal(sent[0].url, 'http://127.0.0.1:80/api/manager/moods/mood/m1/set');
  });

  it('builds the insights entry path from the log id', async () => {
    const { client, sent } = fakeHomey([ok({ values: [] })]);

    await client.insights.getLogEntries({ id: 'homey:device:d1:measure_temperature', resolution: 'last24Hours' });

    assert.equal(
      sent[0].url,
      'http://127.0.0.1:80/api/manager/insights/log/homey:device:d1/homey:device:d1:measure_temperature/entry?resolution=last24Hours',
    );
  });

  it('drops ownerName from flow cards and insight logs', async () => {
    const { client } = fakeHomey([ok({ c1: { id: 'c1', ownerName: 'App', ownerUri: 'homey:app:x' } })]);

    const cards = await client.flow.getFlowCardActions();

    assert.deepEqual(cards, { c1: { id: 'c1', ownerUri: 'homey:app:x' } });
  });

  it('retries once with a fresh token after a 401', async () => {
    const { client, sent } = fakeHomey([{ status: 401, body: '{"error":"Unauthorized"}' }, ok({ ok: true })]);

    const state = await client.zigbee.getState();

    assert.deepEqual(state, { ok: true });
    assert.equal(sent[0].headers.Authorization, 'Bearer token-1');
    assert.equal(sent[1].headers.Authorization, 'Bearer token-2');
  });

  it('turns an error response into a HomeyApiError with Homey\'s message', async () => {
    const { client } = fakeHomey([{ status: 404, body: '{"error":"Device not found"}' }]);

    await assert.rejects(
      client.devices.getDevice({ id: 'missing' }),
      (error: unknown) => error instanceof HomeyApiError && error.statusCode === 404 && error.message === 'Device not found',
    );
  });

  it('sends real HTTP requests through the node transport', async () => {
    const server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          method: req.method, url: req.url, auth: req.headers.authorization, body,
        }));
      });
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    try {
      const { port } = server.address() as AddressInfo;
      const response = await nodeHttpTransport(`http://127.0.0.1:${port}/api/manager/moods/mood/m1/set`, {
        method: 'POST', headers: { Authorization: 'Bearer t' }, body: '{}', timeoutMs: 2000,
      });
      assert.equal(response.status, 200);
      assert.deepEqual(JSON.parse(response.body), {
        method: 'POST', url: '/api/manager/moods/mood/m1/set', auth: 'Bearer t', body: '{}',
      });
    } finally {
      server.close();
    }
  });
});
