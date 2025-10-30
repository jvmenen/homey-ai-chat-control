/**
 * Get Installed Apps Tool - List all installed Homey apps
 */

import { BaseTool } from './base-tool';
import { MCPTool, MCPToolCallResult, HomeyInstance } from '../types';
import type { HomeyAPIV3Local } from 'homey-api';

// Type aliases for flow cards
type FlowCardTrigger = HomeyAPIV3Local.ManagerFlow.FlowCardTrigger;
type FlowCardCondition = HomeyAPIV3Local.ManagerFlow.FlowCardCondition;
type FlowCardAction = HomeyAPIV3Local.ManagerFlow.FlowCardAction;

/**
 * Tool to get all installed apps with their IDs and names
 * Useful for filtering flows by app ID
 */
export class GetInstalledAppsTool extends BaseTool {
  readonly name = 'get_installed_apps';

  constructor(
    private homey: HomeyInstance
  ) {
    super();
  }

  getDefinition(): MCPTool {
    return {
      name: this.name,
      description: `Get all installed Homey apps with their IDs and names.

PURPOSE: Discover available apps to use for filtering flows or understanding integrations.

WHEN TO USE:
- Before filtering flows by app_ids (to find the correct app ID)
- To see what integrations are available in Homey
- To find app names for better understanding of flow cards

WHAT YOU GET:
- App ID (e.g., "com.athom.hue") - Use this for filtering
- App name (e.g., "Philips Hue") - Human-readable name
- App version
- Additional metadata like author, brand, etc.
- Optionally: Flow cards that each app provides
- Optionally: Devices that each app provides
- Optionally: Custom capabilities that each app defines

BEST PRACTICE: Use this before calling get_flow_overview with app_ids filter.

EXAMPLE: To find Philips Hue flows, first call this to get "com.athom.hue", then use that ID in get_flow_overview.`,
      inputSchema: {
        type: 'object',
        properties: {
          app_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter to only show specific apps by their IDs (e.g., ["com.athom.hue", "com.somfy.tahoma"])',
          },
          include_flow_cards: {
            type: 'boolean',
            description: 'Include flow cards (triggers, conditions, actions) provided by each app',
          },
          include_devices: {
            type: 'boolean',
            description: 'Include devices provided by each app',
          },
          include_capabilities: {
            type: 'boolean',
            description: 'Include custom capabilities defined by each app',
          },
        },
      },
    };
  }

  async execute(args?: {
    app_ids?: string[];
    include_flow_cards?: boolean;
    include_devices?: boolean;
    include_capabilities?: boolean;
  }): Promise<MCPToolCallResult> {
    try {
      const appIds = args?.app_ids || [];
      const includeFlowCards = args?.include_flow_cards || false;
      const includeDevices = args?.include_devices || false;
      const includeCapabilities = args?.include_capabilities || false;

      this.homey.log('📱 Getting installed apps', {
        appIds, includeFlowCards, includeDevices, includeCapabilities
      });

      // Create Homey API instance
      const { HomeyAPI } = require('homey-api');
      const api = await HomeyAPI.createAppAPI({ homey: this.homey });

      // Get all installed apps
      const apps = await api.apps.getApps();

      // Get devices if requested
      let devices: Record<string, HomeyAPIV3Local.ManagerDevices.Device> = {};
      if (includeDevices) {
        devices = await api.devices.getDevices();
      }

      // Get flow cards if requested
      let allFlowCardTriggers: Record<string, FlowCardTrigger> = {};
      let allFlowCardConditions: Record<string, FlowCardCondition> = {};
      let allFlowCardActions: Record<string, FlowCardAction> = {};
      if (includeFlowCards) {
        allFlowCardTriggers = await api.flow.getFlowCardTriggers();
        allFlowCardConditions = await api.flow.getFlowCardConditions();
        allFlowCardActions = await api.flow.getFlowCardActions();
      }

      // Format apps into a readable list
      let message = 'Installed Homey Apps:\n\n';

      const appList = Object.entries(apps).map(([id, app]: [string, any]) => { // App type from HomeyAPI is incomplete
        // Filter flow cards for this app based on ownerUri
        const appUri = `homey:app:${id}`;

        return {
          id,
          name: app.name || app.id,
          version: app.version || 'unknown',
          author: app.author?.name || 'unknown',
          brand: app.brandColor || undefined,
          flowCards: includeFlowCards ? {
            triggers: Object.values(allFlowCardTriggers).filter((card: FlowCardTrigger) =>
              card.ownerUri?.startsWith(appUri)
            ),
            conditions: Object.values(allFlowCardConditions).filter((card: FlowCardCondition) =>
              card.ownerUri?.startsWith(appUri)
            ),
            actions: Object.values(allFlowCardActions).filter((card: FlowCardAction) =>
              card.ownerUri?.startsWith(appUri)
            ),
          } : undefined,
          devices: includeDevices ? Object.values(devices).filter((d: HomeyAPIV3Local.ManagerDevices.Device) => {
            const driverId = d.driverId || '';
            return driverId.startsWith(`homey:app:${id}:`);
          }) : undefined,
          capabilities: includeCapabilities ? (app.manifest?.capabilities || {}) : undefined,
        };
      });

      // Filter by app IDs if specified
      let filteredAppList = appList;
      if (appIds.length > 0) {
        filteredAppList = appList.filter(app => appIds.includes(app.id));
      }

      // Sort by name for easier reading
      filteredAppList.sort((a, b) => a.name.localeCompare(b.name));

      for (const app of filteredAppList) {
        message += `- ${app.name}\n`;
        message += `  ID: ${app.id}\n`;
        message += `  Version: ${app.version}\n`;
        if (app.author !== 'unknown') {
          message += `  Author: ${app.author}\n`;
        }

        // Add flow cards if requested
        if (includeFlowCards && app.flowCards) {
          const triggerCount = app.flowCards.triggers.length;
          const conditionCount = app.flowCards.conditions.length;
          const actionCount = app.flowCards.actions.length;
          const totalCards = triggerCount + conditionCount + actionCount;

          if (totalCards > 0) {
            message += `  Flow Cards: ${totalCards} total (${triggerCount} triggers, ${conditionCount} conditions, ${actionCount} actions)\n`;

            if (triggerCount > 0) {
              message += `    Triggers:\n`;
              for (const trigger of app.flowCards.triggers) {
                message += `      - ${trigger.id}: ${trigger.title || trigger.id}\n`;
              }
            }

            if (conditionCount > 0) {
              message += `    Conditions:\n`;
              for (const condition of app.flowCards.conditions) {
                message += `      - ${condition.id}: ${condition.title || condition.id}\n`;
              }
            }

            if (actionCount > 0) {
              message += `    Actions:\n`;
              for (const action of app.flowCards.actions) {
                message += `      - ${action.id}: ${action.title || action.id}\n`;
              }
            }
          } else {
            message += `  Flow Cards: None\n`;
          }
        }

        // Add devices if requested
        if (includeDevices && app.devices) {
          const deviceCount = app.devices.length;
          if (deviceCount > 0) {
            message += `  Devices: ${deviceCount}\n`;
            for (const device of app.devices) {
              message += `    - ${device.name} (${device.id})\n`;
            }
          } else {
            message += `  Devices: None\n`;
          }
        }

        // Add capabilities if requested
        if (includeCapabilities && app.capabilities) {
          const capabilityIds = Object.keys(app.capabilities);
          if (capabilityIds.length > 0) {
            message += `  Custom Capabilities: ${capabilityIds.length}\n`;
            for (const capId of capabilityIds) {
              const cap = app.capabilities[capId];
              const capTitle = cap.title?.en || capId;
              message += `    - ${capId}: ${capTitle}\n`;
            }
          } else {
            message += `  Custom Capabilities: None\n`;
          }
        }

        message += '\n';
      }

      if (appIds.length > 0) {
        message += `\nShowing ${filteredAppList.length} of ${appList.length} apps (filtered by app_ids)\n\n`;
      } else {
        message += `\nTotal: ${appList.length} apps installed\n\n`;
      }
      message += 'TIP: Use the app ID in get_flow_overview with app_ids filter to find flows using specific apps.';

      return this.createSuccessResponse(message);
    } catch (error) {
      this.homey.error('Error getting installed apps:', error);
      return this.createErrorResponse(error as Error);
    }
  }
}
