# MCP Code Execution: Analyse & Aanbevelingen

**Datum**: 2025-11-10
**Bron**: [Anthropic Engineering Blog - Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp)

## Executive Summary

De Homey MCP server gebruikt momenteel een **traditionele direct tool call pattern**. Volgens recente aanbevelingen van Anthropic kan een **code execution pattern** leiden tot:
- **98,7% reductie in token-gebruik** (van 150.000 naar 2.000 tokens in voorbeeldcase)
- Lagere kosten en latentie
- Betere privacy
- Meer flexibiliteit voor AI agents

Dit document analyseert onze huidige implementatie en presenteert concrete verbetermogelijkheden.

---

## 1. Huidige Implementatie: Stand van Zaken

### 1.1 Architectuur
```
┌─────────────┐
│   Claude    │
└──────┬──────┘
       │ tools/list → ALLE tool definities
       │ tools/call → Volledige datasets
       ▼
┌─────────────┐
│ MCP Server  │
│   Manager   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    Tool     │ 14 geregistreerde tools
│  Registry   │ (alle vooraf geladen)
└─────────────┘
```

**Locatie**: `src/nl.joonix.aichatcontrol/lib/managers/mcp-server-manager.ts:109-131`

### 1.2 Geregistreerde Tools (14 stuks)
```typescript
// app.ts:100-113
this.toolRegistry.register(new RefreshFlowsTool(...));
this.toolRegistry.register(new TriggerAnyFlowTool(...));
this.toolRegistry.register(new HomeStructureTool(...));
this.toolRegistry.register(new GetStatesTool(...));
this.toolRegistry.register(new GetFlowOverviewTool(...));
this.toolRegistry.register(new GetInstalledAppsTool(...));
this.toolRegistry.register(new ControlDeviceTool(...));
this.toolRegistry.register(new ToggleDeviceTool(...));
this.toolRegistry.register(new SetLightTool(...));
this.toolRegistry.register(new SetThermostatTool(...));
this.toolRegistry.register(new ControlZoneLightsTool(...));
this.toolRegistry.register(new ControlZoneCapabilityTool(...));
this.toolRegistry.register(new GetInsightLogsTool(...));
this.toolRegistry.register(new GetInsightDataTool(...));
```

### 1.3 Tools/List Gedrag
Bij elke `tools/list` call worden **ALLE 14 tool definities** inclusief volledige descriptions en input schemas naar de LLM gestuurd.

**Probleem**: Zelfs als de agent maar 1-2 tools nodig heeft, wordt de context belast met alle 14 definities.

### 1.4 Data Return Pattern
Voorbeeld: `GetInsightDataTool` (src/nl.joonix.aichatcontrol/lib/tools/get-insight-data-tool.ts:70-114)

```typescript
async execute(args: Record<string, unknown>): Promise<MCPToolCallResult> {
  // Get insight data
  const data = await this.insightsManager.getInsightData(...);

  // Format as XML
  const xmlOutput = XMLFormatter.formatInsightData(data, ...);

  // Return ENTIRE dataset to LLM
  return {
    content: [{ type: 'text', text: xmlOutput }]
  };
}
```

**Probleem**: Grote datasets (bijv. energie-inzichten over een maand) worden volledig door de LLM context gehaald, zelfs als de agent maar een specifiek detail zoekt.

---

## 2. Best Practices uit Anthropic Blog

### 2.1 Het Kernprobleem
Direct tool calls leiden tot twee inefficiënties:

1. **Tool definities overbelasten context**
   - Descriptions, schemas, voorbeelden → honderden tokens per tool
   - Bij 14 tools: duizenden tokens vóór elke conversatie start

2. **Intermediaire resultaten verbruiken tokens**
   - Voorbeeld blogpost: 50.000 tokens voor een 2-uur transcript
   - Moet herhaaldelijk door context heen bij elke follow-up vraag

### 2.2 Aanbevolen Aanpak: Code Execution Pattern

#### Core Concept
Tools presenteren als **codebestanden in een filesystem**:
```
./servers/homey/getHomeStructure.ts
./servers/homey/getInsightData.ts
./servers/homey/controlDevice.ts
```

Agents kunnen:
- Tools **on-demand laden** (alleen wanneer nodig)
- Code **schrijven om data te filteren** vóór return
- **Loops en conditionals** gebruiken zonder round-trips naar LLM

---

## 3. Vijf Kernvoordelen (Toegepast op Homey)

### 3.1 Progressive Disclosure
**Huidig**: 14 tool definities altijd in context
**Nieuwe aanpak**: `search_tools` functie + lazy loading

```javascript
// Agent zoekt: "Welke tools heb ik voor verlichting?"
search_tools("lights")
// → Retourneert alleen: set_light, control_zone_lights

// Agent laadt alleen relevante tool:
loadTool("./servers/homey/setLight.ts")
```

**Impact voor Homey**: ~70-80% reductie in initiële context-belasting

---

### 3.2 Context-efficiënte Resultaten
**Huidig**: GetInsightDataTool retourneert volledige XML

```xml
<insights>
  <log id="energy_meter_1">
    <entry timestamp="2025-11-01T00:00:00Z" value="125.3"/>
    <entry timestamp="2025-11-01T01:00:00Z" value="98.7"/>
    ... (720 entries voor een maand)
  </log>
</insights>
```

**Nieuwe aanpak**: Agent schrijft filter-code
```javascript
const data = await getInsightData(['energy_meter_1'], 'last31Days');

// Filter in execution environment
const highUsage = data.entries
  .filter(e => e.value > 200)
  .slice(0, 10);  // Top 10

return { highUsageHours: highUsage };
```

**Impact**: Alleen gefilterde resultaten (~100 tokens) i.p.v. volledige dataset (10.000+ tokens)

---

### 3.3 Verbeterde Controleflow
**Huidig**: Meerdere tool calls voor sequentiële acties

```
Agent → tools/call set_light (woonkamer, aan)
       ← Result
Agent → tools/call set_light (keuken, aan)
       ← Result
Agent → tools/call set_light (gang, aan)
       ← Result
```

**Nieuwe aanpak**: Loop in code
```javascript
const zones = ['woonkamer', 'keuken', 'gang'];

for (const zone of zones) {
  await setLight(zone, { on: true });
}

return { success: true, zonesUpdated: zones };
```

**Impact**: 1 executie i.p.v. 3 round-trips → 3x sneller, minder tokens

---

### 3.4 Privacy-behoud
**Huidig**: Alle device names, zones, etc. gaan door LLM context

```xml
<device id="123" name="Jan's slaapkamer lamp" zone="Slaapkamer Jan"/>
```

**Nieuwe aanpak**: Tokenization in execution environment
```javascript
const devices = await getHomeStructure();

// Replace PII with tokens
const tokenized = tokenizeDeviceNames(devices);
// "Jan's slaapkamer lamp" → "[DEVICE_1]"

return tokenized;
```

Later bij control:
```javascript
// Agent gebruikt token: controlDevice('[DEVICE_1]', ...)
const actualDevice = detokenize('[DEVICE_1]'); // → "123"
```

**Impact**: Gevoelige data (namen, locaties) blijft server-side

---

### 3.5 State Persistence & Skills
**Huidig**: Geen state tussen calls - elke call is standalone

**Nieuwe aanpak**: Persistent workspace
```javascript
// Agent berekent iets en slaat op:
const monthlyAverage = calculateAverage(energyData);
saveToState('monthlyAverage', monthlyAverage);

// Later, zonder data opnieuw op te halen:
const avg = loadFromState('monthlyAverage');
const comparison = currentUsage / avg;
```

**Impact**:
- Geen herhaalde data-fetches
- Agent kan "leren" van eerdere analyses
- Reusable functions opslaan

---

## 4. Implementatie Overwegingen

### 4.1 Vereisten
Een code execution pattern vereist:

1. **Secure execution environment**
   - Sandboxing (Node.js VM, Docker container, etc.)
   - Resource limits (CPU, memory, timeout)
   - No access to sensitive host system resources

2. **Tool-to-code mapping**
   - Elke tool wordt een importeerbaar module
   - Consistente API (async/await pattern)
   - Type definitions (TypeScript)

3. **Monitoring & logging**
   - Execution time tracking
   - Error capturing
   - Security violation detection

### 4.2 Architectuur Voorstel
```
┌──────────────────┐
│   Claude Agent   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  MCP Server      │
│  - search_tools  │ ← Nieuwe functie
│  - execute_code  │ ← Nieuwe functie
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Code Executor    │
│ (Sandboxed VM)   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Tool Modules    │
│  ./homey/*.ts    │
└──────────────────┘
```

### 4.3 Migratiepad

#### Fase 1: Behoud huidige systeem als fallback
- Beide patterns ondersteunen
- A/B testing mogelijk
- Backwards compatible

#### Fase 2: Implementeer search_tools
```typescript
// mcp-server-manager.ts
case 'tools/search':
  return await this.handleToolsSearch(id, params);

private async handleToolsSearch(
  id: string | number,
  params: { query: string }
): Promise<MCPResponse> {
  const allTools = this.toolRegistry.getAllDefinitions();

  // Simple keyword search
  const results = allTools.filter(tool =>
    tool.name.includes(params.query) ||
    tool.description.includes(params.query)
  );

  return this.createSuccess(id, { tools: results });
}
```

#### Fase 3: Code Executor Service
```typescript
// lib/services/code-executor.ts
export class CodeExecutor {
  private vm: VM; // isolated-vm of vm2

  async execute(code: string, context: ExecutionContext) {
    // 1. Validate code (AST parsing)
    // 2. Setup sandbox with tool imports
    // 3. Run with timeout & resource limits
    // 4. Return results
  }
}
```

#### Fase 4: Tool-as-Module Export
```typescript
// tools/modules/getHomeStructure.ts
export async function getHomeStructure(
  options?: { includeOffline?: boolean }
) {
  const manager = getZoneDeviceManager();
  const structure = await manager.getHomeStructure();

  if (!options?.includeOffline) {
    // Filter offline devices server-side
    structure.devices = structure.devices.filter(d => d.online);
  }

  return structure;
}
```

---

## 5. Prioritering & Impact

### 5.1 High Impact, Medium Effort
✅ **Progressive Disclosure (search_tools)**
- Impact: -50% context tokens bij conversatie start
- Effort: ~2-4 uur implementatie
- Risk: Low (fallback naar huidige system)

### 5.2 High Impact, High Effort
⚠️ **Code Execution Engine**
- Impact: -90% tokens bij data-intensive queries
- Effort: ~1-2 weken (sandboxing, security, testing)
- Risk: Medium (security, backwards compatibility)

### 5.3 Medium Impact, Low Effort
✅ **Server-side Filtering Helpers**
- Impact: -30-50% tokens voor data-heavy tools
- Effort: ~1 dag (add filter parameters to existing tools)
- Risk: Low

Voorbeeld:
```typescript
// Huidige signature:
getInsightData(logIds: string[], resolution?: string)

// Nieuwe signature:
getInsightData(
  logIds: string[],
  resolution?: string,
  filter?: {
    minValue?: number,
    maxValue?: number,
    limit?: number
  }
)
```

### 5.4 Low Priority
⏸️ **State Persistence**
- Impact: -10-20% tokens (alleen bij multi-turn analyse)
- Effort: Medium (storage, lifecycle management)
- Risk: Low

⏸️ **Privacy Tokenization**
- Impact: Privacy-verbetering (geen direct token saving)
- Effort: Medium (tokenization service, mappings)
- Risk: Low
- Note: Minder relevant voor Homey (meestal private deployment)

---

## 6. Concrete Aanbevelingen

### Kortetermijn (1-2 sprints)
1. **Implementeer `search_tools` functionaliteit**
   - Reduces initial context load
   - Non-breaking change
   - Quick win

2. **Voeg filter-parameters toe aan data-heavy tools**
   - `get_insight_data`: limit, dateRange filters
   - `get_states`: deviceIds filter (i.p.v. altijd alles)
   - `get_flow_overview`: filter by enabled/disabled

### Middellangetermijn (3-6 maanden)
3. **Evalueer code execution frameworks**
   - Options: `isolated-vm`, `vm2`, Docker-based
   - Security audit
   - Performance benchmarking

4. **Proof of Concept: Code Executor**
   - Start met 2-3 tools (bijv. `get_insight_data`, `get_home_structure`)
   - Measure token reduction vs. implementation complexity
   - A/B test met bestaande gebruikers

### Langetermijn (6-12 maanden)
5. **Volledig Code Execution Pattern**
   - Alle tools als modules
   - Deprecate direct tool calls (met migration period)
   - State persistence layer

6. **Advanced features**
   - Agent skill library
   - Custom user-defined tools
   - Multi-step automation templates

---

## 7. Risico's & Mitigaties

| Risico | Impact | Mitigatie |
|--------|--------|-----------|
| **Security: Code injection** | Critical | Sandboxing, AST validation, whitelist imports |
| **Performance: Slow execution** | Medium | Timeout limits, caching, resource quotas |
| **Compatibility: Breaking changes** | High | Dual-mode support, gradual migration |
| **Complexity: Developer experience** | Medium | Good docs, examples, debugging tools |
| **Maintenance: Two codepaths** | Low | Phased deprecation of old pattern |

---

## 8. Conclusie

De huidige Homey MCP server is **functioneel en stabiel**, maar niet geoptimaliseerd voor de **efficiëntie die moderne LLMs mogelijk maken**.

**Key Takeaway**: Door een code execution pattern toe te voegen, kunnen we:
- Token-gebruik met **90%+ reduceren** voor data-intensive workflows
- Snelheid verhogen door minder round-trips
- Privacy verbeteren (data blijft server-side)
- Meer geavanceerde use cases ondersteunen

**Advies**: Start met **low-hanging fruit** (progressive disclosure, filters) en evalueer daarna de ROI van een volledige code executor implementatie.

---

## Referenties

- [Anthropic: Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp)
- Huidige code: `src/nl.joonix.aichatcontrol/lib/managers/mcp-server-manager.ts`
- Tool registry: `src/nl.joonix.aichatcontrol/lib/tools/tool-registry.ts`
