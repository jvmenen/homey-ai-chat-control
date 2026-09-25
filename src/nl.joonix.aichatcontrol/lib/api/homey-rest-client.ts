/**
 * Homey REST client - thin replacement for the `homey-api` package
 *
 * Calls Homey's local Web API directly with the app's owner token. The app only uses
 * a couple of read operations plus setting capability values and moods, so it does not
 * need homey-api's full API specification, item classes and realtime connection, which
 * cost a lot of memory.
 *
 * Path parameters are inserted as-is, like homey-api does (insights ids contain colons).
 * Responses are the plain JSON objects Homey returns, with the same small clean-ups
 * homey-api applied (see transformDevice and dropOwnerName) so the output stays identical.
 */

import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import type { HomeyInstance } from '../types';
import { HomeyApiError } from '../utils/errors';

export const DEFAULT_TIMEOUT_MS = 10_000;

type HttpMethod = 'GET' | 'PUT' | 'POST';
type JsonObject = Record<string, unknown>;

export interface HttpResponse {
  status: number;
  body: string;
}

/** Sends one HTTP request; replaceable in tests */
export type HttpTransport = (
  url: string,
  options: { method: HttpMethod; headers: Record<string, string>; body?: string; timeoutMs: number },
) => Promise<HttpResponse>;

export interface HomeyRestClientOptions {
  baseUrl: string;
  homeyId?: string;
  getToken: () => Promise<string>;
  transport?: HttpTransport;
  timeoutMs?: number;
}

export const nodeHttpTransport: HttpTransport = (url, options) => new Promise((resolve, reject) => {
  const send = url.startsWith('https:') ? httpsRequest : httpRequest;
  const req = send(url, { method: options.method, headers: options.headers, timeout: options.timeoutMs }, (res) => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
    res.on('error', reject);
  });
  req.on('timeout', () => req.destroy(new Error(`Timeout after ${options.timeoutMs} ms: ${options.method} ${url}`)));
  req.on('error', reject);
  if (options.body !== undefined) req.write(options.body);
  req.end();
});

function parseJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function errorMessage(response: HttpResponse): string {
  const json = parseJson(response.body) as { error?: unknown; error_description?: unknown; message?: unknown } | undefined;
  const message = json?.error_description ?? json?.error ?? json?.message ?? response.body;
  return typeof message === 'string' && message ? message : `HTTP ${response.status}`;
}

function mapValues<T>(items: Record<string, T>, transform: (item: T) => T): Record<string, T> {
  return Object.fromEntries(Object.entries(items).map(([id, item]) => [id, transform(item)]));
}

// Same clean-up as homey-api's Device.transformGet
function transformDevice<T>(device: T): T {
  const item = device as JsonObject;
  delete item.driverUri;
  delete item.insights;
  const capabilities = item.capabilitiesObj as Record<string, { lastUpdated?: unknown }> | undefined;
  for (const capability of Object.values(capabilities || {})) {
    if (capability?.lastUpdated) capability.lastUpdated = new Date(capability.lastUpdated as string | number);
  }
  return device;
}

// Same clean-up as homey-api's FlowCard and Log transformGet
function dropOwnerName<T>(item: T): T {
  delete (item as JsonObject).ownerName;
  return item;
}

export class HomeyRestClient {
  private readonly transport: HttpTransport;
  private readonly timeoutMs: number;
  private readonly baseUrl: string;
  private token: string | null = null;

  constructor(private readonly options: HomeyRestClientOptions) {
    this.transport = options.transport ?? nodeHttpTransport;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
  }

  readonly devices = {
    getDevices: async <T = JsonObject>(): Promise<Record<string, T>> => mapValues(await this.get<Record<string, T>>('devices', '/device'), transformDevice),
    getDevice: async <T = JsonObject>({ id }: { id: string }): Promise<T> => transformDevice(await this.get<T>('devices', `/device/${id}`)),
    setCapabilityValue: ({ deviceId, capabilityId, value }: { deviceId: string; capabilityId: string; value: unknown }): Promise<void> => this.send(
      'PUT',
      'devices',
      `/device/${deviceId}/capability/${capabilityId}`,
      { value },
    ),
  };

  readonly zones = {
    getZones: <T = JsonObject>(): Promise<Record<string, T>> => this.get('zones', '/zone'),
    getZone: <T = JsonObject>({ id }: { id: string }): Promise<T> => this.get('zones', `/zone/${id}`),
  };

  readonly flow = {
    getFlows: <T = JsonObject>(): Promise<Record<string, T>> => this.get('flow', '/flow'),
    getAdvancedFlows: <T = JsonObject>(): Promise<Record<string, T>> => this.get('flow', '/advancedflow'),
    getFlowFolders: <T = JsonObject>(): Promise<Record<string, T>> => this.get('flow', '/flowfolder'),
    getFlowCardTriggers: async <T = JsonObject>(): Promise<Record<string, T>> => mapValues(await this.get<Record<string, T>>('flow', '/flowcardtrigger'), dropOwnerName),
    getFlowCardConditions: async <T = JsonObject>(): Promise<Record<string, T>> => mapValues(await this.get<Record<string, T>>('flow', '/flowcardcondition'), dropOwnerName),
    getFlowCardActions: async <T = JsonObject>(): Promise<Record<string, T>> => mapValues(await this.get<Record<string, T>>('flow', '/flowcardaction'), dropOwnerName),
  };

  readonly moods = {
    getMoods: <T = JsonObject>(): Promise<Record<string, T>> => this.get('moods', '/mood'),
    getMood: <T = JsonObject>({ id }: { id: string }): Promise<T> => this.get('moods', `/mood/${id}`),
    setMood: ({ id }: { id: string }): Promise<void> => this.send('POST', 'moods', `/mood/${id}/set`, {}),
  };

  readonly logic = {
    getVariables: <T = JsonObject>(): Promise<Record<string, T>> => this.get('logic', '/variable'),
  };

  readonly apps = {
    getApps: <T = JsonObject>(): Promise<Record<string, T>> => this.get('apps', '/app'),
  };

  readonly zigbee = {
    getState: <T = JsonObject>(): Promise<T> => this.get('zigbee', '/state'),
  };

  readonly system = {
    getInfo: <T = JsonObject>(): Promise<T> => this.get('system', '/'),
    getMemoryInfo: <T = JsonObject>(): Promise<T> => this.get('system', '/memory'),
    getStorageInfo: <T = JsonObject>(): Promise<T> => this.get('system', '/storage'),
  };

  readonly insights = {
    getLogs: async <T = JsonObject>(): Promise<Record<string, T>> => mapValues(await this.get<Record<string, T>>('insights', '/log'), dropOwnerName),
    getLog: async <T = JsonObject>({ id }: { id: string }): Promise<T> => dropOwnerName(await this.get<T>('insights', `/log/${id}`)),
    // The log URI is the first three parts of the log id, e.g. "homey:device:<id>"
    getLogEntries: <T = JsonObject>({ id, resolution }: { id: string; resolution?: string }): Promise<T> => {
      const uri = id.split(':', 3).join(':');
      const query = resolution ? `?resolution=${encodeURIComponent(resolution)}` : '';
      return this.get('insights', `/log/${uri}/${id}/entry${query}`);
    },
  };

  private async get<T>(manager: string, path: string): Promise<T> {
    return this.call<T>('GET', manager, path);
  }

  private async send(method: HttpMethod, manager: string, path: string, body: unknown): Promise<void> {
    await this.call(method, manager, path, body);
  }

  private async call<T>(method: HttpMethod, manager: string, path: string, body?: unknown): Promise<T> {
    let response = await this.request(method, manager, path, body);
    // An owner token can be renewed by Homey; fetch a fresh one once and retry
    if (response.status === 401) {
      this.token = null;
      response = await this.request(method, manager, path, body);
    }
    if (response.status < 200 || response.status >= 300) {
      throw new HomeyApiError(errorMessage(response), response.status);
    }
    return parseJson(response.body) as T;
  }

  private async request(method: HttpMethod, manager: string, path: string, body?: unknown): Promise<HttpResponse> {
    this.token ??= await this.options.getToken();
    const headers: Record<string, string> = { Authorization: `Bearer ${this.token}` };
    if (this.options.homeyId) headers['X-Homey-ID'] = this.options.homeyId;
    const text = body === undefined ? undefined : JSON.stringify(body);
    if (text !== undefined) headers['Content-Type'] = 'application/json';
    return this.transport(`${this.baseUrl}/api/manager/${manager}${path}`, {
      method, headers, body: text, timeoutMs: this.timeoutMs,
    });
  }
}

/** Client for this Homey's local API, authorised with the app's owner token */
export async function createHomeyRestClient(homey: HomeyInstance): Promise<HomeyRestClient> {
  return new HomeyRestClient({
    baseUrl: await homey.api.getLocalUrl(),
    homeyId: await homey.cloud.getHomeyId(),
    getToken: () => homey.api.getOwnerApiToken(),
  });
}
