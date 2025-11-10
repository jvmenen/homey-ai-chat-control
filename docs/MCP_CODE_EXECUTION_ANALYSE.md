# MCP Code Execution: Analyse & Aanbevelingen

**Datum**: 2025-11-10
**Bron**: [Anthropic Engineering Blog - Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp)

## Executive Summary

De Homey MCP server gebruikt momenteel een **traditionele direct tool call pattern**. Volgens recente aanbevelingen van Anthropic kan een **code execution pattern** leiden tot:
- **98,7% reductie in token-gebruik** (van 150.000 naar 2.000 tokens in voorbeeldcase)
- Lagere kosten en latentie
- Betere privacy
- Meer flexibiliteit voor AI agents

**⚠️ KRITISCHE BEPERKING**: De Homey Pro hardware (2 GB RAM, shared platform) kan **geen volledige code execution** ondersteunen zonder stabiliteitsrisico's.

**Pragmatische aanpak**:
1. **Quick wins op Homey zelf** → ~50-70% token reductie (progressive disclosure, filtering)
2. **Optionele externe executor** → ~90%+ token reductie (vereist extra hardware/cloud)

Dit document analyseert de haalbaarheid en presenteert realistische implementatie-opties.

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

### 4.1 Homey Pro Hardware Constraints ⚠️

**KRITISCHE BEPERKING**: Code execution op de Homey Pro zelf is **waarschijnlijk niet haalbaar**.

#### Hardware Specs (Homey Pro 2023)
```
CPU:     1.8 GHz Quad Core ARMv8 (Raspberry Pi Compute Module 4)
RAM:     2 GB LPDDR4
Storage: 8 GB eMMC
OS:      Linux-based (Homey OS)
Runtime: Node.js (shared met alle Homey apps)
```

#### Waarom Code Execution Problematisch Is

**1. Beperkte RAM (2 GB totaal)**
- Homey OS baseline: ~300-500 MB
- Andere apps draaien tegelijkertijd (10-50+ apps is normaal)
- Elke app: 20-100 MB gemiddeld
- **Beschikbaar voor onze app: ~100-300 MB realistisch**

Node.js sandboxing overhead:
- `isolated-vm`: ~30-50 MB per isolate + code memory
- Node.js base runtime: ~30-50 MB
- Code execution workspace: variabel (10-100+ MB)

**Risico**: Bij complexe queries kan memory-gebruik pieken → OOM kills → Homey crash

**2. Shared Device - Stabiliteit Cruciaal**
- Homey beheert kritieke home automation (verlichting, verwarming, beveiliging)
- Andere apps mogen niet beïnvloed worden
- Een crash van onze app moet geen system-wide impact hebben
- **Vereiste**: Strikte resource isolation (moeilijk op beperkte hardware)

**3. ARM Architecture Beperkingen**
- `isolated-vm` native modules moeten gecompileerd voor ARM
- Beperkte documentatie over ARM performance
- Potentieel hogere overhead dan x86_64

**4. Security Risico**
- Onvertrouwde code uitvoeren op device dat je hele huis beheert = **hoog risico**
- Sandbox escapes (vm2 had meerdere CVEs in 2023)
- Beperkte security auditing mogelijkheden op embedded platform

#### Alternatief: Hybrid Architectuur

**Voorstel**: Code execution **offloaden** naar externe service

```
┌──────────────┐
│   Claude     │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌─────────────────┐
│ Homey Pro    │────▶│  Cloud Service  │
│              │     │  (Code Executor)│
│ - Tool calls │◀────│  - Sandboxed VM │
│ - Data fetch │     │  - Resource limits│
└──────────────┘     └─────────────────┘
```

**Voordelen**:
- ✅ Homey stabiliteit gegarandeerd
- ✅ Schaalbare resources (cloud kan 4GB+ RAM allocaten)
- ✅ Betere security isolation
- ✅ Makkelijker te monitoren en updaten

**Nadelen**:
- ❌ Extra latency (50-200ms roundtrip)
- ❌ Vereist internet connectie
- ❌ Privacy concern: code/data gaat naar cloud
- ❌ Extra kosten (hosting)

**Privacy-vriendelijke variant: Local Server**
```
┌──────────────┐     ┌─────────────────┐
│ Homey Pro    │────▶│  Raspberry Pi   │
│              │     │  (on LAN)       │
│              │◀────│  - Docker       │
│              │     │  - isolated-vm  │
└──────────────┘     └─────────────────┘
```

Users kunnen een lightweight server op hun LAN draaien (RPi, NAS, oude laptop):
- ✅ Privacy: alles blijft lokaal
- ✅ Homey stabiliteit behouden
- ✅ Voldoende resources (4-8GB RAM typisch)
- ⚠️ Vereist extra hardware setup

---

### 4.2 Vereisten (voor externe executor)
Een code execution pattern vereist:

1. **Secure execution environment**
   - Sandboxing (Docker container aanbevolen voor externe service)
   - Resource limits (CPU, memory, timeout)
   - No access to sensitive host system resources
   - Network isolation (alleen toegang tot Homey API endpoints)

2. **Tool-to-code mapping**
   - Elke tool wordt een importeerbaar module
   - Consistente API (async/await pattern)
   - Type definitions (TypeScript)
   - API client voor communicatie met Homey

3. **Monitoring & logging**
   - Execution time tracking
   - Error capturing
   - Security violation detection
   - Resource usage metrics

### 4.3 Architectuur Voorstel (Externe Executor)
```
┌──────────────────┐
│   Claude Agent   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐          ┌──────────────────┐
│  Homey MCP       │─────────▶│  Code Executor   │
│  Server          │          │  Service         │
│  - search_tools  │          │  (Docker/RPi)    │
│  - delegate_exec │◀─────────│  - isolated-vm   │
└────────┬─────────┘          │  - Tool modules  │
         │                    └──────────────────┘
         ▼
┌──────────────────┐
│  Homey API       │
│  (local calls)   │
└──────────────────┘
```

**Flow**:
1. Claude roept `execute_code` tool aan via Homey MCP
2. Homey MCP delegeert naar externe executor (LAN of cloud)
3. Executor voert code uit met toegang tot Homey API calls
4. Gefilterde resultaten gaan terug naar Claude

### 4.4 Migratiepad

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
⚠️ **Code Execution Engine (EXTERNE SERVICE VEREIST)**
- Impact: -90% tokens bij data-intensive queries
- Effort: ~2-4 weken (externe service, API design, sandboxing, testing)
- Risk: HIGH (hardware constraints Homey, security, complexity)
- **Note**: Kan NIET op Homey Pro zelf draaien (zie sectie 4.1)
- Vereist externe executor service (cloud of local server)

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

### Realistische Verwachtingen

**Hardware Realiteit**: De Homey Pro (2 GB RAM, shared met 10-50+ apps) kan **geen volledige code execution pattern** ondersteunen zoals Anthropic beschrijft. Een sandbox environment (isolated-vm) zou:
- 30-50+ MB RAM permanent claimen
- Risico op OOM kills bij complexe queries
- Stabiliteit van kritieke home automation bedreigen

### Hybride Aanpak - Beste van Beide Werelden

**Wat WEL kan (op Homey)**:
- ✅ Progressive disclosure (`search_tools`)
- ✅ Server-side filtering (parameters aan tools toevoegen)
- ✅ Betere tool descriptions
- → **~50-70% token reductie zonder hardware wijzigingen**

**Wat ALLEEN met externe service kan**:
- 🔌 Volledige code execution (90%+ token reductie)
- 🔌 State persistence
- 🔌 Agent skill library
- → **Vereist externe executor (cloud of local RPi/NAS)**

### Aanbevolen Strategie

**Fase 1 (Direct implementeerbaar)**:
Focus op optimalisaties die WEL op Homey kunnen:
1. Progressive disclosure voor tool discovery
2. Filter parameters aan data-heavy tools
3. Betere structured output formats

**Impact**: **50-70% token reductie** zonder extra hardware

**Fase 2 (Optioneel - voor power users)**:
Bouw externe executor service als opt-in feature:
- Docker image voor gebruikers met NAS/server
- Cloud-hosted variant (betaald/subscription)
- Volledig optioneel - fallback naar directe calls

**Impact**: **90%+ token reductie** voor users die externe service draaien

### Key Takeaway

**Pragmatisch advies**: Start met **low-hanging fruit** (progressive disclosure, filters) die **50-70% token reductie** opleveren zonder extra hardware. Evalueer daarna of de **extra 20-30%** van code execution de **complexiteit van een externe service** waard is voor jouw userbase.

Voor de meeste Homey users is **Phase 1 voldoende** - alleen voor power users met zeer data-intensive queries (bijv. maandelijkse energie analyses) is een externe executor de moeite waard.

---

## Referenties

- [Anthropic: Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp)
- Huidige code: `src/nl.joonix.aichatcontrol/lib/managers/mcp-server-manager.ts`
- Tool registry: `src/nl.joonix.aichatcontrol/lib/tools/tool-registry.ts`
