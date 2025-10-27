'use strict';

import Homey from 'homey';
import express from 'express';
import { Server } from 'http';
import { FlowManager } from './lib/managers/flow-manager';
import { ZoneDeviceManager } from './lib/managers/zone-device-manager';
import { ToolRegistry } from './lib/tools/tool-registry';
import { MCPServerManager } from './lib/managers/mcp-server-manager';
import { ToolStateManager } from './lib/managers/tool-state-manager';
import { MCP_SERVER_CONFIG, JSONRPC_ERROR_CODES } from './lib/constants';
import { TriggerAnyFlowTool } from './lib/tools/trigger-any-flow-tool';
import { HomeStructureTool } from './lib/tools/home-structure-tool';
import { RefreshFlowsTool } from './lib/tools/refresh-flows-tool';
import { GetStatesTool } from './lib/tools/get-states-tool';
import { ControlDeviceTool } from './lib/tools/control-device-tool';
import { ToggleDeviceTool } from './lib/tools/toggle-device-tool';
import { SetLightTool } from './lib/tools/set-light-tool';
import { SetThermostatTool } from './lib/tools/set-thermostat-tool';
import { ControlZoneLightsTool } from './lib/tools/control-zone-lights-tool';
import { ControlZoneCapabilityTool } from './lib/tools/control-zone-capability-tool';

module.exports = class HomeyMCPApp extends Homey.App {
  private httpServer!: Server;
  private flowManager!: FlowManager;
  private zoneDeviceManager!: ZoneDeviceManager;
  private toolRegistry!: ToolRegistry;
  private mcpServerManager!: MCPServerManager;
  private toolStateManager!: ToolStateManager;

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    try {
      this.log('HomeyMCP Server is starting...');

      // Register flow trigger card
      this.log('Registering flow trigger card...');
      const mcpCommandTrigger = this.homey.flow.getTriggerCard('ai_tool_call');
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

      // Initialize Tool State Manager
      this.log('Initializing Tool State Manager...');
      this.toolStateManager = new ToolStateManager();
      this.log('Tool State Manager initialized');

      // Initialize Tool Registry
      this.log('Initializing Tool Registry...');
      this.toolRegistry = new ToolRegistry();

      // Register all tools
      this.toolRegistry.register(new RefreshFlowsTool(this.homey, this.flowManager, this.toolStateManager));
      this.toolRegistry.register(new TriggerAnyFlowTool(this.homey, this.flowManager));
      this.toolRegistry.register(new HomeStructureTool(this.homey, this.zoneDeviceManager));
      this.toolRegistry.register(new GetStatesTool(this.homey, this.zoneDeviceManager));
      this.toolRegistry.register(new ControlDeviceTool(this.homey, this.zoneDeviceManager));
      this.toolRegistry.register(new ToggleDeviceTool(this.homey, this.zoneDeviceManager));
      this.toolRegistry.register(new SetLightTool(this.homey, this.zoneDeviceManager));
      this.toolRegistry.register(new SetThermostatTool(this.homey, this.zoneDeviceManager));
      this.toolRegistry.register(new ControlZoneLightsTool(this.homey, this.zoneDeviceManager));
      this.toolRegistry.register(new ControlZoneCapabilityTool(this.homey, this.zoneDeviceManager));

      this.log(`Tool Registry initialized with ${this.toolRegistry.count()} tools`);

      // Initialize MCP Server Manager with FlowManager for flow-based tools
      this.log('Initializing MCP Server Manager...');
      this.mcpServerManager = new MCPServerManager(this.toolRegistry, this.homey, this.flowManager);
      this.log('MCP Server Manager initialized');
    } catch (error) {
      this.error('FATAL ERROR in onInit:', error);
      throw error;
    }

    // Create Express app for HTTP endpoints
    const app = express();
    app.use(express.json());

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', message: 'Homey MCP Server is running' });
    });

    // Main MCP endpoint
    app.post('/mcp', async (req, res) => {
      try {
        const response = await this.mcpServerManager.handleRequest(req.body);
        res.json(response);
      } catch (error) {
        this.error('MCP request error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
          jsonrpc: '2.0',
          id: req.body?.id || null,
          error: {
            code: JSONRPC_ERROR_CODES.INTERNAL_ERROR,
            message: 'Internal error: ' + errorMessage,
          },
        });
      }
    });

    // Start HTTP server, bind to all interfaces
    const port = MCP_SERVER_CONFIG.HTTP_PORT;
    const host = MCP_SERVER_CONFIG.HTTP_HOST;
    this.httpServer = app.listen(port, host, () => {
      this.log(`✓ MCP Server listening on ${host}:${port}`);
      this.log(`✓ Access URL: http://<homey-ip>:${port}/mcp`);
      this.log(`✓ Health check: http://<homey-ip>:${port}/health`);
    });

    this.httpServer.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        this.error(`Port ${port} is already in use!`);
      } else {
        this.error('HTTP Server error:', error);
      }
    });

    // Note: No automatic polling needed - Claude can use refresh_homey_flows tool manually
    this.log('Server ready. Use refresh_homey_flows tool to update flow list.');
  }

  async onUninit() {
    this.log('HomeyMCP Server shutting down...');

    // Clean up Zone & Device Manager first to close Homey API connection
    if (this.zoneDeviceManager) {
      try {
        await this.zoneDeviceManager.destroy();
        this.log('Zone & Device Manager cleaned up');
      } catch (error) {
        this.error('Error cleaning up Zone & Device Manager:', error);
      }
    }

    // Close HTTP server
    if (this.httpServer) {
      this.httpServer.close();
      this.log('HTTP server stopped');
    }
  }
};
