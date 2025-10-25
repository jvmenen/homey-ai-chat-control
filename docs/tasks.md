# Homey MCP Server - Implementation Tasks

**Project:** Homey MCP Server
**Goal:** Weekend MVP - AI-controlled home automation via MCP
**Reference:** [PRD.md](./PRD.md)
**Status:** Production Ready - Active Testing with Parameters
**Started:** 2025-10-24
**Updated:** 2025-10-24 (Late Night Session)

---

## Project Overview

Build an MCP (Model Context Protocol) server as a Homey app that exposes Homey flows as tools to AI assistants like Claude. This enables natural language control of home automation over the local network.

**Success Criteria:**
- ✅ Working HTTP-based MCP server running as Homey app
- ✅ HTTP connectivity proven (hello_homey test tool working)
- ✅ Flow trigger card architecture implemented
- ✅ Flow discovery from Homey flows using MCP trigger
- ✅ Can trigger flows from Claude Desktop (tested with kitchen LED toggle)
- ✅ Cross-device communication (Homey Pro ↔ Laptop) working
- ✅ Parameters support implemented (with token mapping)
- ✅ Advanced Flows support (alongside regular flows)
- ⏳ Publishable to Homey App Store

---

## Fase 1: Core MCP Server (MVP - Weekend 1)

**Goal:** Basic functionality working - flows discoverable and executable via MCP

### 1.1 Project Setup ✅

- [x] Install Homey CLI globally
- [x] Create Homey app project structure
- [x] Initialize with TypeScript, ESLint
- [x] Set up GitHub workflows
- [ ] Review and understand generated structure

**Time estimate:** ✅ Complete

### 1.2 Dependencies Installation ✅

- [x] Install production dependencies:
  - [x] `express` (^4.18.0) - HTTP server
  - [x] `body-parser` (^1.20.0) - JSON parsing
  - [x] `@modelcontextprotocol/sdk` (^1.0.0) - MCP protocol
  - [x] `homey-api` - Homey API client for flows
- [x] Install dev dependencies:
  - [x] `@types/express` (^4.17.0)
- [x] Update package.json scripts

**Time estimate:** ✅ Complete

### 1.3 Folder Structure Creation ✅

Create `lib/` directory with:
- [x] `lib/types.ts` - TypeScript interfaces
- [x] `lib/flow-manager.ts` - Flow discovery & execution

**Time estimate:** ✅ Complete

### 1.4 TypeScript Interfaces (lib/types.ts) ✅

Define core interfaces:
- [x] `HomeyFlow` - Homey flow structure
- [x] `MCPTool` - MCP tool schema
- [x] `FlowExecutionResult` - Flow execution result
- [x] `MCPToolCallResult` - MCP tool call result

**Time estimate:** ✅ Complete

### 1.5 Flow Manager (lib/flow-manager.ts) ✅

**Architecture Change:** Discovered that Homey apps CANNOT trigger flows via `HomeyAPI.flow.triggerFlow()` due to security restrictions ("Missing Scopes" error). Changed approach to use **Flow Trigger Cards** instead.

**F-2: Flow Discovery & Filtering**
- [x] Initialize Homey API connection (for discovery only)
- [x] `discoverMCPFlows()` - discover flows using MCP trigger card
- [x] Filter flows where `trigger.id === 'mcp_command_received'`
- [x] Extract command names from `trigger.args.command.name`
- [x] Convert flow metadata to MCP tool schema
- [x] Register commands for autocomplete

**F-3: Flow Execution via Trigger Card**
- [x] `triggerCommand()` - execute flow via trigger card
- [x] Pass command name via tokens
- [x] Return success/failure status
- [x] Error handling and logging

**Time estimate:** ✅ Complete (with architecture pivot)

### 1.6 MCP Server (Integrated in app.ts) ✅

**Architecture Decision:** Integrated MCP server directly into app.ts instead of separate module for simpler MVP.

**F-1: HTTP-Based MCP Server**
- [x] Create Express app
- [x] Setup middleware (body-parser, JSON parsing)
- [x] Implement POST `/mcp` endpoint
  - [x] Handle JSON-RPC 2.0 requests manually
  - [x] Return JSON-RPC responses
- [x] Implement GET `/health` endpoint
- [x] Setup MCP request handlers:
  - [x] `initialize` handler
  - [x] `tools/list` handler - return available tools from flow discovery
  - [x] `tools/call` handler - execute flows via trigger card
  - [x] `prompts/list` and `resources/list` handlers (empty for MVP)
- [x] Server lifecycle:
  - [x] Bind to 0.0.0.0:3000 for network access
  - [x] Start listening on app init
- [x] Error handling and logging

**Time estimate:** ✅ Complete

### 1.7 Main App Integration (app.ts) ✅

Update main app class:
- [x] Initialize Express server in `onInit()`
- [x] Initialize FlowManager with trigger card
- [x] Setup autocomplete listener for commands
- [x] Implement flow discovery at startup
- [x] Port hardcoded to 3000 (settings page deferred)
- [x] Start HTTP server on 0.0.0.0:3000
- [x] Handle server start errors
- [x] Add comprehensive logging for debugging
- [x] Test tool `hello_homey` for connectivity validation

**Time estimate:** ✅ Complete

### 1.8 App Configuration (.homeycompose/app.json) ✅

- [x] Add required permissions:
  - [x] `homey:manager:api` - for flow discovery
- [x] Create flow trigger card definition in `.homeycompose/flow/triggers/mcp_command_received.json`
  - [x] Autocomplete field for command selection
  - [x] Token output for command name
  - [x] English and Dutch translations
- [x] Run `homey app build` to generate final app.json
- [ ] Add settings page registration (deferred to Phase 3)
- [ ] Add app icon/images (deferred)

**Time estimate:** ✅ Complete (partial - MVP scope)

### 1.9 Settings Page (settings/index.html)

**Status:** Deferred to Phase 3 for MVP simplification

Create settings UI:
- [ ] Create `settings/` directory
- [ ] Create `settings/index.html`
- [ ] Display server status (running/stopped)
- [ ] Display server URL with Copy button
- [ ] List of exposed flows with MCP triggers
- [ ] Setup instructions section
- [ ] CSS styling for clean UI

**Time estimate:** 1-2 hours (Phase 3)

### 1.10 Build & Local Testing ✅

- [x] Run TypeScript build: `npm run build`
- [x] Fix compilation errors (HomeyAPI import, MCP SDK types)
- [x] Run `homey app build` to generate app.json
- [x] Install app to local Homey Pro
- [x] Use `homey app run --remote` for live debugging
- [x] Test with Claude Desktop using mcp-remote

**Time estimate:** ✅ Complete (with debugging iterations)

---

## Fase 2: Testing & Validation (Weekend 1 - Day 2)

**Goal:** Validate flow discovery and execution end-to-end

### 2.1 Create Test Flow ✅

- [x] Create test flow in Homey app with MCP trigger card
- [x] Flow name: `mcp_toggle_kitchen_ledstrip`
- [x] Command: `toggle_led_light_kitchen`
- [x] Flow action: Toggle LED strip device
- [x] Verify flow appears in Homey

**Time estimate:** ✅ Complete

### 2.2 Server Testing ✅

Test MCP endpoints:
- [x] Tested health check endpoint
- [x] Tested hello_homey tool via Claude Desktop (SUCCESS)
- [x] Proved HTTP connectivity between laptop and Homey Pro
- [x] Verified JSON-RPC 2.0 protocol working
- [x] Tested flow discovery with actual flows
- [x] Tested flow execution via tools/call (kitchen LED toggle SUCCESS)
- [x] Tested parameter passing (radio stream with URL and name)

**Time estimate:** ✅ Complete

### 2.3 Claude Desktop Integration ✅

- [x] Find Homey Pro IP address (10.7.7.124)
- [x] Locate Claude Desktop config file (Windows AppData)
- [x] Add Homey MCP server to config using mcp-remote:
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
- [x] Restart Claude Desktop
- [x] Test hello_homey tool (SUCCESS)
- [x] Verify discovered flows appear in tools list
- [x] Test flow execution from Claude (toggle kitchen LED - SUCCESS)
- [x] Check flow execution in Homey timeline

**Note:** Using mcp-remote as stdio-to-HTTP bridge with --allow-http flag for non-localhost HTTP.

**Time estimate:** ✅ Complete

### 2.4 Production Bug Fixes ✅

Critical bugs discovered and fixed during production testing:

**Bug #1: Flow Recognition Not Working**
- [x] Problem: Flows weren't being recognized/triggered properly
- [x] Root Cause: No run listener to validate command arguments
- [x] Fix: Added run listener that compares configured vs triggered command
- [x] Result: Only flows with matching commands execute

**Bug #2: Trigger ID Mismatch**
- [x] Problem: Flow discovery found no flows despite them existing
- [x] Root Cause: Expected `mcp_command_received` but Homey uses full URI `homey:app:nl.vmcc.homeymcpserver:mcp_command_received`
- [x] Fix: Support three formats (short, full URI, endsWith pattern)
- [x] Result: Flow discovery works reliably

**Bug #3: Advanced Flows Not Discovered**
- [x] Problem: Only regular flows appeared, Advanced Flows missing
- [x] Root Cause: Only calling `getFlows()`, not `getAdvancedFlows()`
- [x] Fix: Call both APIs and combine results
- [x] Result: Both flow types now discovered

**Bug #4: Parameter Order Unpredictable**
- [x] Problem: Parameters arrived in wrong order (streamName in value1, streamUrl in value2)
- [x] Root Cause: Using `Object.values()` which has unpredictable order
- [x] Fix: Cache parameter order from flow description, use Map for lookup
- [x] Result: Parameters always map to correct tokens

**Bug #5: Undefined Token Error**
- [x] Problem: Error "Expected string but got undefined" for value3
- [x] Root Cause: Homey expects ALL defined tokens to have values
- [x] Fix: Always provide value1-5 tokens, even if empty strings
- [x] Result: No more undefined token errors

**Bug #6: Text vs Autocomplete Type Mismatch**
- [x] Problem: User wanted text field but got "Invalid type" error
- [x] Root Cause: Discovery code expected autocomplete object format
- [x] Fix: Changed trigger card to text type, simplified extraction
- [x] Result: Command field is simple text input

**Time estimate:** ✅ Complete (6 hours debugging + fixes)

### 2.5 HTTP-based MCP Optimization ✅

Optimizations after discovering HTTP transport limitations:

**Removed Unnecessary Polling:**
- [x] Removed 30-second automatic flow polling
- [x] Reason: HTTP can't push notifications anyway, waste of resources
- [x] Removed `listChanged: true` capability declaration
- [x] Result: Less overhead, cleaner architecture

**Added Workaround Tools:**
- [x] `refresh_homey_flows` tool - manual flow list refresh
- [x] `trigger_any_flow` tool - generic fallback for new flows
- [x] Enhanced refresh response with detailed parameter info
- [x] Result: Claude can use new flows immediately without new chat

**Documentation:**
- [x] HTTP limitations clearly documented
- [x] Workaround workflow explained
- [x] User guidance improved

**Time estimate:** ✅ Complete (2 hours)

### 2.6 Error Handling & Edge Cases

- [ ] Test with no flows using MCP trigger
- [ ] Test with flow that doesn't exist
- [ ] Test rapid successive calls
- [ ] Test server restart
- [ ] Test network disconnection scenarios
- [ ] Verify error messages are clear

**Time estimate:** 1 hour

---

## Fase 3: Polish & Documentation (Week 2)

### 3.1 Enhanced Error Handling

- [ ] Better error messages to users
- [ ] Proper HTTP status codes
- [ ] Don't expose internal errors
- [ ] Log detailed errors for debugging
- [ ] Graceful degradation

**Time estimate:** 1-2 hours

### 3.2 Logging & Debugging

- [ ] Add debug mode setting
- [ ] Log all MCP requests (when debug enabled)
- [ ] Log flow executions
- [ ] Log server lifecycle events
- [ ] Ensure no sensitive data in logs

**Time estimate:** 1 hour

### 3.3 Settings Page Improvements

- [ ] Add API key generation (optional security)
- [ ] Show connection status indicator
- [ ] Add test connection button
- [ ] Better flow list formatting
- [ ] Add donation links section
- [ ] Improve mobile responsiveness

**Time estimate:** 2 hours

### 3.4 Documentation

- [ ] Update README.txt → README.md
- [ ] Add quick start guide
- [ ] Add flow naming convention guide
- [ ] Add Claude Desktop setup instructions
- [ ] Add troubleshooting section
- [ ] Add example flows
- [ ] Add network setup guide

**Time estimate:** 2-3 hours

### 3.5 App Store Preparation

- [ ] Create app icon (SVG, 500x500)
- [ ] Create screenshots for store
- [ ] Write app store description
- [ ] Update changelog
- [ ] Version bump to 0.1.0-beta
- [ ] Test installation from scratch
- [ ] Submit to Homey App Store

**Time estimate:** 2-3 hours

---

## Fase 4: Advanced Features (Stretch Goals / Future)

### 4.1 Parameter Support (F-4) ✅

**COMPLETED** - Full parameter support implemented!

**Parameter Syntax Design:**
- [x] Syntax: `paramName: type(validation)? - description`
- [x] Examples:
  - `streamUrl: string - Radio stream URL`
  - `volume: number(0-100)? - Volume level`
  - `mode: string(on|off|auto) - Device mode`
- [x] Required by default, `?` for optional
- [x] Validation: number ranges, string enums

**Implementation:**
- [x] Parse parameter definitions from flow description field
- [x] Generate JSON Schema (type, min/max, enum, required)
- [x] Map parameters to tokens (value1-5, max 5 parameters)
- [x] Token mapping by ORDER from description (not Object.values)
- [x] Always provide all 5 tokens (empty strings for unused)
- [x] Validate parameter types in parser
- [x] Pass parameters via trigger card tokens

**Token Architecture:**
- [x] Tokens must be statically defined in manifest (Homey UI limitation)
- [x] Using pre-defined tokens: value1, value2, value3, value4, value5
- [x] Parameters mapped by order: first param → value1, second → value2, etc.
- [x] Flow description shows mapping: `streamUrl=[[value1]], streamName=[[value2]]`

**Testing:**
- [x] Tested with radio stream flow (streamUrl, streamName)
- [x] Tested parameter order consistency
- [x] Tested with missing parameters (empty strings)
- [x] Tested validation (number ranges, string enums)

**Documentation:**
- [x] Created [parameters-guide.md](./parameters-guide.md) - User guide
- [x] Created [parameters-implementation.md](./parameters-implementation.md) - Technical details
- [x] Updated trigger card with parameter examples

**Time estimate:** ✅ Complete (4 hours implementation + 2 hours debugging)

### 4.2 API Key Authentication (S-2)

- [ ] Add API key setting
- [ ] Generate random API key
- [ ] Add middleware to check X-API-Key header
- [ ] Update settings page with API key display
- [ ] Document how to add key to Claude config
- [ ] Test with and without key

**Time estimate:** 2 hours

### 4.3 Advanced Features

- [ ] Flow refresh on flow changes (webhook/polling)
- [ ] Support for flow folders
- [ ] Rate limiting
- [ ] Multiple server instances
- [ ] Support for Homey Cloud
- [ ] Advanced flow parameters
- [ ] Flow creation via MCP (read/write)

**Time estimate:** TBD

---

## Testing Checklist (from PRD Section 9.1)

### Network Setup
- [ ] Install app on Homey Pro
- [ ] Note Homey Pro's IP address
- [ ] Verify HTTP server starts on correct port
- [ ] Check server URL in app settings

### Flow Setup
- [ ] Create test flow: `mcp_radio_toggle`
- [ ] Verify flow appears in app settings
- [ ] Confirm tool name conversion correct (`radio_toggle`)

### Claude Desktop Config
- [ ] Find Claude Desktop config file location
- [ ] Add Homey MCP server URL
- [ ] Restart Claude Desktop
- [ ] Verify Claude shows connected status

### Basic Communication
- [ ] Ask Claude "What tools do you have access to?"
- [ ] Verify Homey tools appear in list
- [ ] Check tool descriptions are clear

### Flow Execution
- [ ] Ask Claude "Turn on radio"
- [ ] Verify flow executes on Homey
- [ ] Check Claude receives success confirmation
- [ ] Verify actual device state changed (if applicable)
- [ ] Check flow execution in Homey app timeline

### Error Handling
- [ ] Try executing non-existent flow
- [ ] Check error message is clear
- [ ] Verify server doesn't crash
- [ ] Test with invalid parameters

### Network Testing
- [ ] Test from same device (localhost)
- [ ] Test from different device on network
- [ ] Verify connection works across WiFi
- [ ] Test with laptop on different subnet (if applicable)

### Settings Testing
- [ ] Change port number
- [ ] Restart app
- [ ] Verify server runs on new port
- [ ] Update Claude config with new port
- [ ] Test connection still works

---

## Implementation Order Summary

### Weekend Day 1 (Saturday) - Core Implementation
1. ✅ **Project Setup** (Complete)
2. **Dependencies Installation** (30 min)
3. **Folder Structure** (10 min)
4. **TypeScript Interfaces** (45 min)
5. **Flow Manager** (2-3 hours)
6. **MCP Server** (2-3 hours)

**Estimated total: 6-8 hours**

### Weekend Day 2 (Sunday) - Integration & Testing
7. **App Integration** (1 hour)
8. **App Configuration** (30 min)
9. **Settings Page** (1-2 hours)
10. **Build & Testing** (2-3 hours)

**Estimated total: 5-7 hours**

### Week 2 - Polish
11. **Error Handling & Logging** (2-3 hours)
12. **Documentation** (2-3 hours)
13. **App Store Prep** (2-3 hours)

**Estimated total: 6-9 hours**

---

## Critical Architectural Discoveries

### Session 1: Flow Trigger Architecture (Key Discovery)

**Problem Encountered:** Initial approach attempted to use `HomeyAPI.flow.triggerFlow()` to execute flows directly. This failed with "Missing Scopes" error.

**Root Cause:** Homey apps are intentionally restricted from triggering arbitrary flows via API for security reasons. The `triggerFlow()` method requires scopes that apps cannot obtain.

**Solution:** Use **Flow Trigger Cards** instead:
1. App defines a trigger card in `.homeycompose/flow/triggers/`
2. Users add this trigger card to their flows in Homey
3. Users configure the command name in the trigger card's autocomplete field
4. App triggers the card with `triggerCard.trigger(tokens, state)`
5. All flows using this trigger card with matching command execute

**Benefits:**
- Works within Homey's security model
- Better UX - users see triggers in flow editor
- Native Homey approach
- Enables parameter support (via tokens)
- Autocomplete for command discovery

**Implementation:**
- Created `mcp_command_received` trigger card
- FlowManager discovers flows using this trigger via HomeyAPI
- Extracts command names from `flow.trigger.args.command.name`
- Dynamically exposes discovered commands as MCP tools

### Claude Desktop HTTP Connection

**Challenge:** Claude Desktop MCP uses stdio transport, but our server uses HTTP (required for cross-device communication).

**Solution:** Use `mcp-remote` package as bridge:
```json
{
  "command": "npx",
  "args": ["-y", "mcp-remote", "http://10.7.7.124:3000/mcp", "--allow-http"]
}
```

**Note:** `--allow-http` flag required for non-localhost HTTP endpoints.

### Session 2: Parameters & Token Mapping (Critical Implementation)

**Challenge:** How to pass parameters to flows when Homey tokens must be statically defined in manifest?

**Initial Attempt:**
- Tried to create dynamic tokens based on parameter names
- Example: `streamUrl` → `[[streamUrl]]` token

**Problem Discovered:**
- Homey UI only shows tokens that are **statically defined in manifest**
- Dynamic tokens don't appear in the token selector UI
- User couldn't find custom parameter tokens in flow editor

**Solution:**
- Pre-define 5 generic tokens: `value1`, `value2`, `value3`, `value4`, `value5`
- Map parameters by ORDER from flow description
- Example: `streamUrl: string - URL` → `[[value1]]`
- Example: `streamName: string - Name` → `[[value2]]`

**Critical Bug - Parameter Order:**
- Problem: `Object.values(parameters)` has unpredictable order in JavaScript
- Result: `streamUrl` ended up in value2, `streamName` in value1 (reversed!)
- Fix: Cache parameter order from flow description parsing in `Map<string, string[]>`
- Use cached order during token mapping: `parameterOrder.forEach((name, index) => ...)`

**Critical Bug - Missing Tokens:**
- Problem: Only provided tokens for used parameters (e.g., value1, value2)
- Error: "Expected string but got undefined" for value3
- Root Cause: Homey requires ALL tokens defined in manifest to have values
- Fix: Always provide all 5 tokens, use empty strings for unused ones

**Benefits:**
1. ✅ Works within Homey's token architecture
2. ✅ Reliable parameter order (cached from description)
3. ✅ Up to 5 parameters supported
4. ✅ Clear mapping shown to users in tool description
5. ✅ No undefined token errors

### Session 2: HTTP-based MCP Limitations

**Discovery:** HTTP transport cannot push notifications to clients (request-response only)

**Original Approach:**
- 30-second polling to detect flow changes
- `listChanged: true` capability
- Log changes but couldn't notify Claude

**Problem:**
- Polling wastes resources
- Claude never sees the changes anyway (needs new chat)
- Unnecessary overhead every 30 seconds

**Solution - Workaround Tools:**
1. **`refresh_homey_flows` tool:**
   - Manual refresh of flow list
   - Returns detailed parameter information
   - Tells Claude about `trigger_any_flow` workaround

2. **`trigger_any_flow` tool:**
   - Generic tool that can trigger ANY command by name
   - Works even if command not in current tool list
   - Accepts command name + parameters object
   - Enables immediate use of new flows without new chat

**Workflow:**
1. User creates new flow with MCP trigger
2. Claude calls `refresh_homey_flows`
3. Sees new flow exists but not in tool list
4. Uses `trigger_any_flow` to execute it immediately
5. Or user starts new chat to see dedicated tool

**Benefits:**
1. ✅ No wasted resources (no polling)
2. ✅ Claude can use new flows immediately
3. ✅ Explicit refresh when needed
4. ✅ Cleaner architecture

## Progress Log

### 2025-10-24 - Day 1 (Morning/Afternoon)
- ✅ Installed Homey CLI (v3.9.6)
- ✅ Created Homey app project: `nl.vmcc.homeymcpserver`
- ✅ Configured TypeScript, ESLint, GitHub workflows
- ✅ Created implementation plan (this document)
- ✅ Installed dependencies (express, body-parser, MCP SDK, homey-api)
- ✅ Created lib/types.ts and lib/flow-manager.ts
- ✅ Implemented MCP server in app.ts
- ✅ Created flow trigger card definition
- ✅ Proved HTTP connectivity with hello_homey test tool
- ✅ Discovered flow trigger API limitation
- ✅ Pivoted to flow trigger card architecture
- ✅ Implemented flow discovery from Homey flows
- ✅ Built and deployed to Homey Pro
- ✅ Configured Claude Desktop integration

### 2025-10-24 - Day 1 (Evening/Night) - Production Testing & Bug Fixes
- ✅ **First successful flow execution!** (kitchen LED toggle)
- ✅ Discovered and fixed URI format mismatch bug
- ✅ Added Advanced Flows support
- ✅ Implemented run listener for command matching
- ✅ **Parameters feature requested by user**
- ✅ Designed parameter syntax with user feedback
- ✅ Implemented full parameter support with token mapping
- ✅ Fixed parameter order consistency bug
- ✅ Fixed undefined token error (all tokens required)
- ✅ Changed command field from autocomplete to text (user preference)
- ✅ Added `trigger_any_flow` tool for HTTP workaround
- ✅ Added `refresh_homey_flows` tool
- ✅ Removed unnecessary 30-second polling
- ✅ **Tested radio stream flow with parameters** (streamUrl, streamName)
- ✅ Created comprehensive documentation (parameters guide, implementation docs)
- **Status:** Production ready, active testing with real flows and parameters

---

## Notes & Decisions

### Technical Decisions
- **Transport:** HTTP with JSON-RPC 2.0 (single `/mcp` endpoint)
- **Claude Integration:** mcp-remote bridge for stdio-to-HTTP conversion
- **Port:** 3000 (hardcoded for MVP, configurable in future)
- **Flow Discovery:** Scan all flows for `mcp_command_received` trigger card usage
- **Command Naming:** User-defined in flow trigger card autocomplete field
- **MVP scope:** Flow discovery and execution only, settings page deferred
- **Architecture:** Flow trigger cards (not direct API triggering)

### Resolved Questions
- ✅ How to trigger flows? Use trigger cards (API method blocked by scopes)
- ✅ How to discover flows? Scan via HomeyAPI for flows using our trigger card
- ✅ Flow prefix needed? No - users specify command names explicitly in trigger card
- ✅ Cross-device HTTP? Yes, proven working with mcp-remote bridge

### Resolved Questions (Session 2)
- ✅ Parameter passing? **IMPLEMENTED** - Full parameter support with token mapping
- ✅ Flow refresh strategy? Manual via `refresh_homey_flows` tool (no polling)
- ✅ Text vs autocomplete? Text field (user preference)
- ✅ Parameter order? Cached from flow description in Map
- ✅ Dynamic tokens? Not supported by Homey UI, using value1-5 mapping

### Open Questions
- [ ] Rate limiting needed? (Deferred, assess after extended testing)
- [ ] API key authentication? (Optional, Phase 4)

### Resources
- PRD: [docs/PRD.md](./PRD.md)
- Homey SDK: https://apps.developer.homey.app
- MCP Spec: https://modelcontextprotocol.io
- MCP SDK: https://github.com/modelcontextprotocol/typescript-sdk

---

**Last Updated:** 2025-10-24 (Late Night)
**Status:** Phase 1 & 2 Complete, Phase 4.1 (Parameters) Complete - Production Ready
**Current Focus:** Extended testing with real-world flows and parameters
**Next Milestone:** App Store preparation and documentation polish
