/**
 * MCP HTTP server on Node's built-in http module
 *
 * Routes:
 * - GET  /health  health check
 * - POST /mcp     JSON-RPC request, answered with the MCP server's JSON response
 *
 * Replaces Express: the app only needs these two routes, and Express with its
 * dependencies cost about 2.7 MB of storage and several MB of memory.
 */

import {
  createServer, IncomingMessage, ServerResponse, Server,
} from 'http';
import { JSONRPC_ERROR_CODES } from '../constants';

/** Largest accepted request body; MCP requests are small JSON documents */
export const MAX_BODY_BYTES = 1024 * 1024;

export interface McpHttpHandlers {
  /** Handle one parsed JSON-RPC request and return the response to send */
  handleMcpRequest(request: unknown): Promise<unknown>;
  /** Report an unexpected error */
  onError(message: string, error: unknown): void;
}

class BodyTooLargeError extends Error {}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
  });
  res.end(text);
}

function jsonRpcError(id: unknown, code: number, message: string) {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: { code, message },
  };
}

function requestPath(req: IncomingMessage): string {
  const path = (req.url || '/').split('?')[0].replace(/\/+$/, '');
  return path || '/';
}

function readBody(req: IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new BodyTooLargeError(`Request body exceeds ${limit} bytes`));
        req.removeAllListeners('data');
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

function requestId(request: unknown): unknown {
  return request && typeof request === 'object' ? (request as { id?: unknown }).id : undefined;
}

async function handleMcp(req: IncomingMessage, res: ServerResponse, handlers: McpHttpHandlers): Promise<void> {
  let body: string;
  try {
    body = await readBody(req, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      sendJson(res, 413, jsonRpcError(null, JSONRPC_ERROR_CODES.INVALID_REQUEST, error.message));
      return;
    }
    throw error;
  }

  const parsed = parseJson(body);
  if (!parsed.ok) {
    sendJson(res, 400, jsonRpcError(null, JSONRPC_ERROR_CODES.PARSE_ERROR, 'Parse error: request body is not valid JSON'));
    return;
  }

  try {
    sendJson(res, 200, await handlers.handleMcpRequest(parsed.value));
  } catch (error) {
    handlers.onError('MCP request error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    sendJson(res, 500, jsonRpcError(requestId(parsed.value), JSONRPC_ERROR_CODES.INTERNAL_ERROR, `Internal error: ${message}`));
  }
}

async function route(req: IncomingMessage, res: ServerResponse, handlers: McpHttpHandlers): Promise<void> {
  const path = requestPath(req);
  if ((req.method === 'GET' || req.method === 'HEAD') && path === '/health') {
    sendJson(res, 200, { status: 'ok', message: 'Homey MCP Server is running' });
  } else if (req.method === 'POST' && path === '/mcp') {
    await handleMcp(req, res, handlers);
  } else {
    sendJson(res, 404, { error: `Cannot ${req.method} ${path}` });
  }
}

/** Request listener for http.createServer; exported for tests */
export function createMcpRequestListener(handlers: McpHttpHandlers) {
  return (req: IncomingMessage, res: ServerResponse): void => {
    route(req, res, handlers).catch((error) => {
      handlers.onError('HTTP request failed:', error);
      if (!res.headersSent) sendJson(res, 500, jsonRpcError(null, JSONRPC_ERROR_CODES.INTERNAL_ERROR, 'Internal error'));
    });
  };
}

export function createMcpHttpServer(handlers: McpHttpHandlers): Server {
  return createServer(createMcpRequestListener(handlers));
}
