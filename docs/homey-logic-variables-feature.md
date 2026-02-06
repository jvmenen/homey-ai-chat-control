# Feature: Logic Variables Support voor Homey MCP Server

## Overzicht

Voeg ondersteuning toe voor het ophalen en bijwerken van Homey Logic variables via de MCP server. Logic variables worden gebruikt in flows voor conditionals en zijn essentieel voor het dynamisch aanpassen van automatiseringsgedrag.

## Use Case

**Scenario**: Gebruiker heeft een flow die de verlichting op zolder aanstuurt op basis van een lux-drempelwaarde die opgeslagen is in een logic variable. Door een dakraam is het nu lichter op zolder, dus moet de drempelwaarde aangepast worden van 50 naar 30 lux. Dit moet via AI kunnen zonder handmatig in de Homey interface te hoeven.

## API Referentie

Volgens de Homey Web API documentatie (HomeyAPIV2.ManagerLogic):

### GET Variables
```
GET /api/manager/logic/variable
```
Returns: `Promise<Object<string, HomeyAPIV2.ManagerLogic.Variable>>`

### GET Single Variable  
```
GET /api/manager/logic/variable/:id
```
Returns: `Promise<HomeyAPIV2.ManagerLogic.Variable>`

### UPDATE Variable
```
PUT /api/manager/logic/variable/:id
```
Body: `{ variable: { value: <new_value> } }`
Returns: `Promise<HomeyAPIV2.ManagerLogic.Variable>`

### Variable Object Structure
```typescript
{
  id: string;
  name: string;
  type: "number" | "boolean" | "string";
  value: number | boolean | string;
}
```

## Te Implementeren Tools

### 1. `get_logic_variables`

**Doel**: Haal alle logic variables op met hun huidige waarden

**Parameters**: 
- `filter_type` (optioneel): Filter op variabele type ("number", "boolean", "string")
- `search_name` (optioneel): Zoek op (deel van) variabele naam (case-insensitive)

**Output**: Lijst van logic variables met id, naam, type en huidige waarde

**Voorbeeld gebruik**:
```javascript
// Alle variables
await get_logic_variables({})

// Alleen number variables
await get_logic_variables({ filter_type: "number" })

// Zoek op naam
await get_logic_variables({ search_name: "lux" })
```

**Output formaat**:
```xml
<logic-variables count="3">
  <variable id="a356b941-dbb0-443d-9a57-b21e0e282464" name="zolder_lux_drempel" type="number" value="50" />
  <variable id="635d7d5b-ea2f-4cf7-af21-38433d1fa892" name="isKidsWeek" type="boolean" value="true" />
  <variable id="d189b753-8107-4720-927f-148ae03b71cb" name="WasmachineAan" type="number" value="0" />
</logic-variables>
```

### 2. `update_logic_variable`

**Doel**: Update de waarde van een logic variable

**Parameters**:
- `id` (optioneel): Variable ID (gebruik dit ÓÓOF name)
- `name` (optioneel): Variable naam (gebruik dit ÓÓOF id)
- `value` (verplicht): Nieuwe waarde (type moet matchen met variable type)

**Logica**:
1. Als `id` gegeven is: gebruik die direct
2. Als `name` gegeven is: eerst opzoeken via `get_logic_variables`, dan ID gebruiken
3. Valideer dat type van `value` overeenkomt met variable type
4. Update via API call

**Voorbeeld gebruik**:
```javascript
// Update via ID
await update_logic_variable({ 
  id: "a356b941-dbb0-443d-9a57-b21e0e282464", 
  value: 30 
})

// Update via naam (handiger voor AI)
await update_logic_variable({ 
  name: "zolder_lux_drempel", 
  value: 30 
})
```

**Output formaat**:
```xml
<updated-variable id="a356b941-dbb0-443d-9a57-b21e0e282464" name="zolder_lux_drempel" type="number" old-value="50" new-value="30" />
```

## Implementatie Details

### Bestandslocatie
Voeg nieuwe functies toe aan het bestaande Homey MCP server bestand (waarschijnlijk `src/homey-mcp-server.ts` of vergelijkbaar)

### API Client
Gebruik de bestaande Homey API client instance die al gebruikt wordt voor andere calls (devices, zones, flows, etc.)

### Error Handling
- Als variable niet gevonden via naam → duidelijke foutmelding met lijst van beschikbare variables
- Als type mismatch bij update → foutmelding met verwacht type
- Als beide `id` en `name` ontbreken → foutmelding
- Als API call faalt → Homey API error doorsturen

### Type Safety
```typescript
type LogicVariableType = "number" | "boolean" | "string";

interface LogicVariable {
  id: string;
  name: string;
  type: LogicVariableType;
  value: number | boolean | string;
}

interface GetLogicVariablesParams {
  filter_type?: LogicVariableType;
  search_name?: string;
}

interface UpdateLogicVariableParams {
  id?: string;
  name?: string;
  value: number | boolean | string;
}
```

### Tool Descriptions

**get_logic_variables**:
```
Retrieve all Homey Logic variables with their current values. Logic variables are used in flows for dynamic automation behavior, storing values like thresholds, counters, flags, and text. Can filter by variable type or search by name.
```

**update_logic_variable**:
```
Update the value of a Homey Logic variable by ID or name. Logic variables control flow behavior - use this to adjust thresholds (e.g., lux levels), toggle boolean flags, or update text values. The value type must match the variable's defined type.
```

## Test Scenario

Na implementatie, test met dit scenario:

1. **Ophalen**: "Laat me alle logic variables zien die met 'lux' te maken hebben"
   - Verwacht: Tool haalt variables op met search_name="lux"
   
2. **Update**: "Zet de zolder lux drempel naar 30"
   - Verwacht: Tool zoekt variable met name="zolder_lux_drempel", update value naar 30
   
3. **Verificatie**: "Wat is de huidige waarde van de zolder lux drempel?"
   - Verwacht: Tool haalt variable op en toont value=30

## Dependencies

Geen nieuwe dependencies nodig - gebruik bestaande:
- Homey API client (al aanwezig)
- MCP server framework (al aanwezig)

## Documentatie Updates

Update de README.md met:
- Beschrijving van de twee nieuwe tools
- Voorbeeld use cases
- Notitie over logic variable types en hun gebruik in flows

## Prioriteit

**High** - Deze functionaliteit maakt het mogelijk om flow-gedrag dynamisch aan te passen zonder flows te moeten bewerken, wat essentieel is voor slimme automatisering.
