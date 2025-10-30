# Release Notes - AI Chat Control v2.0.0

**Release Date:** 30 Oktober 2025
**Previous Version:** 1.0.2

## 🎯 Overzicht

Versie 2.0.0 brengt krachtige nieuwe mogelijkheden voor historische data analyse en flow inzicht. De belangrijkste toevoeging is de **Insights feature** waarmee je AI assistent historische device data kan opvragen en analyseren. Daarnaast zijn er verbeteringen in flow analyse en een belangrijke fix voor custom flow triggers.

---

## ✨ Nieuwe Features

### 1. Insights - Historische Data Tracking

De grootste nieuwe feature! Je AI assistent kan nu historische device data bevragen en analyseren over tijd.

**Wat kan het:**
- Temperatuur historiek opvragen: *"Wat was de temperatuur in de woonkamer gisteren om 14:00?"*
- Energieverbruik analyseren: *"Toon het energieverbruik van de wasmachine afgelopen week"*
- Sensor geschiedenis bekijken: *"Wanneer is de bewegingssensor in de gang voor het laatst getriggerd?"*
- Trends vergelijken: *"Vergelijk de temperatuur trends tussen de woonkamer en slaapkamer"*

**Technische details:**
- 2 nieuwe MCP tools: `get_insight_logs` en `get_insight_data`
- Ondersteunt meerdere tijdsresoluties:
  - lastHour, last6Hours, last24Hours
  - last7Days, last14Days, last31Days
  - today, thisWeek, thisMonth, thisYear
- Filters op device ID, zone ID en log type (number/boolean)
- Device en zone informatie automatisch toegevoegd voor context
- ~600 regels nieuwe code

**Nieuwe componenten:**
- `InsightsManager` - Core manager voor insights discovery en data ophalen
- `XMLFormatter` extensies voor insights formatting
- `GetInsightLogsTool` - Ontdek beschikbare insights
- `GetInsightDataTool` - Haal historische data op

**Use cases:**
```
"Wat was de gemiddelde temperatuur in de woonkamer afgelopen week?"
"Hoeveel energie heeft de wasmachine vandaag verbruikt?"
"Laat de luchtvochtigheid trend van de badkamer zien"
"Wanneer was de voordeur voor het laatst geopend?"
```

---

### 2. Flow Overview Tool

Krijg een compleet overzicht van alle automation flows in één API call, met krachtige filter opties.

**Wat kan het:**
- Alle flows ophalen met triggers, conditions en actions
- Filteren op specifieke devices, folders of apps
- Inzicht in welke apps welke cards leveren
- Welke devices gebruikt worden in flows
- MCP flows (AI-aanroepbaar) worden gemarkeerd met `mcp-command` attribuut

**Filter opties:**
- `device_ids`: Vind flows die specifieke devices gebruiken
- `folder_paths`: Filter op flow folder (bijv. "Home/Living Room")
- `app_ids`: Vind flows die specifieke apps gebruiken
- `include_disabled`: Toon ook uitgeschakelde flows

**Nieuwe tool:**
- `get_flow_overview` - Compleet flow overzicht met filters

**Use cases:**
```
"Welke flows gebruiken de Philips Hue lamp in de slaapkamer?"
"Toon alle flows in de woonkamer folder"
"Welke automations gebruiken de Somfy app?"
```

---

### 3. Get Installed Apps Tool

Overzicht van alle geïnstalleerde Homey apps met hun capabilities.

**Wat kan het:**
- Lijst van alle apps met ID, naam en versie
- Optioneel: Flow cards die elke app levert (triggers, conditions, actions)
- Optioneel: Devices per app
- Optioneel: Custom capabilities die elke app definieert
- Handig voor het vinden van app IDs om flows te filteren

**Nieuwe tool:**
- `get_installed_apps` - Lijst van geïnstalleerde apps

**Use cases:**
```
"Welke apps heb ik geïnstalleerd?"
"Toon alle flow cards van de Philips Hue app"
"Welke devices levert de Somfy app?"
```

---

### 4. Token Tracking in Flows

Verbeterde flow analyse met inzicht in dynamische variabelen (tokens).

**Verbeteringen:**
- Toont welke cards tokens **produceren** (droptoken: boolean)
- Toont welke cards tokens **consumeren** (droptoken: string met capability)
- Toont card **arguments** (parameters) in flow overview
- **Folder hiërarchie** ondersteuning (folder-path en folder-id)
- Device-to-app mapping voor accurate app attributie
- Ondersteuning voor systeem cards (homey:manager:logic)

**XML Format Verbeteringen:**
- Expliciete attribuut namen voor betere leesbaarheid:
  - `app-id`, `device-id`, `zone-id`, `folder-path`, etc.
- `<arg>` elements tonen card parameters
- `<token-input>` elements tonen consumed tokens
- `<token>` elements tonen produced tokens
- Vereenvoudigde instructies zonder redundantie

**Impact:**
Betere AI comprehensie van Homey flows door explicitere XML output en inzicht in dynamische variabelen.

---

## 🔧 Fixes & Verbeteringen

### 1. Flow Trigger Matching Fix ⚠️ BELANGRIJK

**Fix van bestaande functionaliteit**: De AI Tool Call trigger werkte niet correct en matcht nu flows betrouwbaarder.

**Probleem:**
Custom flows met de "AI Tool call" trigger werden niet altijd correct getriggerd door AI commands.

**Oplossing:**
- ✅ Toegevoegd: `registerRunListener` om flows correct te matchen op command argument
- ✅ Automatische command normalisatie (spaties → underscores, lowercase)
- ✅ Description en parameters zijn nu optioneel in flow trigger card
- ✅ Parameter types genormaliseerd naar lowercase (String → string)

**Impact:**
Als je custom AI flows hebt die niet werkten, werken deze nu waarschijnlijk wel!

**Commit:** d61e85e

---

### 2. Type Safety Verbeteringen

**Code kwaliteit verbetering** voor stabielere werking.

**Verbeteringen:**
- Vervang `any` types door proper Homey SDK types
- `HomeyInstance` type alias voor consistentie
- `HomeyAPICard` interface voor flow card parsing
- Betere TypeScript type checking door alle managers en tools

**Impact:**
Betere code stabiliteit en minder runtime errors.

**Commit:** c1ce286

---

### 3. Flow Card Discovery Verbetering

**Verbeterde app attributie** in flow cards.

**Verbetering:**
- Flow cards worden nu opgehaald via API in plaats van manifest
- Filter op `ownerUri` voor accurate app toewijzing
- Fix voor `driverUri` deprecation warnings (nu `driverId`)
- Capabilities support toegevoegd

**Impact:**
Nauwkeuriger inzicht in welke app welke flow card levert.

**Commit:** c1ce286

---

## 📊 Statistieken

**Code wijzigingen sinds v1.0.2:**
- ✅ **1000+ regels nieuwe code** toegevoegd
- ✅ **4 nieuwe MCP tools** (get_insight_logs, get_insight_data, get_flow_overview, get_installed_apps)
- ✅ **5 nieuwe componenten** (InsightsManager + formatters + tools)
- ✅ **Verbeterde type safety** in alle 10+ bestaande tools
- ✅ **1 belangrijke fix** (flow trigger matching)

**Bestanden gewijzigd:**
- 21 bestanden aangepast voor type safety en flow overview
- 7 nieuwe bestanden voor insights feature
- 10 bestanden aangepast voor flow trigger fix

---

## 🚀 Upgrade Instructies

### Voor Gebruikers:

1. **Update de app** via de Homey App Store
2. **Herstart de app** (optioneel, gebeurt automatisch)
3. **Test nieuwe features**:
   - Vraag je AI: *"Wat was de temperatuur gisteren?"*
   - Vraag je AI: *"Welke flows gebruiken mijn Hue lampen?"*
   - Test je custom AI flows (als ze niet werkten, werken ze nu waarschijnlijk wel!)

### Voor Ontwikkelaars:

**Breaking Changes:** Geen - volledig backwards compatible

**Nieuwe Dependencies:**
- Geen nieuwe npm packages vereist

**API Wijzigingen:**
- 4 nieuwe MCP tools beschikbaar via `/mcp` endpoint
- Bestaande tools ongewijzigd (alleen internal type improvements)

---

## 📝 Voorbeelden

### Insights Queries

```typescript
// Vraag via Claude Desktop met MCP:

"Wat was de temperatuur in de woonkamer gisteren om 14:00?"
→ AI roept get_insight_logs aan om temperature logs te vinden
→ AI roept get_insight_data aan met lastHour resolutie

"Hoeveel energie heeft de wasmachine afgelopen week verbruikt?"
→ AI haalt measure_power insights op voor last7Days
→ AI berekent totaal verbruik uit data

"Vergelijk de temperatuur tussen woonkamer en slaapkamer"
→ AI haalt data voor beide zones op
→ AI maakt vergelijking en toont trends
```

### Flow Queries

```typescript
// Vraag via Claude Desktop met MCP:

"Welke flows gebruiken de lamp in de slaapkamer?"
→ AI roept get_home_structure aan om lamp device_id te vinden
→ AI roept get_flow_overview aan met device_ids filter
→ AI toont relevante flows

"Toon alle flows in de woonkamer folder"
→ AI roept get_flow_overview aan met folder_paths filter
→ AI toont georganiseerde flows

"Welke apps gebruik ik voor automatiseringen?"
→ AI roept get_installed_apps aan
→ AI roept get_flow_overview aan per app
→ AI toont overzicht per app
```

---

## 🐛 Known Issues

Geen bekende issues in deze release.

---

## 🙏 Credits

**Ontwikkeld door:** Jeroen van Menen
**Met hulp van:** Claude (Anthropic) via Claude Code
**Community:** Homey Community Forum

---

## 📚 Meer Informatie

- **Homepage:** https://jvmenen.github.io/homey-ai-chat-control/
- **Community:** https://community.homey.app/t/144644
- **GitHub:** https://github.com/jvmenen/homey-ai-chat-control
- **Issues:** https://github.com/jvmenen/homey-ai-chat-control/issues

---

## 🔜 Roadmap (Toekomstige Releases)

- ⏱️ Advanced scheduling features
- 📊 Enhanced analytics en rapportage
- 🔔 Notificaties via MCP
- 🎨 Custom UI elementen voor flows

---

**Geniet van de nieuwe features! 🎉**
