'use strict';

import Homey from 'homey';
import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { FlowManager } from './lib/flow-manager';
import { ZoneDeviceManager } from './lib/zone-device-manager';

module.exports = class HomeyMCPApp extends Homey.App {
  private httpServer: any;
  private mcpServer!: Server;
  private flowManager!: FlowManager;
  private zoneDeviceManager!: ZoneDeviceManager;
  private connectedClients: Set<any> = new Set();
  private lastKnownToolsList: string = '';

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    try {
      this.log('HomeyMCP Server is starting...');

      // Register flow trigger card
      this.log('Registering flow trigger card...');
      const mcpCommandTrigger = this.homey.flow.getTriggerCard('mcp_command_received');
      this.log('Flow trigger card registered');

      // Initialize Flow Manager with trigger card FIRST
      this.log('Initializing Flow Manager...');
      this.flowManager = new FlowManager(this.homey, mcpCommandTrigger);
      await this.flowManager.init();
      this.log('Flow Manager initialized');

      // Initialize Zone & Device Manager
      this.log('Initializing Zone & Device Manager...');
      this.zoneDeviceManager = new ZoneDeviceManager(this.homey);
      await this.zoneDeviceManager.init();
      this.log('Zone & Device Manager initialized');

      // Setup run listener to validate command argument matching
      // This ensures only flows with matching command names execute
      this.log('Setting up run listener for command validation...');
      mcpCommandTrigger.registerRunListener(async (args: any, state: any) => {
        try {
          // args.command contains the user-configured command name in the flow (now a string)
          // state.command contains the triggered command name from MCP
          const configuredCommand = args.command;
          const triggeredCommand = state.command;

          this.log(`Run listener: Checking if flow command "${configuredCommand}" matches triggered "${triggeredCommand}"`);

          // Only execute flows where the command names match exactly
          const shouldRun = configuredCommand === triggeredCommand;

          if (shouldRun) {
            this.log(`✓ Flow will execute: command match confirmed`);
          } else {
            this.log(`✗ Flow will NOT execute: command mismatch`);
          }

          return shouldRun;
        } catch (err) {
          this.error('Run listener error:', err);
          return false; // Don't execute on error
        }
      });
      this.log('Run listener registered');
    } catch (error) {
      this.error('FATAL ERROR in onInit:', error);
      throw error;
    }

    // Initialize MCP Server
    this.mcpServer = new Server(
      {
        name: 'homey-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {
            listChanged: true,  // We support dynamic tool list changes
          },
        },
      }
    );

    // Set up MCP handlers
    this.setupMCPHandlers();

    // Create Express app for HTTP endpoints
    const app = express();
    app.use(express.json());
    app.use(express.raw({ type: 'application/json' }));

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', message: 'Homey MCP Server is running' });
    });

    // Main MCP endpoint - handle as raw HTTP transport
    app.post('/mcp', express.json(), async (req, res) => {
      try {
        this.log('Received MCP request:', JSON.stringify(req.body));

        // Create a simple stdio-like transport manually
        const request = req.body;
        const method = request.method;

        let response: any;

        if (method === 'initialize') {
          response = {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              protocolVersion: '2025-06-18',
              capabilities: {
                tools: {},
              },
              serverInfo: {
                name: 'homey-mcp-server',
                version: '0.1.0',
              },
            },
          };
        } else if (method === 'tools/list') {
          const tools = await this.getToolsList();
          response = {
            jsonrpc: '2.0',
            id: request.id,
            result: tools,
          };
        } else if (method === 'tools/call') {
          const result = await this.callTool(request.params);
          response = {
            jsonrpc: '2.0',
            id: request.id,
            result,
          };
        } else if (method === 'ping') {
          response = {
            jsonrpc: '2.0',
            id: request.id,
            result: {},
          };
        } else if (method === 'prompts/list') {
          response = {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              prompts: [],
            },
          };
        } else if (method === 'resources/list') {
          response = {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              resources: [],
            },
          };
        } else if (method === 'notifications/initialized') {
          // Client has completed initialization and is ready to communicate
          this.log('📡 MCP Client initialized and connected');
          this.log('   Client is now ready to receive tool updates');

          // Optional: Track connected clients for future notification support
          // (Currently not used since HTTP can't push notifications)

          // No response needed for notifications, just acknowledge
          return res.status(200).send();
        } else {
          response = {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32601,
              message: `Method not found: ${method}`,
            },
          };
        }

        this.log('Sending MCP response:', JSON.stringify(response));
        res.json(response);
      } catch (error: any) {
        this.error('MCP request error:', error);
        res.status(500).json({
          jsonrpc: '2.0',
          id: req.body?.id || null,
          error: {
            code: -32603,
            message: 'Internal error: ' + error.message,
          },
        });
      }
    });

    // Start HTTP server on port 3000, bind to all interfaces
    const port = 3000;
    this.httpServer = app.listen(port, '0.0.0.0', () => {
      this.log(`✓ MCP Server listening on port ${port}`);
      this.log(`✓ Access URL: http://<homey-ip>:${port}/mcp`);
      this.log(`✓ Health check: http://<homey-ip>:${port}/health`);
    });

    this.httpServer.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        this.error(`Port ${port} is already in use!`);
      } else {
        this.error('HTTP Server error:', error);
      }
    });

    // Note: No automatic polling needed - Claude can use refresh_homey_flows tool manually
    this.log('Server ready. Use refresh_homey_flows tool to update flow list.');
  }

  private setupMCPHandlers() {
    // Just initialize - we'll handle requests manually
    this.log('MCP handlers initialized');
  }

  private async getToolsList() {
    this.log('Handling tools/list request');

    try {
      // Get tools from discovered flows
      const flowTools = await this.flowManager.getToolsFromFlows();

      this.log('=== DISCOVERED MCP FLOWS ===');
      if (flowTools.length === 0) {
        this.log('No flows found using MCP trigger card.');
        this.log('Create a flow with trigger "MCP command received" to add tools.');
      } else {
        this.log(`Found ${flowTools.length} flows with MCP triggers:`);
        flowTools.forEach((tool, index) => {
          this.log(`  ${index + 1}. ${tool.name} - ${tool.description}`);
        });
      }
      this.log('============================');

      // Combine: test tools + utility tools + zone/device tools + flow tools
      const tools = [
        // ============ UTILITY TOOLS ============
        {
          name: 'hello_homey',
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
        },
        {
          name: 'refresh_homey_flows',
          description: `Refresh the list of available Homey flows with MCP triggers.

PURPOSE: Re-scan Homey for flows that use the "MCP command received" trigger card.

WHEN TO USE:
- After creating new Homey flows with MCP triggers
- When a flow exists but doesn't appear as a tool
- After modifying flow parameters

IMPORTANT: New flows won't appear as dedicated tools in the current conversation, but:
1. This tool will show you what flows were found
2. You can immediately use trigger_any_flow to execute them
3. They will appear as dedicated tools in NEW conversations

OUTPUT: Shows all discovered flows with their commands and parameters.`,
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'trigger_any_flow',
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
        },
        // Zone & Device Information Tools (Read-Only)
        // ============ EFFICIENT SNAPSHOT TOOLS (RECOMMENDED) ============
        {
          name: 'get_home_structure',
          description: `MOST EFFICIENT - Use this FIRST in every conversation!

PURPOSE: Get complete static home structure (zones + all devices with their capabilities) in a single API call.

WHEN TO USE:
- At the START of every conversation to understand the home layout
- When you need to know what zones exist and what devices are in them
- When you need to see what capabilities each device has

WHAT YOU GET:
- All zones with hierarchy (parent-child relationships)
- All devices with: name, ID, zone, class/type, capabilities list
- No current values (use get_states for that)

EFFICIENCY: Gets all zones and devices in a single efficient call. Call this ONCE and keep the structure in your context for the entire conversation.

BEST PRACTICE: Call get_home_structure first, then use get_states to get current values when needed.`,
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_states',
          description: `MOST EFFICIENT - Use this for getting current device values!

PURPOSE: Get current state/values of multiple devices in a single API call with optional filtering.

WHEN TO USE:
- When you need current values (on/off, temperature, dim level, etc.)
- When checking "are lights on in zone X?"
- When checking multiple device states at once
- When you want to know which zones are currently active

FILTERS (all optional):
- zoneId: Get states only for devices in a specific zone
- deviceIds: Get states only for specific devices
- capability: Get only specific capability values (e.g., just "onoff" states)

WHAT YOU GET:
- Current values for all matching devices
- List of currently active zones (motion/presence detected)

EFFICIENCY: Gets multiple device states in one call. Instead of 6 separate calls for 6 lights, make 1 call with zone filter.

BEST PRACTICE: Use after get_home_structure. Filter by zone and/or capability to get exactly what you need.`,
          inputSchema: {
            type: 'object',
            properties: {
              zoneId: {
                type: 'string',
                description: 'Optional: Only get states for devices in this zone',
              },
              deviceIds: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Optional: Only get states for these specific device IDs',
              },
              capability: {
                type: 'string',
                description: 'Optional: Only get this specific capability (e.g., "onoff", "measure_temperature")',
              },
            },
          },
        },
        // ============ SPECIALIZED ZONE TOOLS ============
        {
          name: 'get_zone_details',
          description: `Get zone details with activity status in XML format.

PURPOSE: Get information about zone(s) with activity/motion detection details.

WHEN TO USE:
- Check details of a specific zone (provide zoneId)
- Get all currently active zones (no zoneId = shows only active zones)
- Check motion/presence sensors that triggered activity

PARAMETERS:
- zoneId (optional): Specific zone to get details for
- If zoneId provided: Returns full details of that zone (active or not)
- If no zoneId: Returns ONLY zones with current activity

WHAT YOU GET (XML):
- Zone name, ID, icon
- Activity status (active true/false)
- Active origins (which sensors detected motion/presence)
- Last activity update time
- Device count in zone

NOTE: For simple "which zones are active" check, use get_states (includes active-zones). Use this tool when you need detailed zone-specific information.`,
          inputSchema: {
            type: 'object',
            properties: {
              zoneId: {
                type: 'string',
                description: 'Optional: Get details for this specific zone. If omitted, returns all currently active zones.',
              },
            },
          },
        },
        {
          name: 'get_device_info',
          description: `Get detailed information about ONE specific device in XML format.

PURPOSE: Get complete device details including all capabilities with current values, ranges, and permissions.

WHEN TO USE:
- When you need complete info about one specific device
- When troubleshooting a specific device
- When you need to know what capabilities are available and their ranges
- When you need to know if a capability is readable (getable) or writable (setable)

WHAT YOU GET (XML):
- Device ID, name, class, zone
- All capabilities with current values
- Getable/setable flags (can read/write)
- Min/max ranges for numeric capabilities
- Units (°C, %, etc.)
- State attributes for booleans (on/off)

NOTE: For multiple devices, use get_states with deviceIds filter instead.`,
          inputSchema: {
            type: 'object',
            properties: {
              deviceId: {
                type: 'string',
                description: 'The ID of the device to get information about',
              },
            },
            required: ['deviceId'],
          },
        },
        {
          name: 'get_zone_temperature',
          description: `Get temperature readings from all sensors in a zone with statistics.

PURPOSE: Get all temperature readings in a zone with average/min/max.

WHEN TO USE:
- When asking "what's the temperature in the bedroom?"
- When you need temperature statistics for a zone
- When comparing temperatures across multiple sensors

WHAT YOU GET:
- Individual sensor readings
- Average, minimum, maximum temperatures

NOTE: This is a specialized tool. For other capabilities, use get_states.`,
          inputSchema: {
            type: 'object',
            properties: {
              zoneId: {
                type: 'string',
                description: 'The ID of the zone to get temperatures for',
              },
            },
            required: ['zoneId'],
          },
        },
        // ============ DEVICE CONTROL TOOLS (Write Operations) ============
        {
          name: 'control_device',
          description: `UNIVERSAL CONTROL - Control any device capability.

PURPOSE: Set any capability value on any device (most flexible control tool).

WHEN TO USE:
- When controlling non-standard capabilities
- When you know the exact capability name to control
- When specialized tools (set_light, set_thermostat) don't fit

EXAMPLES:
- Turn light on: capability="onoff", value=true
- Set dim to 50%: capability="dim", value=0.5 (note: 0-1 range, not 0-100)
- Set thermostat: capability="target_temperature", value=21
- Set volume: capability="volume_set", value=0.3

VALUE TYPES:
- onoff: boolean (true/false)
- dim: number 0-1 (0=off, 1=100%)
- temperatures: number in Celsius
- volume: number 0-1

NOTE: For lights, prefer set_light (handles dim as 0-100). For zone-wide control, prefer control_zone_lights.`,
          inputSchema: {
            type: 'object',
            properties: {
              deviceId: {
                type: 'string',
                description: 'The ID of the device to control',
              },
              capability: {
                type: 'string',
                description: 'The capability to control (e.g., "onoff", "dim", "target_temperature")',
              },
              value: {
                description: 'The value to set (boolean for onoff, number 0-1 for dim, number for temperature)',
              },
            },
            required: ['deviceId', 'capability', 'value'],
          },
        },
        {
          name: 'toggle_device',
          description: `Toggle a device between on and off states.

PURPOSE: Switch device to opposite state (on→off or off→on).

WHEN TO USE:
- When user says "toggle the light"
- When you want to flip current state without knowing it
- Quick on/off switch for any device

WORKS WITH: Any device with onoff capability (lights, switches, plugs, etc.)

NOTE: This reads current state first, then sets opposite. For explicit on/off, use set_light or control_device.`,
          inputSchema: {
            type: 'object',
            properties: {
              deviceId: {
                type: 'string',
                description: 'The ID of the device to toggle',
              },
            },
            required: ['deviceId'],
          },
        },
        {
          name: 'set_light',
          description: `RECOMMENDED for lights - Control light with convenient parameters.

PURPOSE: Control lights with human-friendly dim values (0-100 instead of 0-1).

WHEN TO USE:
- When controlling any light
- When user mentions lights specifically
- When you need to set both on/off and dim level

STATES:
- "on": Turn light on (optionally with dim level)
- "off": Turn light off
- "toggle": Switch to opposite state

DIM LEVEL:
- Use 0-100 range (NOT 0-1 like control_device)
- Only applied when state="on"
- Example: state="on", dim=50 (sets to 50% brightness)

EXAMPLES:
- Turn on at 100%: state="on" (no dim parameter)
- Turn on at 25%: state="on", dim=25
- Turn off: state="off"
- Toggle: state="toggle"`,
          inputSchema: {
            type: 'object',
            properties: {
              deviceId: {
                type: 'string',
                description: 'The ID of the light device',
              },
              state: {
                type: 'string',
                enum: ['on', 'off', 'toggle'],
                description: 'The desired state of the light',
              },
              dim: {
                type: 'number',
                description: 'Optional dim level (0-100). Only used when state is "on".',
              },
            },
            required: ['deviceId', 'state'],
          },
        },
        {
          name: 'set_thermostat',
          description: `Control thermostat temperature.

PURPOSE: Set target temperature on thermostats and heating devices.

WHEN TO USE:
- When user wants to change temperature setting
- "Set bedroom to 21 degrees"
- "Make it warmer/cooler" (adjust current temperature)

TEMPERATURE: Always in degrees Celsius

NOTE: This only sets the TARGET temperature, not current temperature (which is read-only).`,
          inputSchema: {
            type: 'object',
            properties: {
              deviceId: {
                type: 'string',
                description: 'The ID of the thermostat device',
              },
              temperature: {
                type: 'number',
                description: 'The target temperature in degrees Celsius',
              },
            },
            required: ['deviceId', 'temperature'],
          },
        },
        {
          name: 'control_zone_lights',
          description: `BULK CONTROL - Control ALL lights in a zone at once.

PURPOSE: Control multiple lights in a zone with one command.

WHEN TO USE:
- "Turn off all lights in the kitchen"
- "Turn on bedroom lights at 30%"
- "Toggle all living room lights"
- Any command affecting multiple lights in a zone

ACTIONS:
- "on": Turn all lights on
- "off": Turn all lights off
- "toggle": Toggle each light individually

DIM LEVEL:
- Optional, 0-100 range
- Applied to all lights that support dimming
- Only used with action="on"

EFFICIENCY: Much better than calling set_light for each device individually.

EXAMPLE: action="on", dim=50 → turns on all zone lights at 50%`,
          inputSchema: {
            type: 'object',
            properties: {
              zoneId: {
                type: 'string',
                description: 'The ID of the zone',
              },
              action: {
                type: 'string',
                enum: ['on', 'off', 'toggle'],
                description: 'The action to perform on all lights',
              },
              dim: {
                type: 'number',
                description: 'Optional dim level (0-100) to set all lights to',
              },
            },
            required: ['zoneId', 'action'],
          },
        },
        {
          name: 'control_zone_capability',
          description: `ADVANCED BULK CONTROL - Control all devices with specific capability in a zone.

PURPOSE: Control multiple devices of same type in a zone.

WHEN TO USE:
- "Turn off all switches in garage"
- "Set all dimmable devices to 50%"
- Advanced automation scenarios
- When controlling non-light devices zone-wide

HOW IT WORKS:
- Finds all devices in zone with specified capability
- Sets that capability to the value you specify
- Reports success/failure for each device

EXAMPLES:
- All switches off: capability="onoff", value=false
- All dimmers to 50%: capability="dim", value=0.5
- All thermostats to 20°: capability="target_temperature", value=20

NOTE: For lights specifically, use control_zone_lights instead (easier dim handling).`,
          inputSchema: {
            type: 'object',
            properties: {
              zoneId: {
                type: 'string',
                description: 'The ID of the zone',
              },
              capability: {
                type: 'string',
                description: 'The capability to control (e.g., "onoff", "dim")',
              },
              value: {
                description: 'The value to set for the capability',
              },
            },
            required: ['zoneId', 'capability', 'value'],
          },
        },
        ...flowTools,
      ];

      this.log(`Returning ${tools.length} total tools to Claude (${flowTools.length} from flows)`);

      // Check if tools list has changed
      const currentToolsList = JSON.stringify(tools);
      if (this.lastKnownToolsList && this.lastKnownToolsList !== currentToolsList) {
        this.log('⚠️  Tool list has changed since last check');
        // Note: We detected a change but can't notify via HTTP
        // HTTP-based MCP doesn't support push notifications
      }
      this.lastKnownToolsList = currentToolsList;

      return { tools };
    } catch (error) {
      this.error('Error getting tools list:', error);
      // Return at least the test tool
      return {
        tools: [
          {
            name: 'hello_homey',
            description: 'A simple test tool that says hello from Homey',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Your name (optional)',
                },
              },
            },
          },
        ],
      };
    }
  }

  private async callTool(params: any) {
    this.log('Handling tools/call request:', params.name);

    const { name, arguments: args } = params;

    // Handle test tool
    if (name === 'hello_homey') {
      const userName = (args as any)?.name || 'there';
      const message = `Hello ${userName}! 👋 This message is coming from your Homey Pro!`;

      this.log(`Executed hello_homey tool with message: ${message}`);

      return {
        content: [
          {
            type: 'text',
            text: message,
          },
        ],
      };
    }

    // Handle refresh flows tool
    if (name === 'refresh_homey_flows') {
      this.log('🔄 Manual flow refresh requested by Claude');

      try {
        // Force re-discovery of flows
        const flowTools = await this.flowManager.getToolsFromFlows();
        const newToolsList = JSON.stringify(flowTools);

        // Update cached list
        const oldToolsList = this.lastKnownToolsList;
        this.lastKnownToolsList = newToolsList;

        // Check if anything changed
        const changed = oldToolsList !== newToolsList;
        const toolCount = flowTools.length;

        let message = `✅ Flow refresh complete!\n\n`;
        message += `Found ${toolCount} flow(s) with MCP triggers.\n\n`;

        if (changed) {
          message += `🔄 Changes detected! New flows are available.\n\n`;
          message += `✅ WORKAROUND: You can trigger these flows RIGHT NOW using the 'trigger_any_flow' tool!\n`;
          message += `Just use trigger_any_flow with the command name and parameters shown below.\n\n`;
          message += `Note: To see them as dedicated tools in future chats, start a new chat session.`;
        } else {
          message += `ℹ️ No changes detected. Tool list is up to date.`;
        }

        if (toolCount > 0) {
          message += `\n\nFlows found on server:\n`;
          flowTools.forEach((tool, index) => {
            message += `\n${index + 1}. ${tool.name}\n`;
            message += `   Description: ${tool.description}\n`;

            // Show parameter details if available
            const schema = tool.inputSchema as any;
            if (schema?.properties && Object.keys(schema.properties).length > 0) {
              message += `   Parameters:\n`;
              Object.entries(schema.properties).forEach(([paramName, paramDef]: [string, any]) => {
                const isRequired = schema.required?.includes(paramName);
                const requiredMarker = isRequired ? '(required)' : '(optional)';
                message += `     - ${paramName}: ${paramDef.type} ${requiredMarker}`;
                if (paramDef.description) {
                  message += ` - ${paramDef.description}`;
                }
                if (paramDef.enum) {
                  message += ` [${paramDef.enum.join('|')}]`;
                }
                if (paramDef.minimum !== undefined || paramDef.maximum !== undefined) {
                  message += ` [${paramDef.minimum || '?'}-${paramDef.maximum || '?'}]`;
                }
                message += `\n`;
              });
            }
          });
        }

        this.log(`✅ Flow refresh complete: ${toolCount} flows, changed: ${changed}`);

        return {
          content: [
            {
              type: 'text',
              text: message,
            },
          ],
        };
      } catch (error: any) {
        this.error('Error refreshing flows:', error);
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error refreshing flows: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    // Handle trigger_any_flow tool
    if (name === 'trigger_any_flow') {
      this.log('🎯 Generic flow trigger requested');
      const commandName = (args as any)?.command;
      const parameters = (args as any)?.parameters || {};

      if (!commandName) {
        return {
          content: [
            {
              type: 'text',
              text: '❌ Error: command name is required',
            },
          ],
          isError: true,
        };
      }

      this.log(`   Command: ${commandName}`);
      this.log(`   Parameters: ${JSON.stringify(parameters)}`);

      try {
        const result = await this.flowManager.triggerCommand(commandName, parameters);

        if (result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `✅ Successfully triggered flow: ${commandName}\n${result.message || ''}`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Failed to trigger flow: ${commandName}\n${result.message || 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }
      } catch (error: any) {
        this.error('Error triggering flow:', error);
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error triggering flow '${commandName}': ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    // Handle Zone & Device Tools (Read-Only)

    // EFFICIENT SNAPSHOT TOOLS
    if (name === 'get_home_structure') {
      this.log('🏠 Getting complete home structure (static data)');
      try {
        const structure = await this.zoneDeviceManager.getHomeStructure();

        // Build XML structure for better AI parsing
        const buildZoneXML = (zones: typeof structure.zones, parentId: string | null): string => {
          let xml = '';
          const children = zones.filter(z => z.parent === parentId);

          children.forEach(zone => {
            // Only include icon if it's not default
            const iconAttr = zone.icon && zone.icon !== 'default' ? ` icon="${zone.icon}"` : '';
            xml += `  <zone id="${zone.id}" name="${zone.name}"${iconAttr}>\n`;

            // Add devices in this zone
            const devicesInZone = structure.devices.filter(d => d.zone === zone.id);
            devicesInZone.forEach(device => {
              // Extract app ID from driverId (format: homey:app:com.athom.hue:driver or com.athom.hue:driver)
              let appId = 'unknown';
              if (device.driverUri && device.driverUri !== 'unknown') {
                const parts = device.driverUri.split(':');
                if (parts.length >= 2) {
                  // Check if format is homey:app:com.athom.hue:driver
                  if (parts[0] === 'homey' && parts[1] === 'app' && parts.length >= 3) {
                    appId = parts[2]; // e.g., 'com.athom.hue'
                  }
                  // Or format is com.athom.hue:driver
                  else if (parts.length >= 1) {
                    appId = parts[0]; // e.g., 'com.athom.hue'
                  }
                }
              }

              // Use device class as tag name (e.g., <light>, <sensor>, <socket>)
              const deviceTag = device.class || 'device';

              // Capabilities as comma-separated list
              const capsList = device.capabilities.join(',');

              // Only include status/ready if they are NOT the default (available/ready)
              let statusAttr = '';
              if (!device.available) {
                statusAttr += ` status="unavailable"`;
              }
              if (!device.ready) {
                statusAttr += ` ready="not-ready"`;
              }

              xml += `    <${deviceTag} id="${device.id}" name="${device.name}" app="${appId}"${statusAttr} capabilities="${capsList}" />\n`;
            });

            // Recurse for child zones
            const childXML = buildZoneXML(zones, zone.id);
            if (childXML) {
              xml += childXML;
            }

            xml += `  </zone>\n`;
          });

          return xml;
        };

        let message = `Here is your complete home structure in XML format for easy parsing:\n\n`;
        message += `SUMMARY: ${structure.zones.length} zones, ${structure.devices.length} devices\n\n`;
        message += `<home>\n`;
        message += buildZoneXML(structure.zones, null);
        message += `</home>\n\n`;
        message += `INSTRUCTIONS:\n`;
        message += `- This is STATIC data - keep it in your context for the entire conversation\n`;
        message += `- Use device "id" attribute to control devices\n`;
        message += `- Use zone "id" attribute for zone-based operations\n`;
        message += `- Device tag name indicates type: <light>, <socket>, <sensor>, <thermostat>, etc.\n`;
        message += `- "app" attribute shows which Homey app controls this device (e.g., com.athom.hue = Philips Hue)\n`;
        message += `- "capabilities" attribute is comma-separated list of what you can read/control\n`;
        message += `- DEFAULT VALUES (omitted when default): status="available", ready="ready", icon="default"\n`;
        message += `- If status/ready/icon attributes are MISSING, assume the defaults above\n`;
        message += `- Only non-default values are shown (e.g., status="unavailable" means device is offline)\n`;
        message += `- For current values (on/off, temperature, etc.), use get_states tool\n`;

        return {
          content: [
            {
              type: 'text',
              text: message,
            },
          ],
        };
      } catch (error: any) {
        this.error('Error getting home structure:', error);
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error getting home structure: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    if (name === 'get_states') {
      const zoneId = (args as any)?.zoneId;
      const deviceIds = (args as any)?.deviceIds;
      const capability = (args as any)?.capability;

      this.log(`📊 Getting states (zone: ${zoneId || 'all'}, devices: ${deviceIds?.length || 'all'}, capability: ${capability || 'all'})`);

      try {
        const filters: any = {};
        if (zoneId) filters.zoneId = zoneId;
        if (deviceIds) filters.deviceIds = deviceIds;
        if (capability) filters.capability = capability;

        const states = await this.zoneDeviceManager.getStates(filters);

        // Build XML format for better AI parsing
        let message = `Current device states in XML format for easy parsing:\n\n`;

        const filterSummary = [];
        if (zoneId) filterSummary.push(`zone="${zoneId}"`);
        if (capability) filterSummary.push(`capability="${capability}"`);
        if (deviceIds) filterSummary.push(`deviceCount="${deviceIds.length}"`);

        message += `<states${filterSummary.length > 0 ? ' ' + filterSummary.join(' ') : ''}>\n`;

        if (states.devices.length === 0) {
          message += `  <!-- No devices found matching the filters -->\n`;
        } else {
          states.devices.forEach(device => {
            // Use device class as tag name (e.g., <light>, <sensor>, <socket>)
            const deviceTag = device.class || 'device';

            message += `  <${deviceTag} id="${device.id}" name="${device.name}" zone="${device.zone}">\n`;

            const capEntries = Object.entries(device.capabilities);
            if (capEntries.length > 0) {
              capEntries.forEach(([cap, value]) => {
                const valueType = typeof value;
                let valueStr = String(value);

                // Add semantic attributes for booleans
                if (typeof value === 'boolean') {
                  message += `    <capability name="${cap}" type="${valueType}" value="${value}" state="${value ? 'on' : 'off'}" />\n`;
                } else {
                  message += `    <capability name="${cap}" type="${valueType}" value="${valueStr}" />\n`;
                }
              });
            } else {
              message += `    <!-- No readable capabilities -->\n`;
            }

            message += `  </${deviceTag}>\n`;
          });
        }

        // Show active zones
        if (states.activeZones && states.activeZones.length > 0) {
          message += `\n  <active-zones count="${states.activeZones.length}">\n`;
          states.activeZones.forEach(zone => {
            const origins = zone.activeOrigins.length > 0 ? ` origins="${zone.activeOrigins.join(', ')}"` : '';
            message += `    <zone id="${zone.id}" name="${zone.name}"${origins} />\n`;
          });
          message += `  </active-zones>\n`;
        }

        message += `</states>\n\n`;
        message += `INSTRUCTIONS:\n`;
        message += `- Device tag name indicates type: <light>, <socket>, <sensor>, etc.\n`;
        message += `- Use device "id" attribute to control devices\n`;
        message += `- Boolean capabilities have "state" attribute (on/off) for easy checking\n`;
        message += `- "value" contains the raw value, "type" shows the data type\n`;
        message += `- Active zones show which rooms currently have motion/presence detected\n`;
        message += `- Use get_home_structure to look up zone name from zone ID\n`;

        return {
          content: [
            {
              type: 'text',
              text: message,
            },
          ],
        };
      } catch (error: any) {
        this.error('Error getting states:', error);
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error getting states: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    if (name === 'get_zone_details') {
      const zoneId = (args as any)?.zoneId;

      if (zoneId) {
        // Specific zone requested
        this.log(`📍 Getting zone details for: ${zoneId}`);

        try {
          const zone = await this.zoneDeviceManager.getZone(zoneId);

          if (!zone) {
            return {
              content: [
                {
                  type: 'text',
                  text: `❌ Zone with ID '${zoneId}' not found`,
                },
              ],
              isError: true,
            };
          }

          const devices = await this.zoneDeviceManager.getDevicesInZone(zoneId);

          // Build XML format
          let message = `Zone details in XML format:\n\n`;

          const activeStatus = zone.active ? 'true' : 'false';
          const origins = zone.activeOrigins.length > 0 ? ` active-origins="${zone.activeOrigins.join(', ')}"` : '';
          const lastUpdated = zone.activeLastUpdated ? ` last-updated="${zone.activeLastUpdated}"` : '';

          message += `<zone id="${zone.id}" name="${zone.name}" icon="${zone.icon}" active="${activeStatus}"${origins}${lastUpdated}>\n`;
          message += `  <device-count>${devices.length}</device-count>\n`;

          if (devices.length > 0) {
            message += `  <devices>\n`;
            devices.forEach(device => {
              message += `    <device id="${device.id}" name="${device.name}" class="${device.class}" />\n`;
            });
            message += `  </devices>\n`;
          }

          message += `</zone>\n\n`;
          message += `INSTRUCTIONS:\n`;
          message += `- "active" shows if zone has current motion/presence activity\n`;
          message += `- "active-origins" lists which sensors detected activity\n`;
          message += `- "last-updated" shows when activity was last detected\n`;
          message += `- Use get_home_structure for full device details\n`;

          return {
            content: [
              {
                type: 'text',
                text: message,
              },
            ],
          };
        } catch (error: any) {
          this.error('Error getting zone details:', error);
          return {
            content: [
              {
                type: 'text',
                text: `❌ Error getting zone details: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
      } else {
        // No zoneId - return all active zones
        this.log('🔴 Getting all active zones');

        try {
          const activeZones = await this.zoneDeviceManager.getActiveZones();

          let message = `Active zones in XML format:\n\n`;
          message += `<active-zones count="${activeZones.length}">\n`;

          if (activeZones.length === 0) {
            message += `  <!-- No zones currently have activity -->\n`;
          } else {
            activeZones.forEach(zone => {
              const origins = zone.activeOrigins.length > 0 ? ` active-origins="${zone.activeOrigins.join(', ')}"` : '';
              const lastUpdated = zone.activeLastUpdated ? ` last-updated="${zone.activeLastUpdated}"` : '';
              message += `  <zone id="${zone.id}" name="${zone.name}" icon="${zone.icon}"${origins}${lastUpdated} />\n`;
            });
          }

          message += `</active-zones>\n\n`;
          message += `INSTRUCTIONS:\n`;
          message += `- These zones currently have motion/presence detected\n`;
          message += `- "active-origins" shows which sensors triggered\n`;
          message += `- For specific zone details, call this tool with zoneId parameter\n`;
          message += `- For simpler active zone list, use get_states (includes active-zones)\n`;

          return {
            content: [
              {
                type: 'text',
                text: message,
              },
            ],
          };
        } catch (error: any) {
          this.error('Error getting active zones:', error);
          return {
            content: [
              {
                type: 'text',
                text: `❌ Error getting active zones: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
      }
    }

    if (name === 'get_device_info') {
      const deviceId = (args as any)?.deviceId;
      this.log(`🔌 Getting device info for: ${deviceId}`);

      if (!deviceId) {
        return {
          content: [
            {
              type: 'text',
              text: '❌ Error: deviceId is required',
            },
          ],
          isError: true,
        };
      }

      try {
        const device = await this.zoneDeviceManager.getDevice(deviceId);

        if (!device) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Device with ID '${deviceId}' not found`,
              },
            ],
            isError: true,
          };
        }

        // Build XML format for better AI parsing
        let message = `Device information in XML format for easy parsing:\n\n`;

        const availStatus = device.available ? 'available' : 'unavailable';
        const readyStatus = device.ready ? 'ready' : 'not-ready';

        // Extract app ID from driverId (format: homey:app:com.athom.hue:driver or com.athom.hue:driver)
        let appId = 'unknown';
        if (device.driverUri && device.driverUri !== 'unknown') {
          const parts = device.driverUri.split(':');
          if (parts.length >= 2) {
            // Check if format is homey:app:com.athom.hue:driver
            if (parts[0] === 'homey' && parts[1] === 'app' && parts.length >= 3) {
              appId = parts[2]; // e.g., 'com.athom.hue'
            }
            // Or format is com.athom.hue:driver
            else if (parts.length >= 1) {
              appId = parts[0]; // e.g., 'com.athom.hue'
            }
          }
        }

        // Use device class as tag name (e.g., <light>, <sensor>, <socket>)
        const deviceTag = device.class || 'device';

        // Only include status/ready if they are NOT the default
        let statusAttr = '';
        if (availStatus !== 'available') {
          statusAttr += ` status="${availStatus}"`;
        }
        if (readyStatus !== 'ready') {
          statusAttr += ` ready="${readyStatus}"`;
        }

        message += `<${deviceTag} id="${device.id}" name="${device.name}" zone="${device.zone}" app="${appId}"${statusAttr}>\n`;

        // Add all capabilities with current values
        if (device.capabilities && device.capabilities.length > 0) {
          device.capabilities.forEach(capName => {
            const capObj = device.capabilitiesObj[capName];
            if (capObj) {
              const value = capObj.value !== null && capObj.value !== undefined ? capObj.value : 'N/A';
              const valueType = typeof value;
              const units = capObj.units || '';
              const getable = capObj.getable ? 'true' : 'false';
              const setable = capObj.setable ? 'true' : 'false';

              // Add extra attributes for specific types
              let extraAttrs = '';
              if (typeof value === 'boolean') {
                extraAttrs = ` state="${value ? 'on' : 'off'}"`;
              }
              if (typeof value === 'number' && units) {
                extraAttrs = ` units="${units}"`;
              }
              // Check for min/max (may not be defined in type but exist at runtime)
              const capObjAny = capObj as any;
              if (capObjAny.min !== undefined || capObjAny.max !== undefined) {
                extraAttrs += ` min="${capObjAny.min ?? 'N/A'}" max="${capObjAny.max ?? 'N/A'}"`;
              }

              message += `  <capability name="${capName}" type="${valueType}" value="${value}" getable="${getable}" setable="${setable}"${extraAttrs} />\n`;
            } else {
              message += `  <capability name="${capName}" available="false" />\n`;
            }
          });
        }

        message += `</${deviceTag}>\n\n`;
        message += `INSTRUCTIONS:\n`;
        message += `- Device tag name indicates type: <light>, <socket>, <sensor>, etc.\n`;
        message += `- Use "id" attribute to control this device\n`;
        message += `- "app" attribute shows which Homey app controls this device\n`;
        message += `- DEFAULT VALUES (omitted when default): status="available", ready="ready"\n`;
        message += `- If status/ready attributes are MISSING, assume the defaults above\n`;
        message += `- Only non-default values are shown (e.g., status="unavailable" means device is offline)\n`;
        message += `- "setable" attribute shows if you can control this capability\n`;
        message += `- "getable" attribute shows if you can read this capability\n`;
        message += `- Boolean capabilities have "state" attribute (on/off)\n`;
        message += `- Numeric capabilities may have "min" and "max" range\n`;
        message += `- "units" shows measurement units (°C, %, etc.)\n`;
        message += `- Use get_home_structure to look up zone name from zone ID\n`;

        return {
          content: [
            {
              type: 'text',
              text: message,
            },
          ],
        };
      } catch (error: any) {
        this.error('Error getting device info:', error);
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error getting device info: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    if (name === 'get_zone_temperature') {
      const zoneId = (args as any)?.zoneId;
      this.log(`🌡️ Getting zone temperatures for: ${zoneId}`);

      if (!zoneId) {
        return {
          content: [
            {
              type: 'text',
              text: '❌ Error: zoneId is required',
            },
          ],
          isError: true,
        };
      }

      try {
        const result = await this.zoneDeviceManager.getZoneTemperatures(zoneId);

        if (result.readings.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Zone "${result.zoneName}" has no temperature sensors.\n\n<zone-temperatures zone="${result.zoneName}" zone-id="${result.zoneId}" count="0" />`,
              },
            ],
          };
        }

        // Build XML format for better AI parsing
        let message = `Zone temperature readings in XML format for easy parsing:\n\n`;

        message += `<zone-temperatures zone="${result.zoneName}" zone-id="${result.zoneId}" count="${result.readings.length}">\n`;

        // Add individual readings
        result.readings.forEach(reading => {
          message += `  <reading device-id="${reading.deviceId}" device-name="${reading.deviceName}" value="${reading.temperature}" units="${reading.units}" />\n`;
        });

        // Add statistics if multiple sensors
        if (result.readings.length > 1 && result.average !== undefined) {
          message += `  <statistics average="${result.average.toFixed(1)}" min="${result.min?.toFixed(1)}" max="${result.max?.toFixed(1)}" units="°C" />\n`;
        }

        message += `</zone-temperatures>\n\n`;
        message += `INSTRUCTIONS:\n`;
        message += `- "value" contains temperature reading\n`;
        message += `- "units" shows measurement units (usually °C)\n`;
        message += `- Statistics are provided when multiple sensors exist\n`;
        message += `- Use "device-id" to identify specific sensors\n`;

        return {
          content: [
            {
              type: 'text',
              text: message,
            },
          ],
        };
      } catch (error: any) {
        this.error('Error getting zone temperatures:', error);
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error getting zone temperatures: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    // Handle Device Control Tools (Write Operations)
    if (name === 'control_device') {
      const deviceId = (args as any)?.deviceId;
      const capability = (args as any)?.capability;
      let value = (args as any)?.value;
      this.log(`🎛️ Controlling device: ${deviceId} - ${capability} = ${value} (type: ${typeof value})`);

      if (!deviceId || !capability || value === undefined) {
        return {
          content: [
            {
              type: 'text',
              text: '❌ Error: deviceId, capability, and value are all required',
            },
          ],
          isError: true,
        };
      }

      try {
        // Type conversion is now handled in ZoneDeviceManager.setCapabilityValue
        await this.zoneDeviceManager.setCapabilityValue(deviceId, capability, value);

        const device = await this.zoneDeviceManager.getDevice(deviceId);

        let message = `✅ Device Controlled Successfully\n\n`;
        message += `Device: ${device?.name || deviceId}\n`;
        message += `Capability: ${capability}\n`;
        message += `New Value: ${value}\n`;

        return {
          content: [
            {
              type: 'text',
              text: message,
            },
          ],
        };
      } catch (error: any) {
        this.error('Error controlling device:', error);
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error controlling device: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    if (name === 'toggle_device') {
      const deviceId = (args as any)?.deviceId;
      this.log(`🔄 Toggling device: ${deviceId}`);

      if (!deviceId) {
        return {
          content: [
            {
              type: 'text',
              text: '❌ Error: deviceId is required',
            },
          ],
          isError: true,
        };
      }

      try {
        const newState = await this.zoneDeviceManager.toggleDevice(deviceId);
        const device = await this.zoneDeviceManager.getDevice(deviceId);

        let message = `✅ Device Toggled\n\n`;
        message += `Device: ${device?.name || deviceId}\n`;
        message += `New State: ${newState ? 'ON' : 'OFF'}\n`;

        return {
          content: [
            {
              type: 'text',
              text: message,
            },
          ],
        };
      } catch (error: any) {
        this.error('Error toggling device:', error);
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error toggling device: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    if (name === 'set_light') {
      const deviceId = (args as any)?.deviceId;
      const state = (args as any)?.state;
      const dim = (args as any)?.dim;
      this.log(`💡 Setting light: ${deviceId} - ${state} ${dim ? `(dim: ${dim}%)` : ''}`);

      if (!deviceId || !state) {
        return {
          content: [
            {
              type: 'text',
              text: '❌ Error: deviceId and state are required',
            },
          ],
          isError: true,
        };
      }

      try {
        const device = await this.zoneDeviceManager.getDevice(deviceId);

        if (!device) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Device not found`,
              },
            ],
            isError: true,
          };
        }

        if (device.class !== 'light') {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Device ${device.name} is not a light (class: ${device.class})`,
              },
            ],
            isError: true,
          };
        }

        // Handle toggle
        if (state === 'toggle') {
          await this.zoneDeviceManager.toggleDevice(deviceId);
        } else {
          // Set on/off
          const onValue = state === 'on';
          await this.zoneDeviceManager.setCapabilityValue(deviceId, 'onoff', onValue);

          // Set dim level if provided and turning on
          if (dim !== undefined && onValue && device.capabilities.includes('dim')) {
            const dimValue = dim / 100; // Convert 0-100 to 0-1
            await this.zoneDeviceManager.setCapabilityValue(deviceId, 'dim', dimValue);
          }
        }

        let message = `💡 Light Controlled\n\n`;
        message += `Device: ${device.name}\n`;
        message += `State: ${state.toUpperCase()}\n`;
        if (dim !== undefined) {
          message += `Dim Level: ${dim}%\n`;
        }

        return {
          content: [
            {
              type: 'text',
              text: message,
            },
          ],
        };
      } catch (error: any) {
        this.error('Error setting light:', error);
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error setting light: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    if (name === 'set_thermostat') {
      const deviceId = (args as any)?.deviceId;
      const temperature = (args as any)?.temperature;
      this.log(`🌡️ Setting thermostat: ${deviceId} - ${temperature}°C`);

      if (!deviceId || temperature === undefined) {
        return {
          content: [
            {
              type: 'text',
              text: '❌ Error: deviceId and temperature are required',
            },
          ],
          isError: true,
        };
      }

      try {
        const device = await this.zoneDeviceManager.getDevice(deviceId);

        if (!device) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Device not found`,
              },
            ],
            isError: true,
          };
        }

        // Check if device has target_temperature capability
        if (!device.capabilities.includes('target_temperature')) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Device ${device.name} does not have temperature control capability`,
              },
            ],
            isError: true,
          };
        }

        await this.zoneDeviceManager.setCapabilityValue(deviceId, 'target_temperature', temperature);

        let message = `🌡️ Thermostat Set\n\n`;
        message += `Device: ${device.name}\n`;
        message += `Target Temperature: ${temperature}°C\n`;

        return {
          content: [
            {
              type: 'text',
              text: message,
            },
          ],
        };
      } catch (error: any) {
        this.error('Error setting thermostat:', error);
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error setting thermostat: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    if (name === 'control_zone_lights') {
      const zoneId = (args as any)?.zoneId;
      const action = (args as any)?.action;
      const dim = (args as any)?.dim;
      this.log(`🔦 Controlling zone lights: ${zoneId} - ${action} ${dim ? `(dim: ${dim}%)` : ''}`);

      if (!zoneId || !action) {
        return {
          content: [
            {
              type: 'text',
              text: '❌ Error: zoneId and action are required',
            },
          ],
          isError: true,
        };
      }

      try {
        const result = await this.zoneDeviceManager.setZoneLights(zoneId, action, dim);
        const zone = await this.zoneDeviceManager.getZone(zoneId);

        let message = `🔦 Zone Lights Controlled\n\n`;
        message += `Zone: ${zone?.name || zoneId}\n`;
        message += `Action: ${action.toUpperCase()}\n`;
        if (dim !== undefined) {
          message += `Dim Level: ${dim}%\n`;
        }
        message += `\n✅ Success: ${result.success} lights\n`;
        if (result.failed > 0) {
          message += `❌ Failed: ${result.failed} lights\n`;
        }
        message += `\nAffected Lights:\n`;
        result.devices.forEach(name => {
          message += `  - ${name}\n`;
        });

        return {
          content: [
            {
              type: 'text',
              text: message,
            },
          ],
        };
      } catch (error: any) {
        this.error('Error controlling zone lights:', error);
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error controlling zone lights: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    if (name === 'control_zone_capability') {
      const zoneId = (args as any)?.zoneId;
      const capability = (args as any)?.capability;
      const value = (args as any)?.value;
      this.log(`🎯 Controlling zone capability: ${zoneId} - ${capability} = ${value}`);

      if (!zoneId || !capability || value === undefined) {
        return {
          content: [
            {
              type: 'text',
              text: '❌ Error: zoneId, capability, and value are all required',
            },
          ],
          isError: true,
        };
      }

      try {
        const result = await this.zoneDeviceManager.setZoneDeviceCapability(zoneId, capability, value);
        const zone = await this.zoneDeviceManager.getZone(zoneId);

        let message = `🎯 Zone Devices Controlled\n\n`;
        message += `Zone: ${zone?.name || zoneId}\n`;
        message += `Capability: ${capability}\n`;
        message += `Value: ${value}\n`;
        message += `\n✅ Success: ${result.success} devices\n`;
        if (result.failed > 0) {
          message += `❌ Failed: ${result.failed} devices\n`;
        }
        message += `\nAffected Devices:\n`;
        result.devices.forEach(name => {
          message += `  - ${name}\n`;
        });

        return {
          content: [
            {
              type: 'text',
              text: message,
            },
          ],
        };
      } catch (error: any) {
        this.error('Error controlling zone capability:', error);
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error controlling zone capability: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    // Handle flow execution via trigger card
    try {
      const result = await this.flowManager.triggerCommand(name, args);

      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text: result.message || `Flow '${name}' executed successfully`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${result.error || 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    } catch (error: any) {
      this.error(`Error calling tool ${name}:`, error);
      return {
        content: [
          {
            type: 'text',
            text: `Error executing flow: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * onUninit is called when the app is destroyed.
   */
  async onUninit() {
    this.log('HomeyMCP Server is shutting down...');

    if (this.httpServer) {
      this.httpServer.close();
      this.log('HTTP server closed');
    }
  }

}
