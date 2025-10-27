/**
 * MCP Server Manager - Handles MCP protocol requests
 */

import { ToolRegistry } from '../tools/tool-registry';
import { FlowManager } from './flow-manager';
import { MCP_SERVER_CONFIG, JSONRPC_ERROR_CODES } from '../constants';

export interface MCPRequest {
  jsonrpc: string;
  method: string;
  id: string | number;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: string;
  id: string | number;
  result?: any;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

/**
 * Manages MCP protocol requests and responses
 * Separates MCP protocol handling from HTTP transport
 */
export class MCPServerManager {
  constructor(
    private toolRegistry: ToolRegistry,
    private homey: any,
    private flowManager?: FlowManager
  ) {}

  /**
   * Handle an incoming MCP request
   */
  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    const { method, id, params } = request;

    this.homey.log('Received MCP request:', JSON.stringify(request));

    try {
      switch (method) {
        case 'initialize':
          return this.handleInitialize(id);

        case 'tools/list':
          return await this.handleToolsList(id);

        case 'tools/call':
          return await this.handleToolCall(id, params);

        case 'ping':
          return this.handlePing(id);

        case 'prompts/list':
          return this.handlePromptsList(id);

        case 'resources/list':
          return this.handleResourcesList(id);

        case 'notifications/initialized':
          return this.handleNotificationInitialized(id);

        default:
          return this.createError(id, JSONRPC_ERROR_CODES.METHOD_NOT_FOUND, `Method not found: ${method}`);
      }
    } catch (error: any) {
      this.homey.error('MCP request error:', error);
      return this.createError(id, JSONRPC_ERROR_CODES.INTERNAL_ERROR, 'Internal error: ' + error.message);
    }
  }

  /**
   * Handle initialize request
   */
  private handleInitialize(id: string | number): MCPResponse {
    return this.createSuccess(id, {
      protocolVersion: MCP_SERVER_CONFIG.PROTOCOL_VERSION,
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: MCP_SERVER_CONFIG.SERVER_NAME,
        version: MCP_SERVER_CONFIG.SERVER_VERSION,
      },
    });
  }

  /**
   * Handle tools/list request
   */
  private async handleToolsList(id: string | number): Promise<MCPResponse> {
    const registryTools = this.toolRegistry.getAllDefinitions();

    // Also get flow-based tools if FlowManager is available
    let flowTools: any[] = [];
    if (this.flowManager) {
      flowTools = await this.flowManager.getToolsFromFlows();
    }

    const tools = [...registryTools, ...flowTools];
    return this.createSuccess(id, { tools });
  }

  /**
   * Handle tools/call request
   */
  private async handleToolCall(id: string | number, params: any): Promise<MCPResponse> {
    if (!params || !params.name) {
      return this.createError(id, JSONRPC_ERROR_CODES.INVALID_PARAMS, 'Invalid params: missing tool name');
    }

    const { name, arguments: args } = params;

    // Try tool registry first
    if (this.toolRegistry.has(name)) {
      const result = await this.toolRegistry.execute(name, args);
      return this.createSuccess(id, result);
    }

    // Fallback to flow-based tools
    if (this.flowManager) {
      this.homey.log(`   → Tool not in registry, checking flow-based tools: ${name}`);

      const flowTools = await this.flowManager.getToolsFromFlows();
      const flowTool = flowTools.find(t => t.name === name);

      if (flowTool) {
        this.homey.log(`   ✓ Found as flow-based tool: ${name}`);
        this.homey.log(`   → Delegating to trigger_any_flow tool`);

        // Delegate to trigger_any_flow - this avoids code duplication
        const result = await this.toolRegistry.execute('trigger_any_flow', {
          command: name,
          parameters: args || {},
        });
        return this.createSuccess(id, result);
      }
    }

    // Tool not found
    return this.createError(
      id,
      JSONRPC_ERROR_CODES.INVALID_PARAMS,
      `Tool '${name}' not found. Use refresh_homey_flows to update the tool list.`
    );
  }

  /**
   * Handle ping request
   */
  private handlePing(id: string | number): MCPResponse {
    return this.createSuccess(id, {});
  }

  /**
   * Handle prompts/list request
   */
  private handlePromptsList(id: string | number): MCPResponse {
    return this.createSuccess(id, { prompts: [] });
  }

  /**
   * Handle resources/list request
   */
  private handleResourcesList(id: string | number): MCPResponse {
    return this.createSuccess(id, { resources: [] });
  }

  /**
   * Handle notifications/initialized
   */
  private handleNotificationInitialized(id: string | number): MCPResponse {
    this.homey.log('📡 MCP Client initialized and connected');
    this.homey.log('   Client is now ready to receive tool updates');

    // Return success but no result (notification acknowledgment)
    return this.createSuccess(id, {});
  }

  /**
   * Create a success response
   */
  private createSuccess(id: string | number, result: any): MCPResponse {
    const response = {
      jsonrpc: '2.0',
      id,
      result,
    };
    this.homey.log('Sending MCP response:', JSON.stringify(response));
    return response;
  }

  /**
   * Create an error response
   */
  private createError(id: string | number, code: number, message: string, data?: any): MCPResponse {
    const response = {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        ...(data && { data }),
      },
    };
    this.homey.log('Sending MCP error response:', JSON.stringify(response));
    return response;
  }
}
