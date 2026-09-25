/**
 * Insights formatter - insight log lists and historical data as XML
 */

import type { InsightLog, InsightLogWithData } from '../managers/insights-manager';
import { escapeXmlText } from './xml-utils';

/**
 * Format insight logs overview as XML
 * @param logs - Insight logs from InsightsManager
 * @returns Formatted XML string with instructions
 */
export function formatInsightLogs(logs: InsightLog[]): string {
  const numberLogs = logs.filter((l) => l.type === 'number').length;
  const booleanLogs = logs.filter((l) => l.type === 'boolean').length;

  let message = 'Here are the available insight logs in XML format for easy parsing:\n\n';
  message += `SUMMARY: ${logs.length} insight logs (${numberLogs} numeric, ${booleanLogs} boolean)\n\n`;
  message += `<insights total="${logs.length}" numeric="${numberLogs}" boolean="${booleanLogs}">\n`;

  message += logs.length === 0 ? '  <!-- No insight logs found -->\n' : logs.map(renderInsightLog).join('');

  message += '</insights>\n\n';
  message += getInsightLogsInstructions();

  return message;
}

/**
 * Get instructions for insight logs XML
 */
function getInsightLogsInstructions(): string {
  return `INSTRUCTIONS:
- This shows all available insight logs (historical data tracking)
- Each log tracks a specific metric for a device over time
- Numeric logs track values like temperature, power consumption, humidity
- Boolean logs track on/off states, motion detection, etc.
- Use get_insight_data with the log ID to retrieve actual historical data
- Filter by device-id or zone-id to find specific insights
`;
}

/**
 * Format insight data (historical entries) as XML
 * @param data - Insight data from InsightsManager
 * @param resolution - The resolution used for the query
 * @returns Formatted XML string with instructions
 */
export function formatInsightData(data: InsightLogWithData[], resolution?: string): string {
  const totalEntries = data.reduce((sum, log) => sum + log.entries.length, 0);

  let message = 'Historical insight data in XML format for easy parsing:\n\n';
  message += `SUMMARY: ${data.length} logs, ${totalEntries} total entries`;
  if (resolution) {
    message += `, resolution: ${resolution}`;
  }
  message += '\n\n';

  const resolutionAttr = resolution ? ` resolution="${resolution}"` : '';
  message += `<insight-data${resolutionAttr}>\n`;

  message += data.length === 0 ? '  <!-- No insight data found -->\n' : data.map(renderInsightDataLog).join('');

  message += '</insight-data>\n\n';
  message += getInsightDataInstructions();

  return message;
}

/**
 * Get instructions for insight data XML
 */
function getInsightDataInstructions(): string {
  return `INSTRUCTIONS:
- This shows historical time-series data for insight logs
- Each <entry> has a timestamp (ISO 8601 format) and value
- Timestamps are sorted chronologically (oldest first)
- Resolution affects data granularity (lastHour = more detail, last31Days = aggregated)
- Empty logs indicate no data available for the requested period
- Use this data to analyze trends, calculate statistics, or answer historical queries
`;
}

/** One available insight log; optional attributes only when set */
function renderInsightLog(log: InsightLog): string {
  let tag = `  <log id="${escapeXmlText(log.id)}" title="${escapeXmlText(log.title)}" type="${log.type}"`;
  if (log.units) tag += ` units="${escapeXmlText(log.units)}"`;
  if (log.type === 'boolean') {
    if (log.titleTrue) tag += ` title-true="${escapeXmlText(log.titleTrue)}"`;
    if (log.titleFalse) tag += ` title-false="${escapeXmlText(log.titleFalse)}"`;
  }
  if (log.decimals !== undefined) tag += ` decimals="${log.decimals}"`;
  tag += ` device-id="${escapeXmlText(log.ownerId)}" device-name="${escapeXmlText(log.ownerName)}"`;
  if (log.zoneName) tag += ` zone-name="${escapeXmlText(log.zoneName)}"`;
  if (log.zoneId) tag += ` zone-id="${escapeXmlText(log.zoneId)}"`;
  return `${tag} />\n`;
}

/** One log with its historical entries */
function renderInsightDataLog(log: InsightLogWithData): string {
  let tag = `  <log id="${escapeXmlText(log.id)}" title="${escapeXmlText(log.title)}" type="${log.type}"`;
  if (log.units) tag += ` units="${escapeXmlText(log.units)}"`;
  tag += ` entries="${log.entries.length}"`;
  if (log.entries.length === 0) return `${tag} />\n`;

  const entries = log.entries
    .map((entry) => `    <entry timestamp="${escapeXmlText(entry.timestamp)}" value="${entry.value}" />\n`)
    .join('');
  return `${tag}>\n${entries}  </log>\n`;
}
