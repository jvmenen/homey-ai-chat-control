/**
 * Flow overview formatter - flows, their cards and tokens as XML
 */

import type { FlowOverviewData } from '../interfaces';
import { escapeXmlText } from './xml-utils';

/**
 * Format complete flow overview as XML (similar to formatHomeStructure)
 * @param overview - Flow overview data from FlowManager
 * @returns Formatted XML string with instructions
 */
export function formatFlowOverview(overview: FlowOverviewData): string {
  const { summary } = overview;

  let message = 'Here is your complete flow overview in XML format for easy parsing:\n\n';
  message += `SUMMARY: ${summary.total} flows (${summary.enabled} enabled, ${summary.disabled} disabled, ${summary.mcpFlows} MCP flows)\n\n`;
  message += `<flows total="${summary.total}" enabled="${summary.enabled}" disabled="${summary.disabled}">\n`;

  for (const flow of overview.flows) {
    message += buildFlowXML(flow);
  }

  message += '</flows>\n\n';
  message += getFlowOverviewInstructions();

  return message;
}

type FlowItem = FlowOverviewData['flows'][number];
type FlowCard = FlowItem['cards'][number];

// Device args are already shown as the card's device-id attribute
const DEVICE_ARG_KEYS = new Set(['device', 'deviceId', 'deviceUri']);

/**
 * Build XML for a single flow with its cards
 */
function buildFlowXML(flow: FlowItem): string {
  return `${renderFlowOpeningTag(flow)}\n${flow.cards.map(renderCard).join('')}  </flow>\n`;
}

/** Opening flow tag; only non-default values are included */
function renderFlowOpeningTag(flow: FlowItem): string {
  let tag = `  <flow id="${escapeXmlText(flow.id)}" name="${escapeXmlText(flow.name)}"`;
  if (flow.type === 'advanced') tag += ' type="advanced"';
  if (flow.folderPath) {
    tag += ` folder-path="${escapeXmlText(flow.folderPath)}"`;
  } else if (flow.folder) {
    // Fallback to folder ID if path not available
    tag += ` folder-id="${escapeXmlText(flow.folder)}"`;
  }
  if (!flow.enabled) tag += ' enabled="false"';
  if (flow.mcpCommand) tag += ` mcp-command="${escapeXmlText(flow.mcpCommand)}"`;
  return `${tag}>`;
}

/** One card: self-closing, or with args, token input and tokens as children */
function renderCard(card: FlowCard): string {
  let tag = `    <${card.type} app-id="${escapeXmlText(card.appId)}" card-id="${escapeXmlText(card.cardId)}"`;
  if (card.deviceId) tag += ` device-id="${escapeXmlText(card.deviceId)}"`;

  const children = [
    ...renderCardArgs(card.args),
    ...renderTokenInput(card.tokenInput),
    ...renderTokens(card.tokens),
  ];
  const hasChildContent = (card.args && Object.keys(card.args).length > 0) || !!card.tokenInput || (card.tokens?.length ?? 0) > 0;

  if (!hasChildContent) return `${tag} />\n`;
  return `${tag}>\n${children.join('')}    </${card.type}>\n`;
}

/** Card parameters (e.g. temperature value, duration), without device references */
function renderCardArgs(args: FlowCard['args']): string[] {
  return Object.entries(args || {})
    .filter(([key]) => !DEVICE_ARG_KEYS.has(key))
    .map(([key, value]) => {
      const valueText = typeof value === 'object' ? JSON.stringify(value) : String(value);
      return `      <arg name="${escapeXmlText(key)}" value="${escapeXmlText(valueText)}" />\n`;
    });
}

/** Token consumed by this card */
function renderTokenInput(tokenInput: FlowCard['tokenInput']): string[] {
  if (!tokenInput) return [];
  return [`      <token-input device-id="${escapeXmlText(tokenInput.deviceId)}" capability="${escapeXmlText(tokenInput.capability)}" />\n`];
}

/** Tokens provided by a trigger card */
function renderTokens(tokens: FlowCard['tokens']): string[] {
  return (tokens || []).map((token) => {
    const name = token.name || 'unknown';
    const title = token.title || name;
    return `      <token name="${escapeXmlText(name)}" type="${escapeXmlText(token.type || '')}" title="${escapeXmlText(title)}" />\n`;
  });
}

/**
 * Get instructions for flow overview XML
 */
function getFlowOverviewInstructions(): string {
  return `INSTRUCTIONS:
- This shows ALL flows in your Homey (automation logic)
- DEFAULT VALUES (omitted when default): enabled="true", type="regular"
- If enabled/type attributes are MISSING, assume the defaults above
- Cards show the automation logic: <trigger>, <condition>, <action>
- <arg> elements show card parameters (e.g., temperature value, duration, etc.)
- <token-input> shows when a card CONSUMES a dynamic variable from another device
- <token> elements show when a trigger PRODUCES dynamic variables for use in other cards
- Use get_home_structure to look up device names from device IDs
`;
}
