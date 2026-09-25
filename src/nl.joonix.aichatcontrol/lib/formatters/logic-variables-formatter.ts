/**
 * Logic variables formatter - Homey Logic variables as XML
 */

import type { LogicVariable } from '../types';
import { escapeXmlText } from './xml-utils';

/**
 * Format logic variables as XML
 * @param variables - Logic variables from Homey API
 * @param filters - Optional filter info for summary
 * @returns Formatted XML string
 */
export function formatLogicVariables(
  variables: LogicVariable[],
  filters?: { filterType?: string; searchName?: string },
): string {
  let message = 'Logic variables in XML format for easy parsing:\n\n';
  message += `SUMMARY: ${variables.length} variable(s)`;
  if (filters?.filterType) message += ` (type: ${filters.filterType})`;
  if (filters?.searchName) message += ` (search: "${filters.searchName}")`;
  message += '\n\n';

  message += `<logic-variables count="${variables.length}">\n`;

  if (variables.length === 0) {
    message += '  <!-- No logic variables found matching the filters -->\n';
  } else {
    for (const variable of variables) {
      message += `  <variable id="${escapeXmlText(variable.id)}"`;
      message += ` name="${escapeXmlText(variable.name)}"`;
      message += ` type="${variable.type}"`;
      message += ` value="${escapeXmlText(String(variable.value))}"`;
      message += ' />\n';
    }
  }

  message += '</logic-variables>\n\n';
  message += getLogicVariablesInstructions();

  return message;
}

/**
 * Get instructions for logic variables XML
 */
function getLogicVariablesInstructions(): string {
  return `INSTRUCTIONS:
- Logic variables are used in Homey flows for dynamic automation behavior
- Types: "number" (thresholds, counters), "boolean" (flags), "string" (text values)
- Variable values can be referenced in flow conditions and actions
`;
}
