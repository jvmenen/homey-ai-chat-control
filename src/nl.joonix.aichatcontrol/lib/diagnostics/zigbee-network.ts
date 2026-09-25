/**
 * Zigbee network diagnostics - pure logic
 *
 * Turns the raw state of Homey's Zigbee manager into a diagnostic summary per node.
 *
 * SECURITY: the raw state contains the network key and its frame counter. Only the
 * fields declared in the summary types below are copied, so secrets can never leak.
 */

import { hoursSince } from '../utils/time';

// ----- Raw shapes as returned by `zigbee.getState()` (only the fields read here) -----

export interface RawZigbeeNode {
  networkAddress?: number;
  nwkAddr?: number;
  name?: string;
  lastSeen?: number | null;
  stats?: { tx?: number; txSuccess?: number; txError?: number; rx?: number };
  type?: string;
  deviceType?: string;
  modelId?: string;
  manufacturerName?: string;
  swBuildId?: string;
}

export interface RawZigbeeState {
  zigbee_ready?: boolean;
  availability?: { zigbee?: string };
  controllerState?: {
    channel?: number;
    softwareVersion?: string;
    routes?: Record<string, number[]>;
    // networkKey, networkKeyFrameCounter, extendedPanId etc. are deliberately NOT declared
  };
  nodes?: Record<string, RawZigbeeNode> | RawZigbeeNode[];
}

// ----- Summary shapes -----

export type ZigbeeNodeType = 'coordinator' | 'router' | 'enddevice' | 'unknown';

export interface ZigbeeNodeSummary {
  name: string;
  type: ZigbeeNodeType;
  networkAddress: number | null;
  model?: string;
  manufacturer?: string;
  firmware?: string;
  lastSeen: string | null;
  hoursSinceLastSeen: number | null;
  stale: boolean;
  tx: number;
  txSuccess: number;
  txError: number;
  txErrorRate: number | null;
  rx: number;
  routeVia: string[];
  routesThrough: number;
}

export interface ZigbeeNetworkSummary {
  ready: boolean;
  availability: string;
  channel: number | null;
  controllerFirmware: string | null;
  staleAfterHours: number;
  totalNodes: number;
  routers: number;
  endDevices: number;
  unknownType: number;
  nodes: ZigbeeNodeSummary[];
}

export interface ZigbeeFilters {
  nameFilter?: string;
  nodeType?: 'router' | 'enddevice';
  staleAfterHours: number;
  onlyIssues?: boolean;
}

// An error rate is only meaningful with enough traffic
export const MIN_TX_FOR_ERROR_RATE = 20;
export const HIGH_ERROR_RATE_PERCENT = 10;

const TYPE_ORDER: Record<ZigbeeNodeType, number> = {
  coordinator: 0, router: 1, enddevice: 2, unknown: 3,
};

interface RoutingTable {
  hopsTo(address: number): string[];
  timesUsedAsHop(address: number): number;
}

function nodeAddress(node: RawZigbeeNode): number | null {
  return node.networkAddress ?? node.nwkAddr ?? null;
}

function nodeType(node: RawZigbeeNode): ZigbeeNodeType {
  const type = (node.type || node.deviceType || '').toLowerCase();
  return type === 'coordinator' || type === 'router' || type === 'enddevice' ? type : 'unknown';
}

function nodeName(node: RawZigbeeNode): string {
  const address = nodeAddress(node);
  return node.name || (address !== null ? `node ${address}` : 'unknown');
}

function errorRatePercent(tx: number, txError: number): number | null {
  return tx >= MIN_TX_FOR_ERROR_RATE ? Math.round((txError / tx) * 1000) / 10 : null;
}

function buildRoutingTable(nodes: RawZigbeeNode[], routes: Record<string, number[]>): RoutingTable {
  const nameByAddress = new Map<number, string>();
  for (const node of nodes) {
    const address = nodeAddress(node);
    if (address !== null) nameByAddress.set(address, nodeName(node));
  }

  const hopCounts = new Map<number, number>();
  for (const hops of Object.values(routes)) {
    for (const hop of hops || []) hopCounts.set(hop, (hopCounts.get(hop) || 0) + 1);
  }

  return {
    hopsTo: (address) => (routes[String(address)] || [])
      .map((hop) => nameByAddress.get(hop) || `unknown node ${hop}`),
    timesUsedAsHop: (address) => hopCounts.get(address) || 0,
  };
}

function summarizeNode(
  node: RawZigbeeNode,
  routing: RoutingTable,
  staleAfterHours: number,
  now: number,
): ZigbeeNodeSummary {
  const address = nodeAddress(node);
  const type = nodeType(node);
  const tx = node.stats?.tx ?? 0;
  const txError = node.stats?.txError ?? 0;
  const lastSeenMs = typeof node.lastSeen === 'number' && node.lastSeen > 0 ? node.lastSeen : null;
  const hours = lastSeenMs === null ? null : hoursSince(lastSeenMs, now);

  return {
    name: nodeName(node),
    type,
    networkAddress: address,
    model: node.modelId || undefined,
    manufacturer: node.manufacturerName || undefined,
    firmware: node.swBuildId || undefined,
    lastSeen: lastSeenMs === null ? null : new Date(lastSeenMs).toISOString(),
    hoursSinceLastSeen: hours,
    stale: type !== 'coordinator' && (hours === null || hours > staleAfterHours),
    tx,
    txSuccess: node.stats?.txSuccess ?? 0,
    txError,
    txErrorRate: errorRatePercent(tx, txError),
    rx: node.stats?.rx ?? 0,
    routeVia: address !== null ? routing.hopsTo(address) : [],
    routesThrough: address !== null ? routing.timesUsedAsHop(address) : 0,
  };
}

export function hasIssue(node: ZigbeeNodeSummary): boolean {
  if (node.type === 'coordinator') return false;
  if (node.stale) return true;
  return node.txErrorRate !== null && node.txErrorRate >= HIGH_ERROR_RATE_PERCENT;
}

function matchesFilters(node: ZigbeeNodeSummary, filters: ZigbeeFilters): boolean {
  if (filters.nameFilter && !node.name.toLowerCase().includes(filters.nameFilter.toLowerCase())) return false;
  if (filters.nodeType && node.type !== filters.nodeType) return false;
  if (filters.onlyIssues && !hasIssue(node)) return false;
  return true;
}

function byTypeThenName(a: ZigbeeNodeSummary, b: ZigbeeNodeSummary): number {
  return TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.name.localeCompare(b.name);
}

const countOfType = (nodes: ZigbeeNodeSummary[], type: ZigbeeNodeType) => nodes.filter((n) => n.type === type).length;

/**
 * Build a secret-free diagnostic summary from the raw Zigbee state.
 * Totals describe the whole network; `nodes` holds only the filtered nodes.
 */
export function summarizeZigbeeState(
  raw: RawZigbeeState,
  filters: ZigbeeFilters,
  now: number = Date.now(),
): ZigbeeNetworkSummary {
  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes : Object.values(raw.nodes || {});
  const routing = buildRoutingTable(rawNodes, raw.controllerState?.routes || {});
  const allNodes = rawNodes.map((node) => summarizeNode(node, routing, filters.staleAfterHours, now));

  return {
    ready: raw.zigbee_ready === true,
    availability: raw.availability?.zigbee || 'unknown',
    channel: raw.controllerState?.channel ?? null,
    controllerFirmware: raw.controllerState?.softwareVersion ?? null,
    staleAfterHours: filters.staleAfterHours,
    totalNodes: allNodes.length,
    routers: countOfType(allNodes, 'router'),
    endDevices: countOfType(allNodes, 'enddevice'),
    unknownType: countOfType(allNodes, 'unknown'),
    nodes: allNodes.filter((node) => matchesFilters(node, filters)).sort(byTypeThenName),
  };
}
