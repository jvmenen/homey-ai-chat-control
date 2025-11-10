# Progressive Disclosure: Design & Implementation Plan

**Doel**: Reduceer context load door tools on-demand te laden i.p.v. alle 14 tools vooraf in `tools/list`.

---

## Probleem Statement

**Huidige situatie**:
```
Claude → tools/list
       ← 14 tool definitions (~3000 tokens)
```

**Met naive search_tools toevoeging**:
```
Claude → tools/list
       ← 15 tool definitions (~3200 tokens)  ❌ ERGER!
```

**Gewenste situatie**:
```
Claude → tools/list
       ← 2-3 discovery tools (~400 tokens)  ✅

Claude → search_tools("lights")
       ← Metadata van 2 matching tools (~200 tokens)

Claude → set_light(...)
       ← Execution result
```

---

## Design Opties

### ❌ Optie A: Volledige Anthropic Pattern (NIET HAALBAAR zonder code executor)
In Anthropic blog zijn tools GEEN MCP tools, maar modules in een code execution environment:
- Tools zijn files: `./servers/homey/setLight.ts`
- Claude schrijft code: `const result = await setLight(...)`
- Vereist volledige code execution sandbox

**Verdict**: Niet haalbaar op Homey (zie hardware constraints analyse).

---

### ⚠️ Optie B: Two-Phase MCP Pattern
**Phase 1**: Discovery via search tool
```typescript
// tools/list retourneert alleen:
{ name: "search_tools", ... }
{ name: "get_tool_definition", ... }
```

**Phase 2**: Load + Execute
```typescript
// 1. Search
search_tools({ query: "lights" })
→ Returns: ["set_light", "control_zone_lights"]

// 2. Get definition
get_tool_definition({ name: "set_light" })
→ Returns: { name: "set_light", inputSchema: {...}, description: "..." }

// 3. Execute (normale tools/call)
tools/call { name: "set_light", arguments: {...} }
→ Returns: execution result
```

**Probleem**: MCP protocol verwacht dat tools in `tools/list` staan voordat je ze kunt aanroepen via `tools/call`. Als `set_light` niet in de lijst staat, kan Claude het niet aanroepen.

**Workaround**: `get_tool_definition` retourneert definitie EN registreert tool server-side zodat volgende `tools/list` het includeert (session state).

---

### ✅ Optie C: Meta-Tool Pattern (MEEST PRAKTISCH)
Combineer discovery + execution in één tool:

```typescript
// tools/list retourneert:
{ name: "discover_and_use_tool", ... }
{ name: "get_home_structure", ... }  // Core tool - altijd beschikbaar
{ name: "get_states", ... }          // Core tool - altijd beschikbaar
```

**Discovery flow**:
```typescript
discover_and_use_tool({
  action: "search",
  query: "lights"
})

→ Returns:
{
  tools: [
    { name: "set_light", description: "...", tags: ["control", "lights"] },
    { name: "control_zone_lights", description: "...", tags: [...] }
  ]
}
```

**Execution flow**:
```typescript
discover_and_use_tool({
  action: "execute",
  tool_name: "set_light",
  tool_args: { device_id: "abc", brightness: 80 }
})

→ Returns: <normal tool execution result>
```

**Voordelen**:
- ✅ Werkt binnen MCP protocol constraints
- ✅ Geen session state nodig
- ✅ Alle 14 tools zijn "verborgen" achter meta-tool
- ✅ Context saving: 3 tools i.p.v. 14 in tools/list

**Nadelen**:
- ⚠️ Minder idiomatisch MCP (tools zijn niet direct in tools/list)
- ⚠️ Claude moet twee-staps flow leren (search → execute)
- ⚠️ Extra hop voor elke tool execution

---

### ✅ Optie D: Hybrid Pattern (GEBALANCEERD)
Combineer direct + meta-tool:

```typescript
// tools/list retourneert:
// Category 1: Core tools (altijd direct beschikbaar)
{ name: "get_home_structure", ... }
{ name: "get_states", ... }
{ name: "trigger_any_flow", ... }

// Category 2: Discovery voor rest
{ name: "search_tools", ... }
{ name: "use_tool", ... }  // Execute discovered tool
```

**Core tools** (3-4 stuks):
- Meest gebruikte tools
- Informational tools (geen side effects)
- Tools die vaak als eerste stap nodig zijn

**Discovered tools** (10-11 stuks):
- Control tools (set_light, control_device, etc.)
- Data-intensive tools (get_insight_data)
- Specialized tools

**Flow voor core tool**:
```typescript
// Direct gebruik - normale MCP flow
get_home_structure({})
```

**Flow voor discovered tool**:
```typescript
// 1. Search (optioneel - als je niet weet welke tool)
search_tools({ query: "lights" })
→ ["set_light", "control_zone_lights"]

// 2. Execute via use_tool
use_tool({
  name: "set_light",
  arguments: { device_id: "abc", brightness: 80 }
})
```

**Voordelen**:
- ✅ Beste van beide werelden
- ✅ Geen impact op frequently used tools
- ✅ ~7-8 tool definitions i.p.v. 14 in tools/list (~40% reductie)
- ✅ Progressive voor advanced use cases

---

## Aanbevolen Keuze: Optie D (Hybrid Pattern)

### Implementation Plan

#### Fase 1: Tool Categorization
**Doel**: Bepaal welke tools core vs discovered zijn

**Core tools** (direct in tools/list):
1. `get_home_structure` - bijna altijd eerste stap
2. `get_states` - meest gebruikt voor queries
3. `trigger_any_flow` - veel gebruikt voor actions
4. `get_flow_overview` - flow discovery

**Discovered tools** (via meta-tools):
1. Control tools: `set_light`, `set_thermostat`, `control_device`, `toggle_device`
2. Zone control: `control_zone_lights`, `control_zone_capability`
3. Insights: `get_insight_logs`, `get_insight_data`
4. Apps: `get_installed_apps`
5. Flows: `refresh_homey_flows`

---

#### Fase 2: Tool Metadata Registry

**File**: `src/nl.joonix.aichatcontrol/lib/tools/tool-metadata.ts`

```typescript
export interface ToolMetadata {
  name: string;
  category: 'control' | 'query' | 'insights' | 'flows' | 'apps';
  shortDescription: string;  // 1 zin, ~50 chars
  tags: string[];
  requiresDeviceId?: boolean;
  requiresZoneId?: boolean;
}

export const TOOL_METADATA: Record<string, ToolMetadata> = {
  set_light: {
    name: 'set_light',
    category: 'control',
    shortDescription: 'Control light brightness, color, and power state',
    tags: ['lights', 'control', 'brightness', 'color'],
    requiresDeviceId: true
  },
  control_zone_lights: {
    name: 'control_zone_lights',
    category: 'control',
    shortDescription: 'Control all lights in a zone simultaneously',
    tags: ['lights', 'control', 'zone', 'bulk'],
    requiresZoneId: true
  },
  // ... rest of tools
};
```

---

#### Fase 3: Search Tools Implementation

**File**: `src/nl.joonix.aichatcontrol/lib/tools/search-tools-tool.ts`

```typescript
export class SearchToolsTool extends BaseTool {
  readonly name = 'search_tools';

  constructor(private toolMetadata: Record<string, ToolMetadata>) {
    super();
  }

  getDefinition(): MCPTool {
    return {
      name: 'search_tools',
      description:
        'Search for available Homey control and query tools. ' +
        'Use this to discover tools for specific tasks (e.g., controlling lights, ' +
        'getting sensor data, managing flows). Returns tool names and descriptions.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Search query (e.g., "lights", "temperature", "flows"). ' +
              'Searches in tool names, descriptions, and tags.'
          },
          category: {
            type: 'string',
            enum: ['control', 'query', 'insights', 'flows', 'apps'],
            description: 'Optional: filter by tool category'
          }
        },
        required: ['query']
      }
    };
  }

  async execute(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    const query = (args.query as string).toLowerCase();
    const category = args.category as string | undefined;

    // Search through metadata
    const results = Object.values(this.toolMetadata)
      .filter(meta => {
        // Category filter
        if (category && meta.category !== category) return false;

        // Text search
        const searchText = `${meta.name} ${meta.shortDescription} ${meta.tags.join(' ')}`.toLowerCase();
        return searchText.includes(query);
      })
      .map(meta => ({
        name: meta.name,
        description: meta.shortDescription,
        category: meta.category,
        tags: meta.tags
      }));

    return this.createSuccessResponse(
      XMLFormatter.formatToolSearchResults(results)
    );
  }
}
```

---

#### Fase 4: Use Tool Implementation

**File**: `src/nl.joonix.aichatcontrol/lib/tools/use-tool-tool.ts`

```typescript
export class UseToolTool extends BaseTool {
  readonly name = 'use_tool';

  constructor(
    private toolRegistry: ToolRegistry,
    private toolMetadata: Record<string, ToolMetadata>
  ) {
    super();
  }

  getDefinition(): MCPTool {
    return {
      name: 'use_tool',
      description:
        'Execute a discovered tool by name. Use search_tools first to find available tools, ' +
        'then use this to execute them. Supports all Homey control and query operations.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Tool name (from search_tools results)'
          },
          arguments: {
            type: 'object',
            description: 'Tool-specific arguments as a JSON object'
          }
        },
        required: ['name', 'arguments']
      }
    };
  }

  async execute(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    const toolName = args.name as string;
    const toolArgs = (args.arguments as Record<string, unknown>) || {};

    // Check if tool exists in metadata
    if (!this.toolMetadata[toolName]) {
      return this.createErrorResponse(
        `Tool '${toolName}' not found. Use search_tools to discover available tools.`
      );
    }

    // Delegate to tool registry
    return await this.toolRegistry.execute(toolName, toolArgs);
  }
}
```

---

#### Fase 5: Modified Tool Registry

**File**: `src/nl.joonix.aichatcontrol/lib/tools/tool-registry.ts`

```typescript
export class ToolRegistry {
  private tools: Map<string, MCPToolHandler> = new Map();
  private coreTools: Set<string> = new Set([
    'get_home_structure',
    'get_states',
    'trigger_any_flow',
    'get_flow_overview'
  ]);

  /**
   * Get tool definitions for MCP tools/list
   * Only returns core tools + meta tools (search_tools, use_tool)
   */
  getAllDefinitions(): MCPTool[] {
    const definitions: MCPTool[] = [];

    // Add core tools
    for (const [name, tool] of this.tools.entries()) {
      if (this.coreTools.has(name)) {
        definitions.push(tool.getDefinition());
      }
    }

    // Add meta tools (search_tools, use_tool)
    // These are added separately, not from normal tool registry

    return definitions;
  }

  /**
   * Get ALL tool definitions (for search/discovery)
   */
  getAllToolsIncludingHidden(): MCPTool[] {
    return Array.from(this.tools.values()).map(t => t.getDefinition());
  }

  // ... rest stays the same
}
```

---

#### Fase 6: Update App Registration

**File**: `src/nl.joonix.aichatcontrol/app.ts`

```typescript
// Initialize Tool Registry
this.toolRegistry = new ToolRegistry();

// Register ALL tools (core + discovered)
this.toolRegistry.register(new RefreshFlowsTool(...));
this.toolRegistry.register(new TriggerAnyFlowTool(...));
// ... all 14 tools

// Initialize tool metadata
const toolMetadata = TOOL_METADATA; // imported

// Register meta-tools
this.toolRegistry.register(new SearchToolsTool(toolMetadata));
this.toolRegistry.register(new UseToolTool(this.toolRegistry, toolMetadata));

// Mark core tools
this.toolRegistry.markAsCore([
  'get_home_structure',
  'get_states',
  'trigger_any_flow',
  'get_flow_overview'
]);
```

---

## Expected Impact

**Token Savings**:
```
Voor progressive disclosure:
- tools/list: 14 tools → 6 tools (4 core + 2 meta)
- ~3000 tokens → ~1200 tokens
- Reductie: ~60% voor initial context

Na discovery (worst case):
- Claude gebruikt search_tools: +200 tokens
- Claude gebruikt 3 discovered tools via use_tool: +600 tokens
- Totaal: 1200 + 200 + 600 = 2000 tokens
- Reductie vs huidige: ~33%

Gemiddeld scenario (2 tool uses):
- 1200 + 200 + 400 = 1800 tokens
- Reductie: ~40%
```

**Extra Latency**:
- Search: +1 round-trip (~200-500ms)
- Elke use_tool: +0ms (intern routed naar tool registry)
- Totaal: ~200-500ms per conversation (one-time search cost)

---

## Testing Checklist

- [ ] tools/list retourneert alleen 6 tools
- [ ] search_tools vindt juiste tools voor query "lights"
- [ ] search_tools vindt juiste tools voor query "temperature"
- [ ] search_tools category filter werkt
- [ ] use_tool kan set_light correct uitvoeren
- [ ] use_tool geeft correcte error voor onbekende tool
- [ ] Core tools (get_home_structure) werken nog via normale tools/call
- [ ] Backwards compatibility: oude clients die alle tools verwachten

---

## Rollout Strategy

**Week 1**: Implementeer metadata + search_tools
**Week 2**: Implementeer use_tool + test
**Week 3**: Update documentatie + beta release
**Week 4**: Monitor metrics + iterate

**Rollback plan**: Feature flag `ENABLE_PROGRESSIVE_DISCLOSURE` in constants. Als false, gebruik oude getAllDefinitions().

---

## Open Questions

1. **Should core tools be configurable?** (e.g., user preference or auto-detected based on usage)
2. **Caching strategy?** (search results, tool definitions)
3. **Telemetry?** (track which tools are discovered vs used directly)
4. **Documentation for Claude?** (system prompt explaining two-phase flow)
