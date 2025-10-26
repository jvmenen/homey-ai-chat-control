/**
 * Hello Homey Tool - Simple connectivity test tool
 */

import { BaseTool } from './base-tool';
import { MCPTool, MCPToolCallResult } from '../types';

/**
 * Test tool that verifies MCP connection to Homey
 * Returns a greeting message from the Homey Pro
 */
export class HelloHomeyTool extends BaseTool {
  readonly name = 'hello_homey';

  constructor(private homey: any) {
    super();
  }

  getDefinition(): MCPTool {
    return {
      name: this.name,
      description: `TEST TOOL - Verify MCP connection to Homey.

PURPOSE: Simple connectivity test that returns a greeting from your Homey.

WHEN TO USE:
- Testing if MCP server is working
- Debugging connection issues
- Very first test after setup

RARELY NEEDED: Only for testing/debugging purposes.`,
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Your name (optional)',
          },
        },
      },
    };
  }

  async execute(args: any): Promise<MCPToolCallResult> {
    const userName = args?.name || 'there';
    const message = `Hello ${userName}! 👋 This message is coming from your Homey Pro!`;

    this.homey.log(`Executed hello_homey tool with message: ${message}`);

    return this.createSuccessResponse(message);
  }
}
