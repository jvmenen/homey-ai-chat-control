/**
 * Trigger Any Flow Tool - Execute any Homey flow by command name
 */

import Homey from 'homey';
import { BaseTool } from './base-tool';
import { MCPTool, MCPToolCallResult } from '../types';
import { IFlowManager } from '../interfaces';

/**
 * Workaround tool for triggering flows that aren't in the current tool list
 * Allows immediate execution of newly created flows without starting a new conversation
 */
export class TriggerAnyFlowTool extends BaseTool {
  readonly name = 'trigger_any_flow';

  constructor(
    private homey: any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Homey type is a namespace
    private flowManager: IFlowManager
  ) {
    super();
  }

  getDefinition(): MCPTool {
    return {
      name: this.name,
      description: `WORKAROUND - Trigger any Homey flow by command name.

PURPOSE: Execute flows that exist but aren't showing as dedicated tools yet.

WHEN TO USE:
- After refresh_homey_flows found a flow but it's not in the tool list
- As a workaround when flows are newly created
- When you know the exact command name of a flow

HOW IT WORKS:
1. Triggers the "MCP command received" card in Homey flows
2. Flows listening for this specific command will execute
3. Can pass parameters to the flow

PARAMETERS:
- command: Exact command name from the flow (REQUIRED)
- parameters: Optional key-value pairs for flow tokens

EXAMPLE:
  command: "start_radio"
  parameters: { "station": "NPO Radio 1", "volume": "30" }

NOTE: This is a workaround. Flows triggered this way work immediately, but won't appear as dedicated tools until you start a new conversation.`,
      inputSchema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The exact command name from the flow (e.g., "start_radio", "toggle_lights")',
          },
          parameters: {
            type: 'object',
            description: 'Optional parameters as key-value pairs',
            additionalProperties: true,
          },
        },
        required: ['command'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    try {
      this.validateRequiredArgs(args, ['command']);

      const commandName = args.command as string;
      const parameters = (args.parameters as Record<string, unknown>) || {};

      this.homey.log('🎯 Generic flow trigger requested');
      this.homey.log(`   Command: ${commandName}`);
      this.homey.log(`   Parameters: ${JSON.stringify(parameters)}`);

      const result = await this.flowManager.triggerCommand(commandName, parameters);

      if (result.success) {
        return this.createSuccessResponse(
          `✅ Successfully triggered flow: ${commandName}\n${result.message || ''}`
        );
      } else {
        return this.createErrorResponse(
          `Failed to trigger flow: ${commandName}\n${result.message || 'Unknown error'}`
        );
      }
    } catch (error) {
      this.homey.error('Error triggering flow:', error);
      return this.createErrorResponse(error as Error);
    }
  }
}
