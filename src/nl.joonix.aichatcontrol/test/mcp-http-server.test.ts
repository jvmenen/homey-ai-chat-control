import {
  describe, it, before, after,
} from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { createMcpHttpServer, MAX_BODY_BYTES } from '../lib/server/mcp-http-server';

describe('MCP HTTP server', () => {
  let server: Server;
  let base: string;
  const errors: string[] = [];

  before(async () => {
    server = createMcpHttpServer({
      handleMcpRequest: async (request) => {
        const { id, method } = request as { id: number; method: string };
        if (method === 'explode') throw new Error('boom');
        return { jsonrpc: '2.0', id, result: { echo: method } };
      },
      onError: (message) => {
        errors.push(message);
      },
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => new Promise<void>((resolve) => {
    server.close(() => resolve());
  }));

  type JsonRpcErrorBody = { id: unknown; error: { code: number; message: string } };

  const post = (path: string, body: string) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });

  it('answers the health check', async () => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok', message: 'Homey MCP Server is running' });
  });

  it('passes a JSON-RPC request to the handler and returns its response as JSON', async () => {
    const res = await post('/mcp', JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'tools/list' }));
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    assert.deepEqual(await res.json(), { jsonrpc: '2.0', id: 7, result: { echo: 'tools/list' } });
  });

  it('ignores a query string and a trailing slash', async () => {
    const res = await post('/mcp/?session=1', JSON.stringify({ id: 1, method: 'ping' }));
    assert.equal(res.status, 200);
  });

  it('answers invalid JSON with a JSON-RPC parse error', async () => {
    const res = await post('/mcp', '{not json');
    assert.equal(res.status, 400);
    assert.equal(((await res.json()) as JsonRpcErrorBody).error.code, -32700);
  });

  it('answers a handler failure with an internal error carrying the request id', async () => {
    const res = await post('/mcp', JSON.stringify({ id: 42, method: 'explode' }));
    assert.equal(res.status, 500);
    const body = (await res.json()) as JsonRpcErrorBody;
    assert.equal(body.id, 42);
    assert.equal(body.error.code, -32603);
    assert.match(body.error.message, /boom/);
    assert.ok(errors.includes('MCP request error:'));
  });

  it('rejects bodies over the size limit', async () => {
    const res = await post('/mcp', JSON.stringify({ id: 1, method: 'x', pad: 'x'.repeat(MAX_BODY_BYTES) }));
    assert.equal(res.status, 413);
  });

  it('returns 404 for other routes and methods', async () => {
    assert.equal((await fetch(`${base}/mcp`)).status, 404);
    assert.equal((await fetch(`${base}/other`)).status, 404);
  });
});
