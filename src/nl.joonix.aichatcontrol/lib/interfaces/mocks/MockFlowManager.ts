/**
 * MockFlowManager - Mock implementation for testing
 */

import { IFlowManager } from '../IFlowManager';
import { HomeyFlow, MCPTool, FlowExecutionResult } from '../../types';

export class MockFlowManager implements IFlowManager {
  private mockFlows: HomeyFlow[] = [];
  private registeredCommands: Set<string> = new Set();
  private triggeredCommands: Array<{ name: string; parameters?: Record<string, any> }> = [];

  async init(): Promise<void> {
    // Mock initialization
  }

  async getMCPFlows(): Promise<HomeyFlow[]> {
    return this.mockFlows.filter(f => f.name.toLowerCase().startsWith('mcp_'));
  }

  async discoverMCPFlows(): Promise<
    Array<{
      flowId: string;
      flowName: string;
      command: string;
      description?: string;
      parameters?: string;
    }>
  > {
    return this.mockFlows
      .filter(f => f.name.toLowerCase().startsWith('mcp_'))
      .map(f => ({
        flowId: f.id,
        flowName: f.name,
        command: this.flowToToolName(f.name),
        description: `Mock flow: ${f.name}`,
      }));
  }

  async getToolsFromFlows(): Promise<MCPTool[]> {
    const flows = await this.discoverMCPFlows();
    return flows.map(f => ({
      name: f.command,
      description: f.description || `Trigger flow "${f.flowName}"`,
      inputSchema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    }));
  }

  async getToolsFromCommands(): Promise<MCPTool[]> {
    return Array.from(this.registeredCommands).map(cmd => ({
      name: cmd,
      description: `Trigger the '${cmd}' command`,
      inputSchema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    }));
  }

  async triggerCommand(
    toolName: string,
    parameters?: Record<string, any>
  ): Promise<FlowExecutionResult> {
    this.triggeredCommands.push({ name: toolName, parameters });
    this.registerCommand(toolName);

    return {
      success: true,
      message: `Mock: Command '${toolName}' triggered successfully`,
    };
  }

  registerCommand(command: string): void {
    this.registeredCommands.add(command);
  }

  getRegisteredCommands(): Array<{ name: string; description?: string }> {
    return Array.from(this.registeredCommands).map(cmd => ({ name: cmd }));
  }

  flowToToolName(flowName: string): string {
    return flowName.toLowerCase().replace(/^mcp_/, '');
  }

  toolNameToFlow(toolName: string): string {
    return `mcp_${toolName}`;
  }

  async getFlowByToolName(toolName: string): Promise<HomeyFlow | null> {
    const flowName = this.toolNameToFlow(toolName);
    return this.mockFlows.find(f => f.name.toLowerCase() === flowName.toLowerCase()) || null;
  }

  // Test helpers
  addMockFlow(flow: HomeyFlow): void {
    this.mockFlows.push(flow);
  }

  getTriggeredCommands(): Array<{ name: string; parameters?: Record<string, any> }> {
    return this.triggeredCommands;
  }

  reset(): void {
    this.mockFlows = [];
    this.registeredCommands.clear();
    this.triggeredCommands = [];
  }
}
