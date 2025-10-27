/**
 * Flow Parser - Parse Homey flows to extract MCP command information
 */

import { MCP_TRIGGER_IDS } from '../constants';

/**
 * MCP Flow Information extracted from a Homey flow
 */
export interface MCPFlowInfo {
  flowId: string;
  flowName: string;
  command: string;
  description?: string; // User-provided description for AI
  parameters?: string; // Parameter definitions
  cardId?: string; // Optional: ID of the specific trigger card (for advanced flows with multiple triggers)
}

// Type for flow objects from Homey API
interface HomeyAPIFlow {
  id?: string;
  name: string;
  enabled?: boolean;
  trigger?: {
    id: string;
    args?: Record<string, unknown>;
  };
  cards?: Record<string, {
    id?: string;
    type: string;
    args?: Record<string, unknown>;
  }> | Array<{
    id?: string;
    type: string;
    args?: Record<string, unknown>;
  }>;
  [key: string]: unknown;
}

/**
 * Parser for extracting MCP command information from Homey flows
 * Handles both simple flows and advanced flows
 */
export class FlowParser {
  private readonly triggerIds = [
    MCP_TRIGGER_IDS.SHORT,
    MCP_TRIGGER_IDS.FULL,
  ];

  /**
   * Parse a Homey flow and extract MCP command info if present
   * @param flow - Flow data from Homey API
   * @returns Array of MCPFlowInfo (can be multiple for advanced flows with multiple MCP triggers)
   */
  parseFlow(flow: HomeyAPIFlow): MCPFlowInfo[] {
    // Skip disabled flows
    if (flow.enabled === false) {
      return [];
    }

    // Try simple flow (can only have one trigger)
    if (flow.trigger) {
      const result = this.parseSimpleFlow(flow);
      return result ? [result] : [];
    }

    // Try advanced flow (can have multiple MCP triggers)
    if (flow.cards) {
      return this.parseAdvancedFlow(flow);
    }

    return [];
  }

  /**
   * Parse a simple flow (has single trigger property)
   */
  private parseSimpleFlow(flow: HomeyAPIFlow): MCPFlowInfo | null {
    if (!flow.trigger || !this.isMCPTrigger(flow.trigger.id)) {
      return null;
    }

    return this.extractFlowInfo(flow, flow.trigger.args);
  }

  /**
   * Parse an advanced flow (has cards array or object)
   * Can return multiple MCPFlowInfo if the flow has multiple MCP trigger cards
   */
  private parseAdvancedFlow(flow: HomeyAPIFlow): MCPFlowInfo[] {
    const results: MCPFlowInfo[] = [];

    if (!flow.cards) {
      return results;
    }

    // For object-style cards, we need to iterate over entries to get card IDs
    if (!Array.isArray(flow.cards)) {
      for (const [cardId, card] of Object.entries(flow.cards)) {
        if (card.type === 'trigger' && card.id && this.isMCPTrigger(card.id)) {
          const flowInfo = this.extractFlowInfo(flow, card.args, cardId);
          if (flowInfo) {
            results.push(flowInfo);
          }
        }
      }
    } else {
      // Array-style cards
      for (const card of flow.cards) {
        if (card.type === 'trigger' && card.id && this.isMCPTrigger(card.id)) {
          const flowInfo = this.extractFlowInfo(flow, card.args);
          if (flowInfo) {
            results.push(flowInfo);
          }
        }
      }
    }

    return results;
  }

  /**
   * Check if a trigger ID matches MCP trigger pattern
   */
  private isMCPTrigger(id: string): boolean {
    if (!id) return false;

    return (
      this.triggerIds.some((pattern: string) => id === pattern) || id.endsWith(MCP_TRIGGER_IDS.SUFFIX)
    );
  }

  /**
   * Extract flow information from trigger args
   */
  private extractFlowInfo(flow: HomeyAPIFlow, args: Record<string, unknown> | undefined, cardId?: string): MCPFlowInfo | null {
    const command = args?.command;

    // Validate command
    if (!command || typeof command !== 'string') {
      return null;
    }

    const flowId = flow.id || 'unknown';

    return {
      flowId,
      flowName: flow.name,
      command,
      description: typeof args?.description === 'string' ? args.description : undefined,
      parameters: typeof args?.parameters === 'string' ? args.parameters : undefined,
      cardId,
    };
  }
}
