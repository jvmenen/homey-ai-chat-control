# Feature Request: Homey Moods API Ondersteuning

## Overzicht

Voeg ondersteuning toe voor de Homey Moods API aan de MCP server. Moods zijn lichtscènes die gebruikers hebben geconfigureerd in Homey, met specifieke instellingen per device (dim niveau, kleur, temperatuur, etc.).

## API Endpoints

De Homey Web API biedt de volgende endpoints voor Moods:

| Actie                   | HTTP Methode | Endpoint                          |
| ----------------------- | ------------ | --------------------------------- |
| Alle moods ophalen      | GET          | `/api/manager/moods/mood/`        |
| Specifieke mood ophalen | GET          | `/api/manager/moods/mood/:id`     |
| Mood activeren          | PUT          | `/api/manager/moods/mood/:id/set` |

## Response Structuur

### getMoods() Response

```typescript
interface MoodsResponse {
  [moodId: string]: Mood;
}

interface Mood {
  id: string;                    // UUID van de mood
  uri: string;                   // "homey:mood:{id}"
  name: string;                  // Gebruikersvriendelijke naam, bijv. "Sfeer", "Film"
  preset: string | null;         // Preset type: "night", "calm", of null voor custom
  zone: string;                  // Zone ID waar de mood bij hoort
  devices: {
    [deviceId: string]: {
      state: DeviceState;
    }
  }
}

interface DeviceState {
  onoff?: boolean;               // Aan/uit status
  dim?: number;                  // Dim niveau (0-1)
  light_mode?: "temperature" | "color";  // Lichtmodus
  light_temperature?: number;    // Kleurtemperatuur (0-1, warm naar koud)
  light_hue?: number;            // Kleurtint (0-1)
  light_saturation?: number;     // Kleurverzadiging (0-1)
}
```

### Voorbeeld Response

```json
{
  "134d4cc3-5ed6-4fe3-92f3-cf7b088958fd": {
    "id": "134d4cc3-5ed6-4fe3-92f3-cf7b088958fd",
    "uri": "homey:mood:134d4cc3-5ed6-4fe3-92f3-cf7b088958fd",
    "name": "Sfeer",
    "preset": null,
    "zone": "2213a922-5a2e-45c4-8e56-596c5abbeddc",
    "devices": {
      "e1b96442-6f4f-48f2-98a9-695e04cc29e8": {
        "state": {
          "onoff": true,
          "dim": 0.02,
          "light_mode": "temperature",
          "light_temperature": 0.88,
          "light_hue": 0,
          "light_saturation": 1
        }
      }
    }
  }
}
```

## Te Implementeren Tools

### 1. `get_moods`

Haal alle moods op met hun configuratie.

**Parameters:** Geen

**Returns:** Lijst van alle moods met:

- Mood naam en ID
- Zone naam (resolved via zones lookup)
- Aantal devices
- Preset type indien aanwezig

**Voorbeeld output:**

```
Moods:
- Sfeer (zone: Begane grond) - 6 devices, custom
- Film (zone: Begane grond) - 6 devices, preset: calm
- Game mood (zone: Tijmen) - 7 devices, custom
```

### 2. `get_mood_details`

Haal gedetailleerde informatie op van een specifieke mood.

**Parameters:**

- `moodId` (string, required): UUID van de mood
- OF `moodName` (string, optional): Naam van de mood (fuzzy match)

**Returns:** Volledige mood configuratie met:

- Alle device namen (resolved via devices lookup)
- Per device de ingestelde state waarden
- Zone naam

### 3. `trigger_mood` / `activate_mood`

Activeer een mood.

**Parameters:**

- `moodId` (string, required): UUID van de mood
- OF `moodName` (string, optional): Naam van de mood (fuzzy match)

**Returns:** Bevestiging dat de mood is geactiveerd

### 4. `find_device_in_moods`

Controleer of een device gebruikt wordt in één of meer moods. Dit is zeer handig bij device migraties of het verwijderen van devices.

**Parameters:**

- `deviceId` (string, required): UUID van het device

**Returns:** 

- Boolean of device in moods voorkomt
- Lijst van mood namen waar het device in zit
- Per mood: welke state het device heeft

**Use case:** Bij het migreren van een device (bijv. van Device Capabilities app naar native device groups) kan de gebruiker eerst checken of het oude device in moods zit voordat het verwijderd wordt.

## Implementatie Hints

### JavaScript/TypeScript API Calls

```typescript
// Alle moods ophalen
const moods = await homeyApi.moods.getMoods();

// Specifieke mood ophalen
const mood = await homeyApi.moods.getMood({ id: 'uuid-here' });

// Mood activeren
await homeyApi.moods.setMood({ id: 'uuid-here' });
```

### Integratie met bestaande tools

- `get_moods` zou zone namen moeten resolven via de bestaande zones data
- `get_mood_details` zou device namen moeten resolven via de bestaande devices data
- Overweeg om mood informatie toe te voegen aan `get_home_structure` output (optioneel)

## Testing

Test scripts voor HomeyScript (https://my.homey.app/script):

```javascript
// Test getMoods
(async () => {
  const moods = await Homey.moods.getMoods();
  return moods;
})();

// Test getMood
(async () => {
  const mood = await Homey.moods.getMood({ id: 'MOOD_UUID_HERE' });
  return mood;
})();

// Test setMood (activates the mood!)
(async () => {
  const result = await Homey.moods.setMood({ id: 'MOOD_UUID_HERE' });
  return result;
})();
```

## Notities

- De Moods API is niet officieel gedocumenteerd door Athom, maar werkt stabiel
- Moods bevatten alleen licht-gerelateerde devices
- Een mood is altijd gekoppeld aan één zone
- Presets zijn: "night", "calm", of null voor custom moods