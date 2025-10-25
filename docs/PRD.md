# Product Requirements Document (PRD)
## Homey MCP Server - AI-Controlled Home Automation

**Version:** 1.3 (PRODUCTION UPDATE - Parameters & Bug Fixes)
**Date:** October 24, 2025
**Status:** Production Ready - Active Testing with Parameters
**Project Goal:** Weekend MVP ✅ ACHIEVED

**IMPORTANT UPDATES:**
- Section 2.1: Flow trigger architecture (Session 1)
- Section 2.4: Parameters implementation (Session 2)
- Section 2.5: HTTP-based MCP limitations & workarounds (Session 2)
- Section 10: Production bug fixes (Session 2)

---

## 1. Executive Summary

### Vision
Enable Homey Pro users to control their home automation flows through natural language conversations with AI assistants (Claude, ChatGPT, etc.) via the Model Context Protocol (MCP) over their local network.

### Success Criteria
- ✅ Working HTTP-based MCP server running as Homey app
- ✅ Can trigger flows from Claude Desktop on laptop
- ✅ Cross-device communication (Homey Pro ↔ Laptop)
- ✅ **Parameters support** (with validation and token mapping)
- ✅ **Advanced Flows** support (alongside regular flows)
- ✅ Production-tested with real flows (LED toggle, radio streaming)
- ⏳ Publishable to Homey App Store (documentation pending)
- ✅ Built in one weekend with AI assistance

### Out of Scope for MVP
- ❌ Cloud hosting / remote access over internet
- ❌ Complex parameter validation
- ❌ Flow creation/editing
- ❌ Advanced flow management UI
- ❌ Analytics dashboard
- ❌ Advanced authentication (beyond optional API key)

---

## 2. Implementation Updates & Architectural Changes

### 2.1 Critical Discovery: Flow Trigger Card Architecture

**DISCOVERY DATE:** October 24, 2025

**Original Approach (FAILED):**
- Planned to use `HomeyAPI.flow.triggerFlow()` to execute flows directly
- Would scan for flows with `mcp_*` prefix
- MCP tools would directly trigger flows by ID

**Problem Encountered:**
- `HomeyAPI.flow.triggerFlow()` fails with "Missing Scopes" error
- Homey apps are **intentionally restricted** from triggering arbitrary flows via API
- This is a security feature by Athom to prevent apps from executing unauthorized flows
- The required scopes cannot be obtained by third-party apps

**Revised Architecture (WORKING):**
- **Flow Trigger Cards** instead of direct API triggering
- App provides a trigger card: `mcp_command_received`
- Users add this trigger card to their flows in Homey
- Users specify the command name in the trigger card's autocomplete field
- App scans all flows to find those using the `mcp_command_received` trigger
- Extracts command names from `flow.trigger.args.command.name`
- When MCP tool is called, app triggers the card with `triggerCard.trigger(tokens, state)`
- All flows with matching trigger/command execute

**Benefits of New Approach:**
1. ✅ **Works within Homey's security model** - No scope violations
2. ✅ **Better UX** - Users see triggers in flow editor, more intuitive
3. ✅ **Native Homey approach** - Follows established patterns
4. ✅ **Parameter support ready** - Can pass parameters via tokens
5. ✅ **Autocomplete** - Command discovery built into flow editor
6. ✅ **No naming convention** - Users define command names explicitly (no `mcp_*` prefix needed)

**Implementation Details:**
- Trigger card defined in `.homeycompose/flow/triggers/mcp_command_received.json`
- FlowManager uses HomeyAPI for discovery only (not triggering)
- `discoverMCPFlows()` scans all flows for `trigger.id === 'mcp_command_received'`
- MCP tools dynamically generated from discovered flows
- `triggerCommand()` executes via trigger card, not direct flow API

### 2.2 Claude Desktop HTTP Integration

**Challenge:** Claude Desktop uses stdio MCP transport, but our server requires HTTP for cross-device communication.

**Solution:** `mcp-remote` package as stdio-to-HTTP bridge

**Configuration:**
```json
{
  "mcpServers": {
    "homey": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://10.7.7.124:3000/mcp", "--allow-http"]
    }
  }
}
```

**Key Points:**
- `--allow-http` flag required for non-localhost HTTP endpoints
- `mcp-remote` spawned by Claude Desktop, bridges stdio ↔ HTTP
- Proven working with `hello_homey` test tool
- Network connectivity validated: Laptop (Claude) ↔ Homey Pro

### 2.3 Updated Flow Naming Convention

**Old (from original PRD):**
- Flows must be named with `mcp_*` prefix
- Example: `mcp_radio_toggle`
- Tool name derived by stripping prefix

**New (actual implementation):**
- Users add `mcp_command_received` trigger card to any flow
- Command name specified in trigger card's **text field** (not autocomplete)
- No naming convention required for flow name itself
- Example: Flow named "Toggle Kitchen LED" with command "toggle_led_light_kitchen"
- More flexible, allows existing flows to be exposed

### 2.4 Parameters Implementation (Session 2)

**IMPLEMENTED** - Full parameter support with token mapping

**Syntax Design:**
```
paramName: type(validation)? - description
```

**Examples:**
- `streamUrl: string - Radio stream URL` (required)
- `volume: number(0-100)? - Volume level` (optional, range 0-100)
- `mode: string(on|off|auto) - Device mode` (required, enum values)

**Features:**
- Required by default, `?` suffix for optional parameters
- Type support: `string`, `number`, `boolean`
- Validation:
  - Numbers: range validation `(0-100)`, `(0.0-1.0)`
  - Strings: enum validation `(on|off)`, `(low|medium|high)`
- Maximum 5 parameters per flow

**Token Architecture:**
- Homey limitation: Tokens must be **statically defined in manifest**
- Dynamic tokens don't appear in Homey's token selector UI
- Solution: Pre-defined tokens `value1` through `value5`
- Parameters mapped by **order** from flow description
- Example mapping:
  ```
  streamUrl: string - URL    →  [[value1]]
  streamName: string - Name  →  [[value2]]
  ```

**Implementation Details:**
- Parameters defined in trigger card's "Parameters" text field
- Parser uses regex: `/^\s*(\w+):\s*(string|number|boolean)(?:\(([^)]+)\))?(\?)?\s*-\s*(.+)$/gim`
- JSON Schema generated for MCP tool definition
- Parameter order cached in `Map<string, string[]>` for consistent mapping
- All 5 tokens always provided (empty strings for unused)

**Documentation:**
- [parameters-guide.md](./parameters-guide.md) - User guide
- [parameters-implementation.md](./parameters-implementation.md) - Technical details

### 2.5 HTTP-based MCP Limitations & Workarounds (Session 2)

**Discovery:** HTTP transport is request-response only, cannot push notifications to clients

**Problem:**
- Flow changes not automatically visible to Claude
- Original polling approach (every 30 seconds) was wasteful
- Claude only sees tool list at chat start (or manual refresh)

**Solution - Manual Refresh with Immediate Execution:**

**Tool 1: `refresh_homey_flows`**
- Manually refresh the flow list on demand
- Returns detailed information:
  - Flow names and commands
  - Parameter details (name, type, required, validation)
  - Token mapping (which parameter → which token)
- Informs Claude about `trigger_any_flow` workaround

**Tool 2: `trigger_any_flow`**
- Generic fallback tool, always available
- Can trigger ANY command by name, even if not in current tool list
- Parameters:
  - `command` (string, required): Command name
  - `parameters` (object, optional): Key-value pairs
- Enables immediate execution of newly created flows

**Workflow:**
1. User creates new flow with MCP trigger
2. Claude calls `refresh_homey_flows`
3. Response shows new flow exists with parameters
4. Claude uses `trigger_any_flow` to execute immediately
5. Alternative: User starts new chat to see dedicated tool

**Benefits:**
- ✅ No resource waste (no polling)
- ✅ Immediate execution possible without new chat
- ✅ Clear user feedback
- ✅ Explicit control over refresh timing

---

## 3. User Stories

### Primary User Story
**As a** Homey Pro user  
**I want to** control my Homey flows using natural language with Claude on my laptop  
**So that** I can trigger home automation without opening the Homey app

### MVP User Stories

**US-1: Basic Flow Triggering**  
```
As a user
I want Claude (on my laptop) to turn my radio on/off (via Homey Pro)
So that I can control my radio from my desk

Acceptance Criteria:
- Flow named "mcp_radio_toggle" exists in Homey
- Claude can discover the tool "radio_toggle" over network
- Claude can execute the tool successfully via HTTP
- Flow executes on Homey Pro
- Works across devices on local network
```

**US-2: Flow with Parameters** ✅ **IMPLEMENTED**
```
As a user
I want Claude to tune my radio to a specific station
So that I can say "Play NPO 3FM" and it works

Acceptance Criteria:
✅ Flow uses MCP trigger with command "start_radio"
✅ Parameters defined: streamUrl (string), streamName (string)
✅ Claude can find radio station URLs (via search or user-provided)
✅ Claude passes URL and name to the flow over HTTP
✅ Parameters mapped to tokens: streamUrl → [[value1]], streamName → [[value2]]
✅ Radio tunes to requested station

Tested with: NPO 3FM (https://icecast.omroep.nl/3fm-bb-mp3)
```

**US-3: Flow Discovery**  
```
As a user
I want Claude to know which flows are available
So that Claude can help me understand what I can control

Acceptance Criteria:
- Only flows prefixed with "mcp_" are exposed
- Each flow appears as an MCP tool
- Tool descriptions come from flow names/descriptions
- Discovery works over HTTP from any device on network
```

**US-4: Network Configuration**
```
As a user
I want to easily connect Claude to my Homey Pro
So that I don't need to be a network expert

Acceptance Criteria:
- Homey app shows MCP server URL in settings
- Copy-paste URL into Claude Desktop config
- Clear instructions provided
- Works on local network without port forwarding
```

---

## 3. Functional Requirements

### 3.1 Core Features (Must Have)

#### F-1: HTTP-Based MCP Server Implementation
**Description:** Run an HTTP server on Homey Pro that exposes flows as MCP tools

**Requirements:**
- HTTP server runs on Homey Pro (not external hosting)
- Implements **Streamable HTTP** transport (modern MCP standard)
- Single `/mcp` endpoint for all MCP communication
- Listens on configurable port (default: 3000)
- Accessible over local network
- Responds to HTTP POST requests with JSON-RPC messages
- Optional SSE streaming support for advanced features

**Technical Notes:**
- Use Express.js for HTTP server
- Use `@modelcontextprotocol/sdk` (TypeScript) with Streamable HTTP transport
- Server lifecycle managed by Homey app
- Binds to `0.0.0.0` to accept connections from network

**Network Details:**
```
Homey Pro IP: 192.168.1.100 (example)
MCP Server URL: http://192.168.1.100:3000/mcp
Accessible from: Any device on local network (192.168.1.x)
```

#### F-2: Flow Discovery & Filtering
**Description:** Automatically discover flows and expose eligible ones as MCP tools over HTTP

**Requirements:**
- Scan all Homey flows on app initialization
- Filter flows based on naming convention: `mcp_*` prefix
- Refresh flow list when flows are added/updated
- Convert flow metadata to MCP tool schema
- Serve tool list via HTTP endpoint

**Flow Naming Convention:**
```
mcp_<action>_<entity>

Examples:
- mcp_radio_toggle
- mcp_radio_tune
- mcp_lights_bedroom_on
- mcp_thermostat_set
```

**Tool Naming Convention:**
```
Flow: "mcp_radio_toggle"
Tool: "radio_toggle"

Flow: "mcp_lights_bedroom_on"
Tool: "lights_bedroom_on"
```

**HTTP Endpoint:**
```
POST http://192.168.1.100:3000/mcp
Body: {
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}

Response: {
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "radio_toggle",
        "description": "Toggle radio power",
        "inputSchema": { "type": "object", "properties": {} }
      }
    ]
  }
}
```

#### F-3: Flow Execution
**Description:** Execute Homey flows when MCP tools are called via HTTP

**Requirements:**
- Receive tool call from MCP client over HTTP
- Map tool name to flow ID
- Trigger flow via Homey API
- Return success/failure status to client via HTTP
- Handle basic errors gracefully

**HTTP Request:**
```
POST http://192.168.1.100:3000/mcp
Body: {
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "radio_toggle",
    "arguments": {}
  }
}
```

**Response Format:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Flow 'radio_toggle' executed successfully"
      }
    ]
  }
}
```

#### F-4: Parameter Support (Stretch Goal)
**Description:** Support flows that accept parameters

**Requirements:**
- Define parameter schema in flow description/tags
- Extract parameters from MCP tool call
- Pass parameters to flow as tokens/state
- Validate basic parameter types (string, number)

**Parameter Definition (in flow description):**
```
Description: "Tune radio to station"
Parameters: streamUrl (string, required)
```

**Tool Schema Example:**
```json
{
  "name": "radio_tune",
  "description": "Tune radio to a specific station",
  "inputSchema": {
    "type": "object",
    "properties": {
      "streamUrl": {
        "type": "string",
        "description": "The streaming URL of the radio station"
      }
    },
    "required": ["streamUrl"]
  }
}
```

**HTTP Call with Parameters:**
```
POST http://192.168.1.100:3000/mcp
Body: {
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "radio_tune",
    "arguments": {
      "streamUrl": "http://bbc.co.uk/radio1/stream"
    }
  }
}
```

### 3.2 Configuration & Setup

#### F-5: App Configuration
**Description:** Simple configuration interface in Homey app settings

**Settings:**
- ✅ Enable/disable MCP server
- ✅ Port configuration (default: 3000)
- ✅ Display server URL (for easy copy-paste)
- ✅ Optional API key for basic authentication
- ✅ View list of exposed flows
- ✅ Refresh flow cache button
- ✅ Donation links (Buy Me a Coffee, GitHub Sponsors)

**UI Mock:**
```
┌─────────────────────────────────┐
│ Homey MCP Server Settings       │
├─────────────────────────────────┤
│ ☑ MCP Server Enabled            │
│                                 │
│ Server URL:                     │
│ http://192.168.1.100:3000/mcp   │
│ [Copy URL]                      │
│                                 │
│ Port: [3000]                    │
│                                 │
│ API Key (optional):             │
│ [Generate] [••••••••]           │
│                                 │
│ Exposed Flows (3):              │
│ • radio_toggle                  │
│ • radio_tune                    │
│ • lights_bedroom_on             │
│                                 │
│ [Refresh Flows]                 │
│                                 │
│ ──────────────────────────      │
│ Enjoying this app? ☕           │
│ [Support on GitHub]             │
│ [Buy Me a Coffee]               │
└─────────────────────────────────┘
```

#### F-6: Network Discovery
**Description:** Help users find their Homey's IP address

**Requirements:**
- Display Homey Pro's current IP address in settings
- Show full MCP server URL for easy setup
- Copy-to-clipboard functionality
- Instructions for finding IP if not shown

---

## 4. Example Use Case: Radio Control

### Scenario 1: Simple Toggle (MVP)

**Setup:**
1. User creates flow in Homey:
   - Name: `mcp_radio_toggle`
   - When: This flow is started
   - Then: Toggle Sonos/Radio device power

**Network Setup:**
2. User opens Homey MCP Server app settings
3. Notes the server URL: `http://192.168.1.100:3000/mcp`
4. On laptop, edits Claude Desktop config with this URL

**Usage with Claude:**
```
User: "Turn on my radio"

Claude Desktop: 
  → Sends HTTP POST to http://192.168.1.100:3000/mcp
  → Calls tool: radio_toggle

MCP Server (on Homey Pro):
  → Receives HTTP request
  → Triggers flow "mcp_radio_toggle"

Homey Flow Engine:
  → Executes flow
  → Radio turns on

MCP Server:
  → Returns success via HTTP response

Claude: "I've turned on your radio."
```

### Scenario 2: Tune to Station (Stretch Goal)

**Setup:**
1. User creates flow in Homey:
   - Name: `mcp_radio_tune`
   - Description: `Tune radio to station. Parameters: streamUrl (string, required)`
   - When: This flow is started
   - Then: 
     - Set variable `station_url` to {{streamUrl}}
     - Play URL on Sonos/Radio device

**Usage with Claude:**
```
User: "Play BBC Radio 1"

Claude Desktop: 
  → Searches for BBC Radio 1 streaming URL
  → Sends HTTP POST to http://192.168.1.100:3000/mcp
  → Calls tool: radio_tune
  → With parameter: streamUrl="http://bbc.co.uk/radio1/stream"

MCP Server (on Homey Pro):
  → Receives HTTP request with parameter
  → Triggers flow with parameter
  → Passes streamUrl as token/state

Homey Flow Engine:
  → Executes flow
  → Radio tunes to BBC Radio 1

MCP Server:
  → Returns success via HTTP response

Claude: "Now playing BBC Radio 1."
```

---

## 5. Technical Architecture

### 5.1 Component Overview

```
LOCAL NETWORK (192.168.1.x)

┌─────────────────────────────────────────┐
│  Laptop (192.168.1.50)                  │
│  ┌───────────────────────────────┐     │
│  │  Claude Desktop (MCP Client)  │     │
│  └────────────┬──────────────────┘     │
└───────────────┼─────────────────────────┘
                │
                │ HTTP POST
                │ http://192.168.1.100:3000/mcp
                │
┌───────────────▼─────────────────────────┐
│  Homey Pro Device (192.168.1.100)      │
│  ┌─────────────────────────────────┐   │
│  │  Express HTTP Server (:3000)    │   │
│  │  - POST /mcp endpoint           │   │
│  └──────────┬──────────────────────┘   │
│             │                            │
│  ┌──────────▼──────────────────────┐   │
│  │  MCP Server (Streamable HTTP)   │   │
│  │  - Tool listing handler         │   │
│  │  - Tool execution handler       │   │
│  │  - JSON-RPC message processing  │   │
│  └──────────┬──────────────────────┘   │
│             │                            │
│  ┌──────────▼──────────────────────┐   │
│  │  Flow Manager                   │   │
│  │  - Flow discovery               │   │
│  │  - Flow filtering (mcp_*)       │   │
│  │  - Flow metadata conversion     │   │
│  │  - Flow execution coordinator   │   │
│  └──────────┬──────────────────────┘   │
│             │                            │
│  ┌──────────▼──────────────────────┐   │
│  │  Homey API Client               │   │
│  │  - homey.flow.getFlows()        │   │
│  │  - homey.flow.triggerFlow()     │   │
│  └─────────────────────────────────┘   │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│      Homey Pro Flow Engine              │
│      (Native Homey System)              │
└─────────────────────────────────────────┘
```

### 5.2 Technology Stack

**Core:**
- Language: TypeScript
- HTTP Server: Express.js ^4.18.0
- MCP SDK: `@modelcontextprotocol/sdk` ^1.0.0
- Homey SDK: `homey` (Apps SDK v3)
- Transport: **Streamable HTTP** (single endpoint)

**Dependencies:**
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "body-parser": "^1.20.0",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "homey": "^3.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "typescript": "^5.0.0"
  }
}
```

### 5.3 Key Files Structure

```
com.your-name.homey-mcp/
├── app.json                 # Homey app manifest
├── app.ts                   # Main app entry point & HTTP server
├── lib/
│   ├── mcp-server.ts       # MCP Streamable HTTP implementation
│   ├── flow-manager.ts     # Flow discovery & management
│   ├── http-handler.ts     # Express route handlers
│   └── types.ts            # TypeScript interfaces
├── settings/
│   └── index.html          # Settings page (shows URL, etc)
├── assets/
│   └── icon.svg            # App icon
├── locales/
│   └── en.json             # Translations
└── README.md               # Documentation
```

### 5.4 Core Implementation Example

```typescript
// app.ts - Main entry point
import Homey from 'homey';
import express from 'express';
import { HomeyMCPServer } from './lib/mcp-server';

class HomeyMCPApp extends Homey.App {
  private mcpServer?: HomeyMCPServer;
  private httpServer?: any;

  async onInit() {
    this.log('Homey MCP Server is starting...');
    
    // Get port from settings (default 3000)
    const port = this.homey.settings.get('mcp_port') || 3000;
    
    // Initialize MCP server
    this.mcpServer = new HomeyMCPServer(this.homey, port);
    
    // Start HTTP server
    await this.mcpServer.start();
    
    this.log(`MCP Server running on port ${port}`);
  }

  async onUninit() {
    if (this.mcpServer) {
      await this.mcpServer.stop();
    }
  }
}

module.exports = HomeyMCPApp;
```

```typescript
// lib/mcp-server.ts - MCP HTTP Server
import express from 'express';
import bodyParser from 'body-parser';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { FlowManager } from './flow-manager';

export class HomeyMCPServer {
  private app: express.Application;
  private server: Server;
  private port: number;
  private flowManager: FlowManager;
  private httpServer?: any;

  constructor(homey: any, port = 3000) {
    this.app = express();
    this.port = port;
    this.flowManager = new FlowManager(homey);
    
    // Initialize MCP Server
    this.server = new Server({
      name: 'homey-mcp-server',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });

    this.setupRoutes();
    this.setupMCPHandlers();
  }

  private setupRoutes() {
    this.app.use(bodyParser.json());
    
    // Single Streamable HTTP endpoint
    this.app.post('/mcp', async (req, res) => {
      try {
        const response = await this.handleMCPRequest(req.body);
        res.json(response);
      } catch (error) {
        res.status(500).json({
          jsonrpc: '2.0',
          id: req.body.id,
          error: {
            code: -32603,
            message: 'Internal error'
          }
        });
      }
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });
  }

  private setupMCPHandlers() {
    // Handle tools/list requests
    this.server.setRequestHandler('tools/list', async () => {
      const flows = await this.flowManager.getMCPFlows();
      const tools = flows.map(flow => ({
        name: this.flowManager.flowToToolName(flow.name),
        description: flow.name,
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }));
      
      return { tools };
    });

    // Handle tools/call requests
    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;
      const flowName = `mcp_${name}`;
      
      const result = await this.flowManager.triggerFlow(flowName, args);
      
      return {
        content: [
          {
            type: 'text',
            text: result.success 
              ? `Flow '${name}' executed successfully`
              : `Flow '${name}' failed: ${result.error}`
          }
        ]
      };
    });
  }

  private async handleMCPRequest(body: any) {
    // Process JSON-RPC request through MCP server
    return await this.server.handleRequest(body);
  }

  async start() {
    return new Promise<void>((resolve) => {
      this.httpServer = this.app.listen(this.port, '0.0.0.0', () => {
        console.log(`MCP Server listening on port ${this.port}`);
        resolve();
      });
    });
  }

  async stop() {
    if (this.httpServer) {
      this.httpServer.close();
    }
  }
}
```

```typescript
// lib/flow-manager.ts - Flow Discovery & Execution
export class FlowManager {
  private homey: any;
  private homeyApi: any;

  constructor(homey: any) {
    this.homey = homey;
  }

  async init() {
    const HomeyAPI = require('homey-api');
    this.homeyApi = await HomeyAPI.createAppAPI({ homey: this.homey });
  }

  async getMCPFlows() {
    await this.init();
    const allFlows = await this.homeyApi.flow.getFlows();
    
    // Filter flows with mcp_ prefix
    return Object.values(allFlows).filter((flow: any) => 
      flow.name.toLowerCase().startsWith('mcp_')
    );
  }

  flowToToolName(flowName: string): string {
    // Convert "mcp_radio_toggle" to "radio_toggle"
    return flowName.toLowerCase().replace(/^mcp_/, '');
  }

  async triggerFlow(flowName: string, parameters?: any) {
    try {
      await this.init();
      const flows = await this.homeyApi.flow.getFlows();
      const flow = Object.values(flows).find((f: any) => 
        f.name.toLowerCase() === flowName.toLowerCase()
      );

      if (!flow) {
        return { success: false, error: 'Flow not found' };
      }

      await this.homeyApi.flow.triggerFlow({
        id: flow.id,
        state: parameters || {}
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
```

---

## 6. Data Models

### 6.1 Homey Flow (Input)

```typescript
interface HomeyFlow {
  id: string;              // "abc-123-def-456"
  name: string;            // "mcp_radio_toggle"
  enabled: boolean;
  folder?: string;
  trigger?: FlowCard;
}
```

### 6.2 MCP Tool (Output)

```typescript
interface MCPTool {
  name: string;            // "radio_toggle"
  description: string;     // "Toggle radio power"
  inputSchema: {
    type: "object";
    properties: Record<string, JSONSchema>;
    required?: string[];
  }
}
```

### 6.3 HTTP Request/Response

```typescript
// JSON-RPC Request
interface MCPRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;          // "tools/list" or "tools/call"
  params?: any;
}

// JSON-RPC Response
interface MCPResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}
```

### 6.4 Flow Execution

```typescript
interface FlowExecutionRequest {
  toolName: string;        // "radio_toggle"
  parameters?: Record<string, any>;
}

interface FlowExecutionResponse {
  success: boolean;
  message: string;
  flowId?: string;
  error?: string;
}
```

---

## 7. User Interface

### 7.1 Homey App Settings Page

**Sections:**

1. **Server Status**
   - MCP Server: ✓ Running / ✗ Stopped
   - Server URL: `http://192.168.1.100:3000/mcp` [Copy]
   - Port: 3000 [Edit]

2. **Connection Info**
   - Display full URL for easy copy-paste
   - Instructions: "Copy this URL and add to Claude Desktop config"
   - Link to setup guide

3. **Flow List**
   - Table showing discovered MCP flows
   - Columns: Flow Name, Tool Name, Status
   - Real-time status indicators

4. **Actions**
   - [Refresh Flows] button
   - [Restart Server] button
   - [View Documentation] link

5. **Optional Security**
   - Enable API Key: ☐
   - API Key: [Generate] [••••••••]
   - Instructions for adding to Claude config

6. **Support**
   - Donation links
   - GitHub repository link
   - Documentation link
   - Community forum link

**Full UI Mock:**
```
┌─────────────────────────────────────────┐
│ Homey MCP Server Settings               │
├─────────────────────────────────────────┤
│                                         │
│ 🟢 MCP Server Status: Running           │
│                                         │
│ Server URL:                             │
│ ┌─────────────────────────────────────┐ │
│ │ http://192.168.1.100:3000/mcp       │ │
│ └─────────────────────────────────────┘ │
│ [Copy URL]  [View Setup Guide]          │
│                                         │
│ Port: [3000]  [Apply]                   │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ Exposed Flows (3):                      │
│ ┌─────────────────────────────────────┐ │
│ │ Flow Name          │ Tool Name      │ │
│ │────────────────────│────────────────│ │
│ │ mcp_radio_toggle   │ radio_toggle   │ │
│ │ mcp_radio_tune     │ radio_tune     │ │
│ │ mcp_lights_bed_on  │ lights_bed_on  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Refresh Flows]  [Test Connection]      │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ Optional Security:                      │
│ ☐ Enable API Key Authentication         │
│ API Key: [Generate] [••••••••] [Copy]   │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ Enjoying this app? ☕                   │
│ [💖 GitHub Sponsors]                    │
│ [☕ Buy Me a Coffee]                    │
│ [📖 Documentation]                      │
│                                         │
└─────────────────────────────────────────┘
```

### 7.2 Claude Desktop Configuration

**User Instructions:**

**Step 1: Find your Homey Pro's IP address**
- Open Homey app settings → Network
- Or check Homey MCP Server app for the full URL

**Step 2: Locate Claude Desktop config file**
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

**Step 3: Add Homey MCP Server**

```json
{
  "mcpServers": {
    "homey": {
      "url": "http://192.168.1.100:3000/mcp"
    }
  }
}
```

**With optional API key:**
```json
{
  "mcpServers": {
    "homey": {
      "url": "http://192.168.1.100:3000/mcp",
      "headers": {
        "X-API-Key": "your-api-key-here"
      }
    }
  }
}
```

**Step 4: Restart Claude Desktop**

**Step 5: Test the connection**
- Open Claude Desktop
- Ask: "What tools do you have access to?"
- You should see Homey tools listed

---

## 8. Security & Privacy

### 8.1 Security Requirements

**S-1: Local Network Only**
- HTTP server accessible only on local network (192.168.1.x)
- No port forwarding or external access by default
- Server binds to `0.0.0.0` but protected by router/firewall
- Users must be on same network as Homey Pro

**S-2: Optional API Key Authentication**
- Simple API key in HTTP headers
- User generates key in Homey app settings
- Claude Desktop config includes key
- Optional - can be disabled for trusted networks

**Implementation:**
```typescript
// Optional middleware for API key check
app.use('/mcp', (req, res, next) => {
  const apiKeyEnabled = homey.settings.get('api_key_enabled');
  if (!apiKeyEnabled) return next();
  
  const apiKey = req.headers['x-api-key'];
  const expectedKey = homey.settings.get('api_key');
  
  if (apiKey !== expectedKey) {
    return res.status(401).json({
      jsonrpc: '2.0',
      id: req.body?.id,
      error: { code: -32001, message: 'Unauthorized' }
    });
  }
  next();
});
```

**S-3: Flow Filtering**
- Only expose flows explicitly marked (mcp_* prefix)
- Users control which flows are available
- No access to system flows or settings
- No flow creation/deletion via API

**S-4: Port Configuration**
- Default port: 3000
- User-configurable in settings
- Validate port availability on startup
- Display clear error if port in use

**S-5: Error Handling**
- Don't expose internal errors to MCP client
- Log errors locally for debugging
- Generic error messages to client
- Proper HTTP status codes

### 8.2 Privacy

**P-1: No Data Collection**
- No telemetry or analytics
- No external API calls from the app
- All processing happens locally on Homey Pro
- No user data collection

**P-2: Local Processing**
- All MCP communication stays on local network
- No cloud services involved
- Flow execution happens on Homey Pro
- Parameters never leave local network

**P-3: Logging**
- Minimal logging (errors only)
- Logs stored locally on Homey Pro
- No sensitive data in logs
- Logs not transmitted anywhere

### 8.3 Network Security Best Practices

**Recommendations for Users:**
1. Keep Homey Pro firmware updated
2. Use strong WiFi password (WPA3)
3. Enable API key if sharing network with untrusted devices
4. Don't expose Homey Pro directly to internet
5. Use firewall rules if available on router

---

## 9. Testing Strategy

### 9.1 Manual Testing Checklist

**Pre-launch Testing:**

**Network Setup:**
- [ ] Install app on Homey Pro
- [ ] Note Homey Pro's IP address
- [ ] Verify HTTP server starts on correct port
- [ ] Check server URL in app settings

**Flow Setup:**
- [ ] Create test flow: `mcp_radio_toggle`
- [ ] Verify flow appears in app settings
- [ ] Confirm tool name conversion correct

**Claude Desktop Config:**
- [ ] Find Claude Desktop config file location
- [ ] Add Homey MCP server URL
- [ ] Restart Claude Desktop
- [ ] Verify Claude shows connected status

**Basic Communication:**
- [ ] Ask Claude "What tools do you have access to?"
- [ ] Verify Homey tools appear in list
- [ ] Check tool descriptions are clear

**Flow Execution:**
- [ ] Ask Claude "Turn on radio"
- [ ] Verify flow executes on Homey
- [ ] Check Claude receives success confirmation
- [ ] Verify actual device state changed
- [ ] Check flow execution in Homey app timeline

**Error Handling:**
- [ ] Try executing non-existent flow
- [ ] Check error message is clear
- [ ] Verify server doesn't crash
- [ ] Test with invalid parameters

**Network Testing:**
- [ ] Test from same device (localhost)
- [ ] Test from different device on network
- [ ] Verify connection works across WiFi
- [ ] Test with laptop on different subnet (if applicable)

**Parameter Testing (Stretch):**
- [ ] Create flow: `mcp_radio_tune` with parameter
- [ ] Ask Claude "Play [station name]"
- [ ] Verify Claude finds streaming URL
- [ ] Verify parameter passed correctly
- [ ] Verify radio tunes to correct station
- [ ] Check parameter value in flow execution

**Settings Testing:**
- [ ] Change port number
- [ ] Restart app
- [ ] Verify server runs on new port
- [ ] Update Claude config with new port
- [ ] Test connection still works

**API Key Testing (Optional):**
- [ ] Generate API key in settings
- [ ] Enable API key authentication
- [ ] Test without key - should fail
- [ ] Add key to Claude config
- [ ] Test with key - should succeed

### 9.2 Curl Testing

**Test MCP server directly with curl:**

```bash
# Test health check
curl http://192.168.1.100:3000/health

# Test tools/list
curl -X POST http://192.168.1.100:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'

# Test tools/call
curl -X POST http://192.168.1.100:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "radio_toggle",
      "arguments": {}
    }
  }'

# Test with API key
curl -X POST http://192.168.1.100:3000/mcp \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key-here" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

### 9.3 Edge Cases

**Test these scenarios:**
- Flow deleted while MCP server running
- Flow renamed while MCP server running
- Multiple tool calls in rapid succession
- Invalid parameters passed
- Flow execution fails
- Network disconnection during execution
- Port already in use on startup
- Homey Pro restarts while clients connected
- Client sends malformed JSON-RPC
- Very long flow names
- Special characters in flow names
- Empty flow list (no mcp_* flows exist)

### 9.4 Performance Testing

**Basic performance checks:**
- Response time for tools/list (<100ms)
- Response time for tools/call (<500ms)
- Server handles 10 concurrent requests
- Memory usage stable over time
- No memory leaks after 100 requests

---

## 10. Documentation

### 10.1 README.md (GitHub)

**Sections:**

1. **What is Homey MCP Server?**
   - Overview and benefits
   - How it works
   - Network architecture diagram

2. **Features**
   - Natural language flow control
   - Works with any MCP client
   - Local network only
   - Simple setup
   - No cloud required

3. **Requirements**
   - Homey Pro (Early 2023 or later)
   - Homey Pro and client on same local network
   - MCP-compatible client (Claude Desktop, etc.)

4. **Installation**
   - From Homey App Store
   - From source (for developers)

5. **Quick Start Guide**
   - Step 1: Install app
   - Step 2: Create mcp_* flow
   - Step 3: Note server URL
   - Step 4: Configure Claude Desktop
   - Step 5: Test connection

6. **Creating MCP-Enabled Flows**
   - Naming convention (mcp_*)
   - Best practices
   - Parameter syntax (stretch goal)
   - Examples

7. **Claude Desktop Setup**
   - Config file location
   - Configuration format
   - Troubleshooting

8. **Network Setup**
   - Finding Homey Pro IP
   - Port configuration
   - Firewall considerations
   - Multi-network scenarios

9. **Examples**
   - Radio control
   - Light control
   - Temperature control
   - Complex flows with parameters

10. **Troubleshooting**
    - "Connection refused" - check IP/port
    - "Tools not appearing" - check flow names
    - "Flow not executing" - check flow enabled
    - Network issues
    - Port conflicts

11. **API Reference**
    - HTTP endpoints
    - JSON-RPC methods
    - Error codes
    - Example requests/responses

12. **Contributing**
    - How to contribute
    - Development setup
    - Code style
    - Pull request process

13. **Support the Project**
    - GitHub Sponsors
    - Buy Me a Coffee
    - Community contributions

14. **License**
    - MIT License

### 10.2 User Guide (In-App Help)

**Quick Start:**
```
1. Create a flow in Homey
2. Name it starting with "mcp_"
   Example: mcp_radio_toggle
3. Copy server URL from settings
4. Add to Claude Desktop config
5. Restart Claude Desktop
6. Ask Claude to control your flow!
```

**Flow Naming Guide:**
```
✅ Correct:
- mcp_radio_toggle
- mcp_lights_bedroom_on
- mcp_thermostat_set

❌ Wrong:
- Radio Toggle (no mcp_ prefix)
- MCP_lights (must be lowercase)
- mcp-radio-on (use underscore, not dash)
```

**Network Setup:**
```
Your Homey MCP Server URL:
http://192.168.1.100:3000/mcp

Add this to Claude Desktop config at:
Mac: ~/Library/Application Support/Claude/claude_desktop_config.json
Windows: %APPDATA%\Claude\claude_desktop_config.json

{
  "mcpServers": {
    "homey": {
      "url": "http://192.168.1.100:3000/mcp"
    }
  }
}
```

### 10.3 Developer Documentation

**Architecture overview:**
- Component diagram
- Data flow
- HTTP transport details
- MCP protocol implementation

**API Reference:**
- Endpoints
- Request/response formats
- Error codes
- Authentication

**Development Setup:**
- Clone repository
- Install dependencies
- Run locally
- Debug mode

**Contributing:**
- Code style guide
- Testing requirements
- PR checklist
- Community guidelines

---

## 11. Deployment & Distribution

### 11.1 Homey App Store Submission

**Required Assets:**
- App icon (SVG, 500x500)
- App name: "Homey MCP Server"
- Category: Tools & Utilities
- Version: 0.1.0-beta
- Compatibility: Homey Pro (Early 2023)

**App Store Description:**
```
Control your Homey flows using AI assistants like Claude through 
the Model Context Protocol (MCP).

Simply prefix your flows with "mcp_" and use natural language 
to control your smart home from any MCP-compatible application.

Features:
• Natural language flow control
• Works with Claude Desktop and other MCP clients
• Secure local network communication
• No cloud services required
• Simple setup with copy-paste configuration
• Free and open source

Perfect for:
• Voice-free AI-powered home automation
• Integrating Homey with AI workflows
• Advanced users wanting programmable control
• Testing and debugging flows

This app is open source and donation-supported.
Visit GitHub for documentation and support.
```

**Installation Instructions:**
```
1. Install the app from Homey App Store
2. Open app settings and note the Server URL
3. Create flows starting with "mcp_" prefix
4. Add server URL to your MCP client (e.g., Claude Desktop)
5. Restart your MCP client
6. Start controlling flows with natural language!

Full documentation: [GitHub URL]
```

**Screenshots to Include:**
1. Settings page showing server URL
2. Flow list in app
3. Claude Desktop controlling a flow
4. Example flow configuration

### 11.2 GitHub Repository

**Repository name:** `homey-mcp-server`

**Repository structure:**
```
homey-mcp-server/
├── .github/
│   ├── FUNDING.yml          # Donation links
│   ├── ISSUE_TEMPLATE/
│   └── workflows/           # CI/CD (optional)
├── app.json
├── app.ts
├── lib/
├── settings/
├── assets/
├── LICENSE                  # MIT
├── README.md               # Comprehensive guide
├── CONTRIBUTING.md         # Contribution guidelines
├── CHANGELOG.md           # Version history
└── docs/
    ├── setup-guide.md
    ├── api-reference.md
    └── examples.md
```

**GitHub Features:**
- Enable GitHub Sponsors
- Create issue templates
- Add topics: homey, mcp, smart-home, claude
- Enable Discussions for community
- Add comprehensive README

**Shields/Badges:**
```markdown
![Homey App Store](shield-url)
![GitHub Stars](shield-url)
![License: MIT](shield-url)
![GitHub Sponsors](shield-url)
```

### 11.3 Community Presence

**Homey Community Forum:**
- Post announcement thread
- Provide support
- Share updates
- Gather feedback

**Social Media:**
- Tweet announcement (tag @Homey)
- Share in smart home communities
- Reddit: r/homeautomation, r/smarthome
- Discord communities

---

## 12. Success Metrics

### 12.1 Launch Goals (First Month)

**Adoption:**
- 50+ installations from Homey App Store
- 10+ GitHub stars
- 5+ flows shared by community

**Engagement:**
- 5+ user comments/issues on GitHub
- 3+ posts on Homey Community Forum
- Active users testing and providing feedback

**Quality:**
- <5 critical bugs reported
- <3 major issues
- 90%+ positive feedback

**Financial:**
- 3-5 donations received
- Cover basic hosting costs for docs

**Community:**
- 2+ code contributions
- 3+ documentation improvements
- 1+ community-created flow example

### 12.2 Long-term Goals (6 months)

**Adoption:**
- 200+ installations
- 50+ GitHub stars
- 20+ flows shared by community
- Featured in Homey newsletter

**Ecosystem:**
- 3+ MCP clients tested and working
- 10+ example flows documented
- Integration guides for popular platforms
- Video tutorials created

**Financial:**
- 10-20 monthly sponsors/supporters
- Sustainable donation income
- Cover all development costs

**Recognition:**
- Mentioned in Homey Community Forums
- Featured by MCP/Anthropic
- Blog posts from users
- Integration in other projects

**Development:**
- Parameter support fully working
- 5+ releases with improvements
- Active contributor community
- Comprehensive documentation

### 12.3 Key Performance Indicators (KPIs)

**Track weekly:**
- App Store installations
- GitHub stars
- Active issues
- Donation count

**Track monthly:**
- Active users (if possible)
- Community engagement
- Bug reports vs. features
- Documentation visits

---

## 13. Risks & Mitigation

### 13.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| MCP SDK not compatible with Homey environment | High | Low | Test SDK early in dev, verify HTTP transport works |
| Express.js performance issues on Homey | Medium | Low | Keep server lightweight, test with load |
| Network configuration too complex for users | High | Medium | Provide clear docs, auto-detect IP, simple UI |
| Port conflicts with other apps | Medium | Medium | Make port configurable, detect conflicts |
| Flow parameter passing complex | Medium | High | Start without parameters (MVP), add later |
| Homey API rate limiting | Medium | Low | Implement basic rate limiting, queue requests |
| HTTP latency over network | Low | Low | Optimize request handling, keep responses small |
| Memory leaks in long-running server | Medium | Medium | Test memory usage, proper cleanup |

### 13.2 Market Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Low user interest in MCP | Medium | Medium | Start small, validate with community first |
| Homey policy changes regarding network apps | High | Low | Monitor guidelines, stay compliant |
| MCP adoption slow | Low | Medium | App still useful, just less relevant |
| Technical barrier too high | Medium | High | Excellent docs, video tutorials, support |
| Competition from official solution | Low | Low | Open source allows collaboration |
| Network setup frustrates users | High | Medium | Simple UI, auto-detection, clear instructions |

### 13.3 Security Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Unauthorized access on network | Medium | Low | API key option, clear security docs |
| Malicious flow execution | Low | Low | Only expose mcp_* flows, user controls |
| DoS via many requests | Low | Low | Basic rate limiting, monitor usage |
| Port scanning/discovery | Low | Medium | Document firewall best practices |

---

## 14. Development Roadmap

### Phase 1: MVP Development (Weekend 1 - Days 1-2)

**Goal: Basic functionality working**

**Day 1 (Saturday):**
- [x] Set up Homey app project structure
- [x] Install dependencies (Express, MCP SDK)
- [x] Implement basic HTTP server
- [x] Implement MCP Streamable HTTP transport
- [x] Flow discovery (mcp_* filter)
- [x] Basic tool listing endpoint
- [ ] Test with curl

**Day 2 (Sunday):**
- [ ] Flow execution implementation
- [ ] Settings page (show URL, port)
- [ ] Error handling
- [ ] Test with Claude Desktop
- [ ] Basic README
- [ ] Test on actual Homey Pro

**Success Criteria:**
- Server runs and accepts HTTP requests
- Can list mcp_* flows
- Can trigger flows from Claude Desktop
- Basic settings UI works

### Phase 2: Polish & Testing (Week 2)

**Goal: Ready for App Store submission**

**Day 3-5:**
- [ ] Comprehensive error handling
- [ ] Better logging (debug mode)
- [ ] Port configuration
- [ ] URL copy-to-clipboard
- [ ] Flow refresh mechanism
- [ ] Test edge cases

**Day 6-7:**
- [ ] App Store assets (icon, screenshots)
- [ ] README completion
- [ ] Setup guide
- [ ] Example flows
- [ ] Submit to App Store for review

**Success Criteria:**
- No critical bugs
- Clean, professional UI
- Comprehensive documentation
- App Store submission complete

### Phase 3: Community Launch (Week 3)

**Goal: Get users and feedback**

**Tasks:**
- [ ] GitHub repository public
- [ ] Post on Homey Community Forum
- [ ] Share on social media
- [ ] Create demo video
- [ ] Set up donation links
- [ ] Monitor for issues

**Success Criteria:**
- 10+ installations
- 5+ GitHub stars
- Positive initial feedback
- No critical bugs reported

### Phase 4: Iteration (Month 2+)

**Goal: Improve based on feedback**

**Priorities (based on feedback):**
- [ ] Parameter support implementation
- [ ] API key authentication
- [ ] Advanced flow features
- [ ] Better error messages
- [ ] Performance optimizations
- [ ] Video tutorials
- [ ] Flow template library

**Success Criteria:**
- 50+ installations
- 20+ GitHub stars
- 5+ donations
- Active community engagement

---

## 15. Open Questions & Decisions

### Resolved

**Q1: What transport protocol?**
- ✅ **Decision:** Streamable HTTP (modern MCP standard)
- **Rationale:** Works across network devices, single endpoint, simpler

**Q2: How to identify MCP-enabled flows?**
- ✅ **Decision:** `mcp_*` prefix in flow name
- **Rationale:** Simple, visible, no extra config needed

**Q3: Where does MCP server run?**
- ✅ **Decision:** As Homey app on Homey Pro device
- **Rationale:** Local, no external hosting, simple for users

**Q4: Authentication approach?**
- ✅ **Decision:** Optional API key in headers
- **Rationale:** Balance between security and ease of use

### To Be Decided

**Q5: How to define parameters in flows?**
- Option A: JSON in flow description field
- Option B: Special syntax/tags in description
- Option C: Separate config file
- **Temporary Decision:** Start without parameters (MVP), decide based on user needs

**Q6: Support for Advanced Flows?**
- **Temporary Decision:** Yes, treat same as regular flows for MVP

**Q7: Flow folders - should we respect them?**
- **Temporary Decision:** Ignore folders for MVP, filter only by name prefix

**Q8: How often to refresh flow list?**
- **Temporary Decision:** On app start + manual refresh button

**Q9: Should we support flow creation via MCP?**
- **Temporary Decision:** No, out of scope for MVP. Read-only for now.

**Q10: Multiple MCP server instances?**
- **Question:** Should we support multiple ports/servers?
- **Temporary Decision:** Single server instance for MVP

**Q11: Rate limiting strategy?**
- **Question:** How many requests per minute?
- **Temporary Decision:** No rate limiting for MVP, add if needed

---

## 16. Appendix

### A. Reference Links

**MCP Resources:**
- MCP Specification: https://modelcontextprotocol.io
- MCP Transports: https://modelcontextprotocol.io/docs/concepts/transports
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- Streamable HTTP Spec: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http

**Homey Resources:**
- Homey Apps SDK: https://apps.developer.homey.app
- Homey Web API: https://api.developer.homey.app
- Homey Developer Tools: https://tools.developer.homey.app
- Homey Community Forum: https://community.homey.app

**Technical References:**
- Express.js Docs: https://expressjs.com
- JSON-RPC 2.0 Spec: https://www.jsonrpc.org/specification
- TypeScript Handbook: https://www.typescriptlang.org/docs

### B. Example Flows

**Example 1: Simple Toggle**
```yaml
Name: mcp_radio_toggle
When: This flow is started
Then: Toggle [Sonos Device] power
```

**Example 2: Device Control**
```yaml
Name: mcp_lights_bedroom_on
When: This flow is started
Then: Turn on [Bedroom Lights]
```

**Example 3: With Parameter (Stretch Goal)**
```yaml
Name: mcp_radio_tune
Description: Tune radio to station. Parameters: streamUrl (string)
When: This flow is started
Then: 
  - Set variable streamUrl to {{streamUrl}}
  - Play URL {{streamUrl}} on [Sonos Device]
```

**Example 4: Complex Flow**
```yaml
Name: mcp_movie_mode
When: This flow is started
Then:
  - Turn off [All Lights]
  - Turn on [TV]
  - Close [Blinds]
  - Set [Temperature] to 20°C
```

**Example 5: Conditional Flow**
```yaml
Name: mcp_smart_light_toggle
When: This flow is started
And: Time is between sunset and sunrise
Then: Turn on [Lights] at 50% brightness
Else: Turn on [Lights] at 100% brightness
```

### C. HTTP API Examples

**List All Tools:**
```bash
curl -X POST http://192.168.1.100:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "radio_toggle",
        "description": "Toggle radio power",
        "inputSchema": {
          "type": "object",
          "properties": {},
          "required": []
        }
      },
      {
        "name": "lights_bedroom_on",
        "description": "Turn on bedroom lights",
        "inputSchema": {
          "type": "object",
          "properties": {},
          "required": []
        }
      }
    ]
  }
}
```

**Execute Tool:**
```bash
curl -X POST http://192.168.1.100:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "radio_toggle",
      "arguments": {}
    }
  }'
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Flow 'radio_toggle' executed successfully"
      }
    ]
  }
}
```

**Execute Tool with Parameters (Stretch):**
```bash
curl -X POST http://192.168.1.100:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "radio_tune",
      "arguments": {
        "streamUrl": "http://bbc.co.uk/radio1/stream"
      }
    }
  }'
```

**With API Key:**
```bash
curl -X POST http://192.168.1.100:3000/mcp \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key-here" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

### D. Donation Platforms

**Primary: GitHub Sponsors**
- URL: https://github.com/sponsors/[your-username]
- Benefits: No fees, recurring support, direct integration
- Tiers: $5, $10, $20, $50/month
- Perks: Name in README, priority support, feature voting

**Secondary: Buy Me a Coffee**
- URL: https://buymeacoffee.com/[your-username]
- Benefits: Easy for casual supporters, low barrier
- Fees: 5% platform fee
- Options: One-time or membership

**Tertiary: PayPal**
- Direct donations
- PayPal fees apply
- For users who prefer PayPal

**Ko-fi (Alternative)**
- Similar to Buy Me a Coffee
- 0% platform fees
- URL: https://ko-fi.com/[your-username]

### E. Network Diagram

```
┌────────────────────────────────────────────────┐
│          Local Network (192.168.1.x)           │
│                                                │
│  ┌──────────────┐         ┌────────────────┐  │
│  │   Router     │         │  Homey Pro     │  │
│  │              │         │  192.168.1.100 │  │
│  └──────┬───────┘         └────────┬───────┘  │
│         │                          │          │
│         │        WiFi              │          │
│         │                          │          │
│  ┌──────┴───────┐           ┌─────▼──────┐   │
│  │   Laptop     │           │ MCP Server │   │
│  │ 192.168.1.50 │◄──────────┤ Port 3000  │   │
│  │              │   HTTP    │            │   │
│  │ Claude       │           │ Exposes:   │   │
│  │ Desktop      │           │ /mcp       │   │
│  └──────────────┘           │ /health    │   │
│                             └────────────┘   │
│                                                │
│  ┌──────────────┐                             │
│  │   Phone      │                             │
│  │ 192.168.1.51 │◄────────────────────────────┘
│  │              │   (Future: n8n, etc)
│  └──────────────┘
│
└────────────────────────────────────────────────┘
```

---

## 17. Glossary

**MCP (Model Context Protocol):** An open protocol that standardizes how AI applications connect to data sources and tools.

**Streamable HTTP:** Modern MCP transport using a single HTTP endpoint with optional SSE streaming.

**Tool:** In MCP, a function that can be called by the AI model to perform actions.

**Flow:** In Homey, an automation rule with trigger, conditions, and actions.

**Homey Pro:** Smart home hub device that runs Homey software locally.

**JSON-RPC:** Remote procedure call protocol encoded in JSON.

**SSE (Server-Sent Events):** HTTP-based protocol for server-to-client streaming.

**Claude Desktop:** Desktop application for Claude AI with MCP support.

**Local Network:** Private network (typically home WiFi) where devices communicate.

**stdio:** Standard input/output, used for same-machine process communication.

**API Key:** Secret token used for authentication.

---

## 18. Sign-off

**Product Owner:** [Your Name]  
**Target Launch:** [Date + 2-3 weeks]  
**Status:** ✅ Ready for Development  

**Development Plan:**
- Weekend 1: MVP implementation
- Week 2: Polish and testing
- Week 3: App Store submission and launch

**Success Definition:**
- Working HTTP-based MCP server
- Can trigger flows from Claude Desktop
- Simple network setup
- Published to Homey App Store
- Open source on GitHub
- Donation links active

---

## 10. Production Bug Fixes (Session 2)

### Critical Issues Discovered & Resolved

**10.1 Flow Recognition - Run Listener Missing**
- **Symptom:** All flows with MCP trigger executed regardless of command name
- **Root Cause:** No run listener to validate which flows should execute
- **Fix:** Added run listener in app.ts that compares `args.command` (configured) with `state.command` (triggered)
- **Impact:** Only flows with matching commands now execute
- **File:** app.ts:36-61

**10.2 Trigger ID URI Format Mismatch**
- **Symptom:** Flow discovery returned 0 flows despite flows existing
- **Root Cause:** Code checked for `mcp_command_received` but Homey uses full URI `homey:app:nl.vmcc.homeymcpserver:mcp_command_received`
- **Fix:** Support three formats: short ID, full URI, endsWith pattern
- **Code:**
  ```typescript
  const isMCPTrigger =
    flowData.trigger.id === 'mcp_command_received' ||
    flowData.trigger.id === 'homey:app:nl.vmcc.homeymcpserver:mcp_command_received' ||
    flowData.trigger.id?.endsWith(':mcp_command_received');
  ```
- **Impact:** Reliable flow discovery across all Homey versions
- **File:** flow-manager.ts:172-176

**10.3 Advanced Flows Not Discovered**
- **Symptom:** Only regular flows appeared, Advanced Flows missing from tool list
- **Root Cause:** Only calling `HomeyAPI.flow.getFlows()`, not `getAdvancedFlows()`
- **Fix:** Call both APIs and merge results
- **Code:**
  ```typescript
  const regularFlows = await this.homeyApi.flow.getFlows();
  const advancedFlows = await this.homeyApi.flow.getAdvancedFlows();
  const allFlows = { ...regularFlows, ...advancedFlows };
  ```
- **Impact:** Both flow types now fully supported
- **File:** flow-manager.ts:87-106

**10.4 Parameter Order Inconsistency**
- **Symptom:** Parameters arrived in wrong order (streamName in value1, streamUrl in value2)
- **Root Cause:** Using `Object.values(parameters)` which has unpredictable order in JavaScript
- **Fix:** Cache parameter order from flow description parsing, use Map for deterministic lookup
- **Code:**
  ```typescript
  private commandParameterOrder: Map<string, string[]> = new Map();

  // During parsing:
  this.commandParameterOrder.set(flow.command, parameterNames);

  // During triggering:
  const parameterOrder = this.commandParameterOrder.get(toolName);
  parameterOrder.forEach((paramName, index) => {
    tokens[`value${index + 1}`] = String(parameters[paramName]);
  });
  ```
- **Impact:** Parameters consistently map to correct tokens
- **File:** flow-manager.ts:14, 454, 554-565

**10.5 Undefined Token Error**
- **Symptom:** "Expected string but got undefined" for value3 when only using 2 parameters
- **Root Cause:** Homey requires ALL tokens defined in manifest to have values
- **Fix:** Always provide all 5 tokens (value1-value5), use empty strings for unused
- **Code:**
  ```typescript
  const tokens: Record<string, any> = {
    command: toolName,
    value1: '',
    value2: '',
    value3: '',
    value4: '',
    value5: '',
  };
  ```
- **Impact:** No more undefined token errors, clean execution
- **File:** flow-manager.ts:535-542

**10.6 Text vs Autocomplete Field Type**
- **Symptom:** "Invalid type for arg 'command' expected 'string' but received 'object'"
- **User Preference:** Explicitly wanted text field, not autocomplete
- **Fix:** Changed trigger card command field from autocomplete to text type
- **Code:**
  ```json
  {
    "type": "text",
    "name": "command"
  }
  ```
- **Impact:** Simplified user experience, direct text input
- **File:** mcp_command_received.json:16

### 10.7 HTTP Polling Optimization
- **Issue:** 30-second automatic polling was wasteful
- **Reason:** HTTP can't push notifications anyway, polling achieved nothing
- **Fix:** Removed polling, removed `listChanged` capability
- **Added:** `refresh_homey_flows` and `trigger_any_flow` tools as workaround
- **Impact:** Less resource usage, explicit refresh control
- **Files:** app.ts (removed startFlowChangeDetection, listChanged capability)

---

**Notes:**
- This PRD reflects the production-ready architecture with parameters support
- All critical bugs discovered during testing have been resolved
- Focus remains on realistic weekend MVP ✅ ACHIEVED
- Network communication enables multi-device usage
- Local network only - no cloud/internet exposure
- Community feedback will drive future development
- Keep it simple, ship fast, iterate based on real usage

**Built and tested! 🚀**
**Next:** App Store preparation and public documentation