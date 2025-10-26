# Homey MCP Server - Caching Strategy Research

**Created:** 2025-10-25
**Status:** DEFERRED - Awaiting performance measurements
**Decision:** First measure, then optimize

---

## Executive Summary

**BESLISSING: GEEN CACHING IMPLEMENTEREN (voor nu)**

**Rationale:**
1. Homey API is **lokaal** (niet over internet) - waarschijnlijk al snel
2. Homey heeft waarschijnlijk **interne caching** al geïmplementeerd
3. **Premature optimization** - we hebben geen metingen dat het traag is
4. **Event-based caching mogelijk** maar niet nodig zonder bewezen performance probleem

**Volgende stap:**
- Meet API call performance in productie
- Tel aantal API calls per conversatie
- Als performance probleem → implementeer event-based caching
- Anders → laat zoals het is

---

## Current API Call Patterns

### API Calls Analysis (zonder cache)

**Per method:**
```typescript
getDevices()            → 2 API calls (devices + zones)
getDevice(id)           → 2 API calls (device + zone lookup)
getZone(id)             → 1 API call
getZones()              → 1 API call
getHomeStructure()      → 2 API calls (devices + zones)
getStates(filters)      → 2 API calls (devices + zones)
setCapabilityValue()    → 1 API call
```

**Typical conversation: "Turn on kitchen lights"**
```
1. get_home_structure     → 2 API calls
2. get_states (kitchen)   → 2 API calls
3. control_zone_lights    → 1 API call (getZone)
4. getDevicesInZone       → 2 API calls
5. Per light (5 lights):
   - setCapabilityValue   → 1 API call × 5 = 5 API calls

Total: 12 API calls
```

**Without optimization:** 10-20 API calls per typical interaction

---

## Event-Based Caching Strategy (IF NEEDED)

### Homey API Events Available

**ManagerDevices emits:**
- `device.create` - New device added
- `device.delete` - Device removed
- `device.update` - Device properties changed

**ManagerZones emits:**
- `zone.create` - New zone created
- `zone.delete` - Zone removed
- `zone.update` - Zone renamed/modified

**Source:** https://athombv.github.io/node-homey-api/

### Proposed Implementation (IF PERFORMANCE IS AN ISSUE)

```typescript
class ZoneDeviceManager {
  private zonesCache: Map<string, HomeyZone> | null = null;
  private devicesCache: Map<string, HomeyDevice> | null = null;
  private cacheValid = { zones: false, devices: false };

  async init() {
    // ... existing init ...

    // Setup event-based invalidation (NO POLLING!)
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Zone events
    this.homeyApi.zones.on('zone.create', () => {
      this.homey.log('🔄 Zone created - invalidating cache');
      this.cacheValid.zones = false;
      this.zonesCache = null;
    });

    this.homeyApi.zones.on('zone.delete', () => {
      this.cacheValid.zones = false;
      this.zonesCache = null;
    });

    this.homeyApi.zones.on('zone.update', () => {
      this.cacheValid.zones = false;
      this.zonesCache = null;
    });

    // Device events
    this.homeyApi.devices.on('device.create', () => {
      this.homey.log('🔄 Device created - invalidating cache');
      this.cacheValid.devices = false;
      this.devicesCache = null;
    });

    this.homeyApi.devices.on('device.delete', () => {
      this.cacheValid.devices = false;
      this.devicesCache = null;
    });

    this.homeyApi.devices.on('device.update', () => {
      this.cacheValid.devices = false;
      this.devicesCache = null;
    });
  }

  async getZones(): Promise<HomeyZone[]> {
    // Use cache if valid
    if (this.cacheValid.zones && this.zonesCache) {
      this.homey.log('✅ Using cached zones');
      return Array.from(this.zonesCache.values());
    }

    // Build cache
    this.homey.log('📦 Building zones cache from API...');
    const zonesObj = await this.homeyApi.zones.getZones();

    this.zonesCache = new Map();
    Object.values(zonesObj).forEach((zone: any) => {
      this.zonesCache!.set(zone.id, {
        id: zone.id,
        name: zone.name,
        parent: zone.parent || null,
        icon: zone.icon || 'default',
        // Note: NOT caching active/activeOrigins (real-time data)
      });
    });

    this.cacheValid.zones = true;
    this.homey.log(`✅ Cached ${this.zonesCache.size} zones`);

    return Array.from(this.zonesCache.values());
  }

  async getDevices(): Promise<HomeyDevice[]> {
    // Use cache if valid
    if (this.cacheValid.devices && this.devicesCache) {
      this.homey.log('✅ Using cached devices');

      // Still need fresh zone names
      const zones = await this.getZones(); // Uses zone cache
      const zoneNameMap = new Map(zones.map(z => [z.id, z.name]));

      return Array.from(this.devicesCache.values()).map(device => ({
        ...device,
        zoneName: zoneNameMap.get(device.zone) || device.zone
      }));
    }

    // Build cache
    this.homey.log('📦 Building devices cache from API...');
    const [devicesObj, zones] = await Promise.all([
      this.homeyApi.devices.getDevices(),
      this.getZones() // Uses zone cache if available
    ]);

    const zoneNameMap = new Map(zones.map(z => [z.id, z.name]));

    this.devicesCache = new Map();
    Object.values(devicesObj).forEach((device: any) => {
      this.devicesCache!.set(device.id, {
        id: device.id,
        name: device.name,
        zone: device.zone,
        zoneName: zoneNameMap.get(device.zone) || device.zone,
        driverUri: device.driverId || 'unknown',
        class: device.class,
        capabilities: device.capabilities || [],
        // Note: NOT caching capabilitiesObj (current values)
        available: device.available !== false,
        ready: device.ready !== false,
      });
    });

    this.cacheValid.devices = true;
    this.homey.log(`✅ Cached ${this.devicesCache.size} devices`);

    return Array.from(this.devicesCache.values());
  }

  // Helper: Get single device (uses cache)
  async getDevice(deviceId: string): Promise<HomeyDevice | null> {
    const devices = await this.getDevices(); // Uses cache
    return devices.find(d => d.id === deviceId) || null;
  }

  // Helper: Get single zone (uses cache)
  async getZone(zoneId: string): Promise<HomeyZone | null> {
    const zones = await this.getZones(); // Uses cache
    return zones.find(z => z.id === zoneId) || null;
  }
}
```

### What to Cache (IF IMPLEMENTED)

**✅ CACHE (metadata only):**
- Zone ID, name, parent, icon, hierarchy
- Device ID, name, zone, class, capabilities **LIST**
- Device availability, ready status

**❌ NEVER CACHE (real-time data):**
- Device capability **VALUES** (onoff, dim, temperature)
- Zone activity status (active, activeOrigins)
- Any current state information

### Performance Impact (IF IMPLEMENTED)

**Before caching:**
```
Conversation: "Turn on kitchen lights"
Total API calls: ~12-17
Idle time: 0 API calls ✅
```

**After event-based caching:**
```
Conversation: "Turn on kitchen lights"
- First call: 2 API calls (build cache)
- Subsequent: 0-5 API calls (only setValue calls)
Total: ~5-7 API calls (-60%)

Idle time: 0 API calls ✅ (NO POLLING!)
```

**Memory footprint:**
- ~60KB total (100 devices + 50 zones)
- Negligible impact

---

## Why NOT Polling-Based Caching

**Rejected approach:** TTL-based cache with background polling

**Problems:**
1. **Wasteful**: Polling every 5 min = API calls when no one is using the system
2. **Load generation**: 95% of the time there's no AI conversation
3. **Unnecessary**: Homey API is local (fast already)
4. **Counterproductive**: More load on Homey than we save

**Conclusion:** If we cache, it MUST be event-based, not polling-based.

---

## Implementation Checklist (IF NEEDED)

If performance measurements show caching is needed:

### Phase 1: Event Listeners
- [ ] Add event listeners in `ZoneDeviceManager.init()`
- [ ] Listen to `zone.create`, `zone.delete`, `zone.update`
- [ ] Listen to `device.create`, `device.delete`, `device.update`
- [ ] Implement cache invalidation handlers

### Phase 2: Cache Storage
- [ ] Add `zonesCache: Map<string, HomeyZone>`
- [ ] Add `devicesCache: Map<string, HomeyDevice>`
- [ ] Add `cacheValid` flags
- [ ] Implement lazy cache building

### Phase 3: Method Updates
- [ ] Update `getZones()` to use cache
- [ ] Update `getDevices()` to use cache
- [ ] Update `getZone(id)` to use cache lookup
- [ ] Update `getDevice(id)` to use cache lookup
- [ ] Keep `getStates()` fresh (no caching)

### Phase 4: Testing
- [ ] Test cache invalidation on zone rename
- [ ] Test cache invalidation on device add/remove
- [ ] Verify no stale data issues
- [ ] Measure actual performance improvement
- [ ] Test event listener cleanup on app shutdown

### Phase 5: Monitoring
- [ ] Add logging for cache hits/misses
- [ ] Track API call reduction
- [ ] Monitor memory usage
- [ ] Watch for event listener failures

---

## Performance Measurement Plan

**Before implementing caching, measure:**

1. **API Call Count**
   - Log every `homeyApi.zones.getZones()` call
   - Log every `homeyApi.devices.getDevices()` call
   - Count calls per conversation
   - Identify duplicate calls

2. **Response Times**
   - Measure `getZones()` execution time
   - Measure `getDevices()` execution time
   - Measure `getHomeStructure()` total time
   - Compare to acceptable thresholds

3. **Conversation Patterns**
   - Track typical user requests
   - Identify most common operations
   - Find worst-case scenarios
   - Calculate average API calls per interaction

**Acceptable thresholds:**
- If API calls < 100ms: probably fine without cache
- If API calls < 20 per conversation: probably fine
- If no user complaints: probably fine

**When to implement caching:**
- API calls > 200ms consistently
- API calls > 50 per conversation
- User complaints about slowness
- Homey performance degradation visible

---

## Alternative Optimizations (Consider First)

Before implementing caching, try these simpler optimizations:

1. **Batch API Calls**
   - Use `Promise.all()` for parallel fetches
   - Already done in `getDevices()` ✅

2. **Reduce Redundant Lookups**
   - Pass zone names from parent calls
   - Avoid re-fetching same data

3. **Lazy Loading**
   - Only fetch data when actually needed
   - Don't pre-fetch everything

4. **Request Deduplication**
   - If two tools request same data simultaneously
   - Share single API call result

---

## References

- **Homey API Documentation**: https://athombv.github.io/node-homey-api/
- **ManagerDevices Events**: https://athombv.github.io/node-homey-api/HomeyAPIV2.ManagerDevices.html
- **ManagerZones Events**: https://athombv.github.io/node-homey-api/HomeyAPIV2.ManagerZones.html
- **Homey Apps SDK**: https://apps.developer.homey.app/

---

## Decision Log

**2025-10-25:** DEFER caching implementation
- **Reason**: Homey API is local, likely fast enough
- **Next step**: Measure performance in production
- **If needed**: Implement event-based caching (NOT polling)
- **Documentation**: Strategy preserved in this file

---

**Last Updated:** 2025-10-25
**Status:** Research complete, implementation deferred pending measurements
**Contact:** Review this document when performance issues arise
