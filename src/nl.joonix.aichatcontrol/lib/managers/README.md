# Managers Directory

This directory contains business logic managers.

## Purpose
Managers handle core business operations and coordinate between different parts of the application.

## Managers
- `flow-manager.ts` - Flow discovery and execution
- `zone-device-manager.ts` - Zone and device operations
- `mcp-server-manager.ts` - MCP protocol handling (to be added)

## Responsibilities
- Business logic orchestration
- API communication with Homey
- State management
- Coordination between components

## Usage
```typescript
import { FlowManager } from './managers/flow-manager';

const flowManager = new FlowManager(homey, triggerCard);
await flowManager.init();
const tools = await flowManager.getToolsFromFlows();
```

## Note
Managers should focus on business logic only. Formatting, parsing, and utility operations belong in their respective directories.
