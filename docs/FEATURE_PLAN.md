# HomeyMCP Feature Plan - v2.0

## 🎯 Scope
Implementeer nieuwe MCP tools voor uitgebreidere Homey toegang:
- **System Information** (logic variables, weather, energy, insights)
- **User Presence** (home/away/sleep status)
- **Flow Overview** (complete overzicht van flows, devices, cards, apps)

## 📐 Design Philosophy
Volg het bewezen `get_home_structure` pattern:
- ✅ **Comprehensive single-call tools** - Alles in één keer, geen multiple roundtrips
- ✅ **Optimized XML output** - Minimale verbosity, attributes over nested tags
- ✅ **AI does the filtering** - Geef alle data, laat AI filteren/zoeken
- ✅ **Reuse existing patterns** - Hergebruik XMLFormatter, managers, tool structure

## 🎁 Key Features
1. **Logic Variables** - Lees/schrijf Homey variabelen voor automation state
2. **System Info** - Homey status (memory, storage, version, name)
3. **Weather** - Huidige weer + forecast voor locatie-based automation
4. **Energy** - Live energie monitoring per zone
5. **Insights** - Historische data voor AI analyse
6. **User Presence** - Home/away/sleep status van alle users
7. **Flow Overview** - Complete flows met cards, devices, apps - AI kan doorzoeken

---

## 📋 Tools om te Implementeren

### **TIER 1: Must Have (Prioriteit)**

#### 1. **Logic Variables Tools** (2 tools)
- ✅ `get_logic_variables` - Lijst alle logic variabelen
  - **API:** `HomeyAPI.logic.getVariables()`
  - **Returns:** Object met variabele ID → Variable object
  - **Permissions:** `homey.logic.readonly`
  - **Output:** XML formatted lijst met: id, naam, type, waarde

- ✅ `get_logic_variable` - Lees specifieke variabele
  - **API:** `HomeyAPI.logic.getVariable({ id })`
  - **Parameters:** `variable_id` (string)
  - **Returns:** Variable object
  - **Permissions:** `homey.logic.readonly`
  - **Output:** Variabele naam en huidige waarde

- ✅ `set_logic_variable` - Wijzig variabele waarde
  - **API:** `HomeyAPI.logic.updateVariable({ id, variable })`
  - **Parameters:** `variable_id` (string), `value` (any)
  - **Permissions:** `homey.logic` (write)
  - **Output:** Success/error melding

#### 2. **System Info Tool** (1 tool)
- ✅ `get_system_info` - Complete systeem informatie
  - **APIs:**
    - `HomeyAPI.system.getInfo()` - Versie, platform, etc.
    - `HomeyAPI.system.getMemoryInfo()` - RAM gebruik
    - `HomeyAPI.system.getStorageInfo()` - Disk space
    - `HomeyAPI.system.getSystemName()` - Homey naam
  - **Permissions:** `homey.system.readonly`
  - **Output:** Gecombineerde XML met alle system info
  - **Note:** Exacte response structure onbekend, moet tijdens implementatie worden ontdekt

#### 3. **Weather Tools** (2 tools)
- ✅ `get_weather` - Huidige weer
  - **API:** `HomeyAPI.weather.getWeather()`
  - **Permissions:** `homey.geolocation.readonly`
  - **Output:** Weer data (exacte format TBD - API test nodig)

- ✅ `get_weather_forecast` - Uurlijkse voorspelling
  - **API:** `HomeyAPI.weather.getWeatherHourly()`
  - **Permissions:** `homey.geolocation.readonly`
  - **Output:** Forecast array (exacte format TBD - API test nodig)

---

### **TIER 2: Nice to Have**

#### 4. **Energy Monitoring Tool** (1 tool)
- ✅ `get_energy_report` - Live energie verbruik
  - **API:** `HomeyAPI.energy.getLiveReport({ zone?: string })`
  - **Parameters:** `zone_id` (string, optional) - Filter op specifieke zone
  - **Permissions:** `homey.insights.readonly`
  - **Output:** Live energie data (exacte format TBD)

#### 5. **Insights Tool** (1 tool - complexer)
- ✅ `get_insights` - Historische data ophalen
  - **APIs:**
    - `HomeyAPI.insights.getLogs()` - Lijst alle logs
    - `HomeyAPI.insights.getLog({ id, uri })` - Specifieke log
    - `HomeyAPI.insights.getLogEntries({ id, uri, resolution? })` - Historische entries
  - **Parameters:**
    - `log_id` (string, optional) - Specifieke log
    - `uri` (string, optional) - Log URI
    - `resolution` (string, optional) - Time aggregation
  - **Permissions:** `homey.insights.readonly`
  - **Output:** Log data voor AI analyse
  - **Note:** Complex - eerst logs discoveren, dan entries ophalen

#### 6. **Notification Tool** (1 tool - optional)
- ✅ `send_notification` - Stuur notificatie naar Homey tijdlijn
  - **API:** `homey.notifications.createNotification({ excerpt })`
  - **Parameters:** `message` (string) - Notificatie tekst
  - **Note:** Via Homey App SDK (not HomeyAPI)
  - **Output:** Success confirmation

---

### **TIER 3: Enhanced Features (New!)**

#### 7. **User Presence Tools** (1-2 tools)
- ✅ `get_user_presence` - Haal user presence status op
  - **API:** `HomeyAPIV3Local.presence.getState()` - Alle users
  - **Alternative APIs:**
    - `HomeyAPIV3Local.presence.getPresent({ id })` - Specifieke user present status
    - `HomeyAPIV3Local.presence.getAsleep({ id })` - Specifieke user asleep status
  - **Permissions:** `homey.presence.readonly` of `homey.system.readonly`
  - **Output:** XML formatted lijst met users en hun status (home/away/asleep)
  - **Use cases:**
    - "Is anyone home?"
    - "Who is sleeping?"
    - "Is John away?"

- ✅ `set_user_presence` - Wijzig user presence (optional)
  - **API:** `HomeyAPIV3Local.presence.setPresent({ id })`, `setAsleep({ id })`
  - **Parameters:** `user_id` (string), `present` (boolean), `asleep` (boolean)
  - **Permissions:** `homey.presence`
  - **Output:** Success/error melding
  - **Note:** Mogelijk niet nodig - meestal automatisch

#### 8. **Flow Overview Tool** (1 comprehensive tool - zoals get_home_structure)
- ✅ `get_flow_overview` - Complete flow overzicht in één call
  - **Design Philosophy:** Net zoals `get_home_structure` - alles in één keer, XML geoptimaliseerd
  - **APIs:**
    - `HomeyAPI.flow.getFlows()` - Regular flows (we gebruiken dit al)
    - `HomeyAPI.flow.getAdvancedFlows()` - Advanced flows (we gebruiken dit al)
  - **Extracted Information:**
    - **Flow basics:** ID, naam, enabled/disabled status
    - **Folder/Category:** Als beschikbaar in flow data
    - **Cards:** Trigger/condition/action cards per flow
    - **Devices:** Device IDs/names gebruikt in cards (extract from card args)
    - **Apps:** App IDs afgeleid van card URIs (zoals we doen bij devices: `homey:app:com.athom.hue`)
  - **Parameters:**
    - `include_disabled` (boolean, default: false) - Toon ook disabled flows
  - **Permissions:** `homey.flow.readonly`
  - **Output Format:** Optimized XML zoals home_structure:
    ```xml
    <flows total="45" enabled="42" disabled="3">
      <flow id="abc123" name="Morning routine" type="advanced">
        <trigger app="com.athom.clock" card="time_alarm" />
        <condition app="com.athom.hue" card="light_on" device="lamp-kitchen" />
        <action app="com.athom.hue" card="light_toggle" device="lamp-kitchen" />
        <action app="com.athom.hue" card="light_toggle" device="lamp-living" />
      </flow>
      <flow id="def456" name="Night mode" type="regular" folder="Evening" enabled="false">
        <trigger app="com.athom.clock" card="time_specific" />
        <action app="com.athom.hue" card="lights_off" />
      </flow>
      <!-- MCP trigger flows (ai_tool_call) worden ook getoond -->
      <flow id="ghi789" name="Play Radio" type="advanced" mcp-command="play_radio">
        <trigger app="nl.joonix.aichatcontrol" card="ai_tool_call" />
        <action app="com.athom.sonos" card="play_stream" device="speaker-123" />
      </flow>
    </flows>
    ```
  - **Optimization:**
    - Minimize verbosity (attributes, not nested tags)
    - Only include non-default values (folder, enabled="false")
    - Default values omitted: `enabled="true"`, `type="regular"`
    - Device names optional (AI kan opzoeken in `get_home_structure`)
    - Summary counts bovenaan: total, enabled, disabled
    - **Special:** MCP flows krijgen `mcp-command` attribute voor herkenning
  - **Use cases:**
    - "Which flows use the kitchen light?" → AI kan zelf filteren in XML
    - "Show flows in 'Morning' folder" → AI kan zelf filteren
    - "What apps are used in my flows?" → AI kan unique apps extraheren
  - **Note:** AI doet de filtering/searching zelf in de XML data - sneller dan meerdere API calls!

---

## 🏗️ Implementatie Architectuur

### **Nieuwe Managers**

#### **1. SystemInfoManager**
Maak een nieuwe manager voor system-level operaties:

```typescript
// lib/managers/system-info-manager.ts
interface ISystemInfoManager {
  // Logic Variables
  getLogicVariables(): Promise<Record<string, LogicVariable>>;
  getLogicVariable(id: string): Promise<LogicVariable>;
  setLogicVariable(id: string, value: any): Promise<void>;

  // System Info
  getSystemInfo(): Promise<SystemInfo>;

  // Weather
  getWeather(): Promise<WeatherData>;
  getWeatherForecast(): Promise<WeatherForecast>;

  // Energy
  getEnergyReport(zoneId?: string): Promise<EnergyReport>;

  // Insights
  getInsightsLogs(): Promise<Record<string, InsightLog>>;
  getInsightLogEntries(id: string, uri: string, resolution?: string): Promise<any>;

  // User Presence
  getUserPresence(): Promise<UserPresenceState>;
  getUserPresenceById(userId: string): Promise<UserPresence>;
  setUserPresence(userId: string, present: boolean, asleep: boolean): Promise<void>;
}
```

#### **2. FlowManager Uitbreiding**
Uitbreiden van bestaande FlowManager voor flow overview data:

```typescript
// lib/interfaces/IFlowManager.ts
interface IFlowManager {
  // ... existing methods ...

  // NEW: Flow overview (similar to getHomeStructure)
  getFlowOverview(includeDisabled?: boolean): Promise<FlowOverviewData>;
}

// New type for flow overview
interface FlowOverviewData {
  flows: Array<{
    id: string;
    name: string;
    enabled: boolean;
    folder?: string; // If available in flow data
    type: 'regular' | 'advanced';
    cards: Array<{
      type: 'trigger' | 'condition' | 'action';
      appId: string; // Extracted from URI
      cardId: string; // Card type ID
      deviceId?: string; // If card uses a device
      deviceName?: string; // Optional, for clarity
    }>;
  }>;
}
```

**Implementatie Notes:**
- Hergebruik bestaande `getFlows()` en `getAdvancedFlows()` logic
- Voeg parsing toe voor card URIs → app IDs (extract zoals bij devices)
- Voeg parsing toe voor device references in card args
- Detect folder/category from flow metadata (als beschikbaar)

### **Tool Structure (volg bestaand pattern)**
Elke tool volgt het `BaseTool` pattern:
1. Extend `BaseTool`
2. Implement `getDefinition()` - MCP tool schema
3. Implement `execute(args)` - Business logic via manager
4. Use `createSuccessResponse()` / `createErrorResponse()`
5. Use `validateRequiredArgs()` voor parameter validatie

### **Response Formatting**
- **XML Formatter hergebruiken** voor gestructureerde data (zoals bij devices/zones)
- Simpele text responses waar passend
- Error handling via bestaand error systeem

---

## 📝 Implementatie Stappen

### **Fase 1: Manager Setup**
1. ✅ Maak interface `ISystemInfoManager` in `lib/interfaces/`
2. ✅ Implementeer `SystemInfoManager` in `lib/managers/`
3. ✅ Initialiseer manager in `app.ts`
4. ✅ Voeg HomeyAPI managers toe (logic, system, weather, energy, insights)

### **Fase 2: Logic Variables Tools**
5. ✅ Implementeer `get_logic_variables_tool.ts`
6. ✅ Implementeer `get_logic_variable_tool.ts`
7. ✅ Implementeer `set_logic_variable_tool.ts`
8. ✅ Registreer tools in `tool-registry.ts`

### **Fase 3: System Info Tool**
9. ✅ Implementeer `get_system_info_tool.ts`
10. ✅ Test API responses om exacte data structure te ontdekken
11. ✅ Format output (waarschijnlijk XML)

### **Fase 4: Weather Tools**
12. ✅ Implementeer `get_weather_tool.ts`
13. ✅ Implementeer `get_weather_forecast_tool.ts`
14. ✅ Test API responses voor data structure

### **Fase 5: Energy & Insights**
15. ✅ Implementeer `get_energy_report_tool.ts`
16. ✅ Implementeer `get_insights_tool.ts` (complex - eerst logs discoveren)

### **Fase 6: Notification (Optional)**
17. ✅ Implementeer `send_notification_tool.ts`
18. ✅ Note: Gebruikt Homey App SDK, niet HomeyAPI

### **Fase 7: User Presence Tools (NEW)**
19. ✅ Voeg user presence methods toe aan `SystemInfoManager`
20. ✅ Implementeer `get_user_presence_tool.ts`
21. ✅ (Optioneel) Implementeer `set_user_presence_tool.ts`
22. ✅ Test API calls voor presence data structure

### **Fase 8: Flow Overview Tool (NEW)**
23. ✅ Uitbreid `IFlowManager` interface met `getFlowOverview()` method
24. ✅ Implementeer `getFlowOverview()` in `FlowManager`:
    - Haal alle flows op (regular + advanced)
    - Parse card data: extract app IDs from URIs
    - Parse card args: find device references
    - Detect folder/category from flow metadata
25. ✅ Voeg `formatFlowOverview()` toe aan `XMLFormatter`:
    - Geoptimaliseerd XML zoals `formatHomeStructure()`
    - Minimale verbosity, attributes over nested tags
    - Summary count bovenaan
26. ✅ Implementeer `get_flow_overview_tool.ts`
27. ✅ Test met verschillende flow types (simple, advanced, met/zonder devices)

### **Fase 9: Type Safety & Enhanced Flow Features**
28. ✅ Replace 'any' types met proper Homey SDK types:
    - Add HomeyInstance type alias voor consistent gebruik
    - Create HomeyAPICard interface voor flow card parsing
    - Update alle managers en tools met typed Homey instances
29. ✅ Token tracking implementeren:
    - Parse droptoken field (boolean = produces, string = consumes)
    - Add tokenInput to FlowCardInfo (deviceId + capability)
    - Display consumed dynamic variables in flow overview
30. ✅ Card arguments tonen:
    - Add args to FlowCardInfo
    - Display parameters zoals temperatuurwaarden in XML
31. ✅ Filtering uitbreiden:
    - Filter by deviceIds (OR logic)
    - Filter by folderPaths (OR logic)
    - Filter by appIds (OR logic)
32. ✅ Device-to-app mapping:
    - Build deviceToAppMap tijdens getFlowOverview
    - Enrich cards met accurate app attribution
33. ✅ URI pattern extraction:
    - Extract device IDs from homey:device:ID:capability URIs
    - Support system cards (homey:manager:logic)
34. ✅ XML self-descriptive maken:
    - app="..." → app-id="..."
    - card="..." → card-id="..."
    - device="..." → device-id="..."
    - folder="..." → folder-path="..." of folder-id="..."
    - zone="..." → zone-id="..."
    - Add <arg>, <token-input>, <token> elements
    - Simplify instructions door redundante uitleg te verwijderen
35. ✅ Get Installed Apps Tool:
    - Retrieve flow cards from API instead of manifest
    - Filter cards by ownerUri
    - Add capabilities support
    - Fix driverUri deprecation warnings

---

## ⚠️ Belangrijke Aandachtspunten

### **API Response Structures Onbekend**
- Homey API documentatie geeft alleen method signatures, geen response formats
- **Aanpak:** Tijdens implementatie eerst API calls testen en responses loggen
- Dan pas output formatting implementeren

### **Permissions Required**
Zorg dat app manifest de juiste permissions heeft:

**Bestaande:**
- `homey.logic.readonly` + `homey.logic` (voor set)
- `homey.system.readonly`
- `homey.geolocation.readonly`
- `homey.insights.readonly`
- `homey.flow.readonly` (already have)

**Nieuw toe te voegen:**
- `homey.presence.readonly` - Voor user presence status
- `homey.presence` - Voor set user presence (optional)
- `homey.presence.self` - Voor set eigen presence (optional)

### **Error Handling**
- Gebruik bestaande error classes uit `lib/utils/errors.ts`
- Mogelijk nieuwe errors toevoegen: `LogicVariableNotFoundError`, etc.

### **Testing Strategy**
1. Eerst handmatige tests via Claude/MCP
2. Verifieer elke tool werkt standalone
3. Test edge cases (missing variables, invalid IDs, etc.)

### **Documentation Updates**
Na implementatie updaten:
- README.md - Nieuwe tools beschrijven
- Community post - Changelog voor nieuwe features
- GitHub docs - Examples van nieuwe commands

---

## 🎯 Deliverables

### **Code**
- 6-9 nieuwe tool bestanden
- 1 nieuwe manager + interface
- Type definitions voor nieuwe data structures
- Tool registrations

### **Testing**
- Handmatige tests via Claude Desktop
- Validatie van alle API calls
- Error scenario's

### **Documentatie**
- Updated README met nieuwe features
- Code comments
- Type documentation

---

## 📊 Geschatte Complexiteit

| Tool | Complexiteit | Reden |
|------|-------------|--------|
| Logic Variables (get) | ⭐ Laag | Direct API call, simple response |
| Logic Variables (set) | ⭐⭐ Medium | Write operation, validatie nodig |
| System Info | ⭐⭐ Medium | Meerdere API calls combineren |
| Weather | ⭐⭐ Medium | Response format onbekend, moet ontdekt worden |
| Energy | ⭐⭐ Medium | Zone filtering, response format TBD |
| Insights | ⭐⭐⭐ Hoog | Twee-staps proces (logs → entries), complex |
| Notifications | ⭐ Laag | Simpel, maar andere API (App SDK) |
| **User Presence (get)** | ⭐⭐ Medium | Nieuwe API, response format TBD |
| **User Presence (set)** | ⭐⭐ Medium | Write operation, mogelijk edge cases |
| **Flow Overview** | ⭐⭐⭐ Hoog | Card parsing, app/device extraction, XML formatting |
| **Type Safety & Enhanced Flow** | ⭐⭐⭐ Hoog | Codebase-wide refactor, token parsing, XML improvements |

**Totale schatting:**
- TIER 1: 4-6 uur
- TIER 2: 2-3 uur
- TIER 3 (NEW): 4-6 uur (flow overview + user presence)
- **Fase 9 (Quality)**: 6-8 uur (type safety + flow enhancements)
- **Totaal: 16-23 uur**

**Note:** Flow Overview is nu ⭐⭐⭐ (was ⭐⭐⭐⭐) omdat:
- We hergebruiken bestaande flow fetch logic
- AI doet filtering/searching in XML (geen aparte query methods nodig)
- Volgt bewezen `get_home_structure` pattern
- Simpeler dan oorspronkelijk plan met dependency graphs

---

## ✅ Implementation Status

**COMPLETED!** Alle fases zijn succesvol geïmplementeerd:
- ✅ Fase 1-8: Alle geplande features (logic variables, system info, weather, energy, insights, notifications, user presence, flow overview)
- ✅ Fase 9: Type safety improvements & enhanced flow features met token tracking

**Laatste commit:** "Improve type safety and enhance flow overview with token tracking"
- 21 files changed, 614 insertions(+), 121 deletions(-)
- Type safety door hele codebase
- Token tracking voor dynamic variables
- Self-descriptive XML output
- Enhanced flow filtering (deviceIds, folderPaths, appIds)

**Volgende stappen:**
- Push naar GitHub
- Update README met nieuwe features
- Mogelijk: Community post over v2.0 features
