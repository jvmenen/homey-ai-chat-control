# Refactoring Plan: Van God Classes naar Clean Architecture

**Status**: 🟢 Fase 1 Compleet!
**Laatste update**: 2025-10-27
**Doel**: Elimineer tight coupling, god classes en maak code testbaar via interfaces, dependency injection en separation of concerns

---

## 📊 Probleem Analyse

### Huidige Architecture Smells

#### 1. God Classes Everywhere
- **FlowManager**: 441 regels - doet discovery, parsing, triggering, parameter mapping
- **ZoneDeviceManager**: 869 regels - doet read, write, validation, aggregation, temperature calc
- **Violation**: Single Responsibility Principle

#### 2. Tight Coupling
- Elke manager kent `homey` AND `homeyApi`
- Tools kennen concrete manager classes
- Managers kennen elkaar
- Geen interfaces → alles is concrete implementation

#### 3. No Dependency Injection
- Alles wordt hard-wired in `app.ts`
- Impossible to test in isolation
- Impossible to mock dependencies

#### 4. No Proper Separation of Concerns
- HTTP transport logic mixed met business logic (in `app.ts`)
- Protocol logic (MCP) mixed met domain logic (Homey)
- Presentation (text formatting) in tools

---

## 🎯 Success Criteria

- ✅ FlowManager < 200 regels
- ✅ ZoneDeviceManager < 300 regels
- ✅ Alle tools testbaar met mocks
- ✅ Geen breaking changes voor consumers
- ✅ App blijft functioneren (integration test)

---

## 📋 Implementatie Fases

### **FASE 1: Interfaces Toevoegen** ✅ **COMPLEET**
**Impact**: ⭐⭐⭐ (Hoogste ROI)
**Risico**: 🟢 Laag
**Status**: ✅ Compleet (2025-10-27)

**Doel**: Maak code testbaar zonder grote refactor

#### Task 1.1: Create Core Interfaces Directory
- [x] Maak `lib/interfaces/` directory
- [x] Maak `lib/interfaces/index.ts` voor exports

#### Task 1.2: Create IHomeyClient Interface
- [x] Maak `lib/interfaces/IHomeyClient.ts`
  ```typescript
  export interface IHomeyClient {
    log(...args: unknown[]): void;
    error(...args: unknown[]): void;
    flow: {
      getTriggerCard(id: string): unknown;
    };
  }
  ```

#### Task 1.3: Create IHomeyApiClient Interface
- [x] Maak `lib/interfaces/IHomeyApiClient.ts`
  ```typescript
  export interface IHomeyApiClient {
    flow: {
      getFlows(): Promise<Record<string, unknown>>;
      getAdvancedFlows(): Promise<Record<string, unknown>>;
    };
    devices: {
      getDevices(): Promise<Record<string, unknown>>;
      getDevice(opts: { id: string }): Promise<unknown>;
    };
    zones: {
      getZones(): Promise<Record<string, unknown>>;
      getZone(opts: { id: string }): Promise<unknown>;
    };
  }
  ```

#### Task 1.4: Create IFlowManager Interface
- [x] Maak `lib/interfaces/IFlowManager.ts`
  ```typescript
  export interface IFlowManager {
    init(): Promise<void>;
    getMCPFlows(): Promise<HomeyFlow[]>;
    discoverMCPFlows(): Promise<Array<{ flowId: string; flowName: string; command: string }>>;
    getToolsFromFlows(): Promise<MCPTool[]>;
    triggerCommand(toolName: string, parameters?: Record<string, any>): Promise<FlowExecutionResult>;
    registerCommand(command: string): void;
    getRegisteredCommands(): Array<{ name: string }>;
  }
  ```

#### Task 1.5: Create IZoneDeviceManager Interface
- [x] Maak `lib/interfaces/IZoneDeviceManager.ts`
  ```typescript
  export interface IZoneDeviceManager {
    // Read operations
    init(): Promise<void>;
    getZones(): Promise<HomeyZone[]>;
    getZone(zoneId: string): Promise<HomeyZone | null>;
    getDevices(): Promise<HomeyDevice[]>;
    getDevice(deviceId: string): Promise<HomeyDevice | null>;
    getDevicesInZone(zoneId: string): Promise<HomeyDevice[]>;
    getHomeStructure(): Promise<{ zones: unknown[]; devices: unknown[] }>;
    getStates(filters?: unknown): Promise<{ devices: unknown[] }>;

    // Write operations
    setCapabilityValue(deviceId: string, capability: string, value: unknown): Promise<void>;
    toggleDevice(deviceId: string, capability?: string): Promise<boolean>;
    setZoneLights(zoneId: string, action: 'on' | 'off' | 'toggle', dimLevel?: number): Promise<unknown>;
  }
  ```

#### Task 1.6: Update FlowManager to Implement Interface
- [x] Import `IFlowManager` interface
- [x] Add `implements IFlowManager` to class declaration
- [x] Fix any TypeScript errors (missing/incorrect methods)
- [x] **GEEN breaking changes** - alleen type declarations

#### Task 1.7: Update ZoneDeviceManager to Implement Interface
- [x] Import `IZoneDeviceManager` interface
- [x] Add `implements IZoneDeviceManager` to class declaration
- [x] Fix any TypeScript errors
- [x] **GEEN breaking changes**

#### Task 1.8: Update BaseTool to Accept Interfaces
- [x] Update constructor signatures in `BaseTool` om interfaces te accepteren
- [x] Update alle tool implementations:
  - [x] `control-device-tool.ts`
  - [x] `control-zone-capability-tool.ts`
  - [x] `control-zone-lights-tool.ts`
  - [x] `get-states-tool.ts`
  - [x] `home-structure-tool.ts`
  - [x] `toggle-device-tool.ts`
  - [x] `set-light-tool.ts`
  - [x] `set-thermostat-tool.ts`
  - [x] `trigger-any-flow-tool.ts`
  - [x] `refresh-flows-tool.ts`

#### Task 1.9: Create Mock Implementations (Testing)
- [x] Maak `lib/interfaces/mocks/` directory
- [x] Maak `MockHomeyClient.ts`
- [x] Maak `MockFlowManager.ts`
- [x] Maak `MockZoneDeviceManager.ts`

#### Task 1.10: Test Phase 1
- [x] Run `npm run build` → moet slagen
- [x] Run app → moet starten zonder errors
- [x] Test één tool met mock → moet werken

**Completion Criteria Fase 1**:
- ✅ Alle interfaces bestaan
- ✅ Managers implementeren interfaces
- ✅ Tools gebruiken interfaces
- ✅ Build succeeds
- ✅ App starts without errors
- ✅ Mock test works

---

### **FASE 2: Extract Services uit God Classes**
**Impact**: ⭐⭐ (Refactor)
**Risico**: 🟡 Medium
**Status**: 🔴 Niet gestart

**Doel**: Split responsibilities, kleinere files

#### Task 2.1: Setup Services Directory
- [ ] Maak `lib/services/` directory
- [ ] Maak `lib/services/index.ts`

#### Task 2.2: Extract FlowDiscoveryService
**Target**: 110 regels
**Broncode**: `FlowManager.ts` regels 56-157

- [ ] Maak `lib/services/FlowDiscoveryService.ts`
- [ ] Verplaats methods:
  - `init()` (HomeyAPI setup)
  - `getMCPFlows()`
  - `discoverMCPFlows()`
- [ ] Create interface `IFlowDiscoveryService`
- [ ] Test: discovery blijft werken

#### Task 2.3: Extract FlowParserService
**Target**: 80 regels
**Broncode**: `FlowManager.ts` regels 166-227 + 232-276

- [ ] Maak `lib/services/FlowParserService.ts`
- [ ] Verplaats methods:
  - `parseParameters()` (parameter parsing uit description)
  - `getToolsFromFlows()` (convert flows → MCP tools)
  - `flowToToolName()`, `toolNameToFlow()`
- [ ] Create interface `IFlowParserService`
- [ ] Test: parameter parsing blijft werken

#### Task 2.4: Extract FlowExecutionService
**Target**: 90 regels
**Broncode**: `FlowManager.ts` regels 313-404

- [ ] Maak `lib/services/FlowExecutionService.ts`
- [ ] Verplaats methods:
  - `triggerCommand()`
  - `getTokenName()` (token mapping helper)
  - Token mapping logic
- [ ] Create interface `IFlowExecutionService`
- [ ] Test: flow triggering blijft werken

#### Task 2.5: Refactor FlowManager to Orchestrator
**Target**: ~150 regels (was 441)

- [ ] Update `FlowManager` constructor om services te accepteren
- [ ] Delegeer alle calls naar services:
  ```typescript
  async discoverMCPFlows() {
    return this.discoveryService.discoverMCPFlows();
  }
  ```
- [ ] Keep public interface intact (backward compatible)
- [ ] Test: alle bestaande consumers blijven werken

#### Task 2.6: Extract ZoneService
**Target**: 150 regels
**Broncode**: `ZoneDeviceManager.ts` regels 134-230

- [ ] Maak `lib/services/ZoneService.ts`
- [ ] Verplaats methods:
  - `getZones()`
  - `getZone()`
  - `getZoneHierarchy()`
  - `getActiveZones()`
- [ ] Create interface `IZoneService`
- [ ] Test: zone queries blijven werken

#### Task 2.7: Extract DeviceService
**Target**: 200 regels
**Broncode**: `ZoneDeviceManager.ts` regels 234-396

- [ ] Maak `lib/services/DeviceService.ts`
- [ ] Verplaats methods:
  - `getDevices()`
  - `getDevice()`
  - `getDevicesInZone()`
  - `getDevicesByCapability()`
  - `getCapabilityValue()`
  - `getZoneTemperatures()`
- [ ] Create interface `IDeviceService`
- [ ] Test: device queries blijven werken

#### Task 2.8: Extract DeviceControlService
**Target**: 150 regels
**Broncode**: `ZoneDeviceManager.ts` regels 479-551

- [ ] Maak `lib/services/DeviceControlService.ts`
- [ ] Verplaats methods:
  - `setCapabilityValue()`
  - `toggleDevice()`
  - `convertAndValidateValue()` (validation helper)
- [ ] Create interface `IDeviceControlService`
- [ ] Test: device control blijft werken

#### Task 2.9: Extract ZoneControlService
**Target**: 150 regels
**Broncode**: `ZoneDeviceManager.ts` regels 556-673

- [ ] Maak `lib/services/ZoneControlService.ts`
- [ ] Verplaats methods:
  - `setZoneLights()`
  - `setZoneDeviceCapability()`
- [ ] Create interface `IZoneControlService`
- [ ] Dependencies: `IDeviceService`, `IZoneService`, `IDeviceControlService`
- [ ] Test: zone control blijft werken

#### Task 2.10: Extract SnapshotService
**Target**: 150 regels
**Broncode**: `ZoneDeviceManager.ts` regels 706-868

- [ ] Maak `lib/services/SnapshotService.ts`
- [ ] Verplaats methods:
  - `getHomeStructure()`
  - `getStates()`
- [ ] Create interface `ISnapshotService`
- [ ] Dependencies: `IZoneService`, `IDeviceService`
- [ ] Test: snapshot operations blijven werken

#### Task 2.11: Refactor ZoneDeviceManager to Facade
**Target**: ~200 regels (was 869)

- [ ] Update constructor om services te accepteren
- [ ] Implement facade pattern - delegeer naar services
- [ ] Keep public interface intact (backward compatible)
- [ ] Test: alle tools blijven werken

#### Task 2.12: Update app.ts to Wire Services
- [ ] Create service instances in `onInit()`
- [ ] Inject services into managers
- [ ] Maintain same public API
- [ ] Test: app start blijft werken

#### Task 2.13: Test Phase 2 Integration
- [ ] Run full build
- [ ] Start app → test alle endpoints
- [ ] Test flow discovery → moet flows vinden
- [ ] Test device control → moet devices kunnen aansturen
- [ ] Test tools via MCP → moeten blijven werken

**Completion Criteria Fase 2**:
- ✅ FlowManager < 200 regels
- ✅ ZoneDeviceManager < 300 regels
- ✅ Alle services < 200 regels
- ✅ Geen breaking changes
- ✅ Alle integration tests slagen

---

### **FASE 3: Dependency Injection Container** (Optioneel)
**Impact**: ⭐ (Nice to have)
**Risico**: 🟢 Laag
**Status**: 🔴 Niet gestart

**Doel**: Centralize dependency creation

#### Task 3.1: Create DI Container
- [ ] Maak `lib/container.ts`
- [ ] Implement factory pattern:
  ```typescript
  export function createServices(homey: Homey) {
    // Create clients
    const homeyClient = new HomeyClientAdapter(homey);
    const homeyApi = await HomeyAPI.createAppAPI({ homey });

    // Create services
    const flowDiscovery = new FlowDiscoveryService(homeyApi);
    const flowParser = new FlowParserService();
    const flowExecution = new FlowExecutionService(homeyClient, triggerCard);
    const flowManager = new FlowManager(flowDiscovery, flowParser, flowExecution);

    const zoneService = new ZoneService(homeyApi);
    const deviceService = new DeviceService(homeyApi);
    const deviceControl = new DeviceControlService(homeyApi);
    const zoneControl = new ZoneControlService(zoneService, deviceService, deviceControl);
    const snapshot = new SnapshotService(zoneService, deviceService);
    const zoneDeviceManager = new ZoneDeviceManager(zoneService, deviceService, ...);

    return { flowManager, zoneDeviceManager };
  }
  ```

#### Task 3.2: Update app.ts to Use Container
- [ ] Replace manual wiring met `createServices()`
- [ ] Destructure returned services
- [ ] Test: app blijft werken

#### Task 3.3: Test Phase 3
- [ ] Build succeeds
- [ ] App starts
- [ ] All functionality works

**Completion Criteria Fase 3**:
- ✅ Single source of truth voor dependencies
- ✅ Makkelijk om nieuwe services toe te voegen
- ✅ App blijft werken

---

### **FASE 4: Documentation & Testing**
**Status**: 🔴 Niet gestart

#### Task 4.1: Update Architecture Documentation
- [ ] Document nieuwe architecture in `ARCHITECTURE.md`
- [ ] Add class diagrams (before/after)
- [ ] Document dependency flow
- [ ] Document testing strategy

#### Task 4.2: Add Unit Tests
- [ ] Test FlowParserService (parameter parsing)
- [ ] Test DeviceControlService (validation)
- [ ] Test met mock interfaces

#### Task 4.3: Add Integration Tests
- [ ] Test complete flow: MCP request → tool → manager → service
- [ ] Test error handling

**Completion Criteria Fase 4**:
- ✅ Architecture documented
- ✅ Unit tests added
- ✅ Integration tests pass

---

## 🔄 Testing Strategy

### Per Fase Testing
- **Fase 1**: Build test + Mock interface test
- **Fase 2**: Integration test per service extraction
- **Fase 3**: Smoke test na DI implementation
- **Fase 4**: Full test suite

### Test Checklist
- [ ] `npm run build` succeeds
- [ ] App starts without errors
- [ ] `/health` endpoint responds
- [ ] `/mcp` endpoint accepts requests
- [ ] Flow discovery finds flows
- [ ] Device control works
- [ ] Zone control works
- [ ] All tools callable via MCP

---

## 🔙 Rollback Strategy

### Fase 1 Rollback
- Remove interface files
- Remove `implements` declarations
- Revert tool constructors to concrete types

### Fase 2 Rollback
- Keep facade managers (backward compatible)
- Remove service files
- Restore original manager implementations

### Fase 3 Rollback
- Remove container.ts
- Restore manual wiring in app.ts

---

## 📈 Progress Tracking

### Overall Progress
- [x] **Fase 1: Interfaces (10/10 tasks)** ✅ COMPLEET
- [ ] Fase 2: Services (0/13 tasks)
- [ ] Fase 3: DI Container (0/3 tasks)
- [ ] Fase 4: Documentation (0/3 tasks)

**Total**: 10/29 tasks completed (34%)

---

## 📝 Notes & Decisions

### Waarom Deze Aanpak?
1. **Incrementeel**: Elke fase is onafhankelijk en rollback-able
2. **Backward Compatible**: Geen breaking changes voor consumers
3. **Testbaar**: Interfaces eerst = direct testbaar
4. **Low Risk**: Facade pattern houdt public API intact

### Wat NIET doen
- ❌ Big Bang refactor (te risicovol)
- ❌ Breaking changes in public APIs
- ❌ Over-engineering (YAGNI)
- ❌ Refactoren zonder tests

### Open Vragen
- [ ] Moeten we unit tests toevoegen tijdens Fase 1 of na Fase 2?
- [ ] Willen we Fase 3 (DI Container) wel? Is het de complexity waard?
- [ ] Moeten services ook interfaces krijgen of alleen managers?

---

**Laatste update**: 2025-10-27
**Eigenaar**: Jeroenvdk
**Review**: Pending
