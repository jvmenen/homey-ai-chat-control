/**
 * Zigbee network formatter - renders a ZigbeeNetworkSummary as XML for the AI
 */

import type { ZigbeeNetworkSummary, ZigbeeNodeSummary, ZigbeeFilters } from '../diagnostics/zigbee-network';
import { xmlAttrs } from './xml-utils';

const INSTRUCTIONS = `INSTRUCTIONS:
- Routers are mains-powered devices (bulbs, plugs) that relay traffic; end devices (usually battery sensors and remotes) talk through one parent router
- type="unknown" means Homey did not record the device type (often older battery devices); treat them as end devices unless the model says otherwise
- route-via lists the routers Homey uses to reach a node, in the order Homey reports them; no route-via means direct contact with Homey or no known route
- routes-through counts how many other nodes use a router in their route; a heavily used or unreliable router affects all of them
- tx counters are packets Homey sent to the node; battery end devices mostly send, so they often show tx=0 with a non-zero rx
- tx-error-rate-percent is only given with at least 20 transmissions; above 10% points to a weak link or interference
- Very high rx counts on a few routers compared to similar devices can indicate a chatty device flooding the mesh
- last-seen is Homey's own bookkeeping and can lag behind; confirm with Insights (e.g. last contact or motion event) before concluding a device is dead
- Homey never marks battery Zigbee devices unavailable, so a stale end device can still look normal in the app
- Statistics are counted since the last Homey restart
- The network key is never included in this output
`;

function renderSummaryLine(summary: ZigbeeNetworkSummary, filters: ZigbeeFilters): string {
  let line = `SUMMARY: ${summary.nodes.length} of ${summary.totalNodes} node(s) shown`;
  line += ` (in total: ${summary.routers} routers, ${summary.endDevices} end devices`;
  if (summary.unknownType > 0) line += `, ${summary.unknownType} of unknown type`;
  line += ')';
  if (filters.nameFilter) line += ` (name: "${filters.nameFilter}")`;
  if (filters.nodeType) line += ` (type: ${filters.nodeType})`;
  if (filters.onlyIssues) line += ' (only issues)';
  return line;
}

function renderNode(node: ZigbeeNodeSummary): string {
  const isCoordinator = node.type === 'coordinator';
  const attributes = xmlAttrs({
    name: node.name,
    type: node.type,
    address: node.networkAddress,
    model: node.model,
    manufacturer: node.manufacturer,
    firmware: node.firmware,
    'last-seen': isCoordinator ? undefined : (node.lastSeen ?? 'never'),
    'hours-since-last-seen': isCoordinator ? undefined : node.hoursSinceLastSeen,
    stale: isCoordinator ? undefined : node.stale,
    tx: isCoordinator ? undefined : node.tx,
    'tx-success': isCoordinator ? undefined : node.txSuccess,
    'tx-error': isCoordinator ? undefined : node.txError,
    'tx-error-rate-percent': isCoordinator ? undefined : node.txErrorRate,
    rx: isCoordinator ? undefined : node.rx,
    'routes-through': node.type === 'router' ? node.routesThrough : undefined,
    'route-via': node.routeVia.length > 0 ? node.routeVia.join(' > ') : undefined,
  });
  return `  <node${attributes} />`;
}

export function formatZigbeeNetwork(summary: ZigbeeNetworkSummary, filters: ZigbeeFilters): string {
  const networkAttributes = xmlAttrs({
    ready: summary.ready,
    availability: summary.availability,
    channel: summary.channel,
    'controller-firmware': summary.controllerFirmware,
    'stale-after-hours': summary.staleAfterHours,
  });
  const nodes = summary.nodes.length > 0
    ? summary.nodes.map(renderNode)
    : ['  <!-- No Zigbee nodes found matching the filters -->'];

  return [
    'Zigbee network diagnostics in XML format for easy parsing:',
    '',
    renderSummaryLine(summary, filters),
    '',
    `<zigbee-network${networkAttributes}>`,
    ...nodes,
    '</zigbee-network>',
    '',
    INSTRUCTIONS,
  ].join('\n');
}
