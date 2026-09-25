# Formatters Directory

Each module turns the data of one topic into the XML text an MCP tool returns to the AI. One module per topic, plain exported functions, no shared state.

## Modules

| Module | Used by |
|---|---|
| `home-structure-formatter.ts` | `get_home_structure` |
| `device-states-formatter.ts` | `get_states` |
| `flow-overview-formatter.ts` | `get_flow_overview` |
| `insights-formatter.ts` | `get_insight_logs`, `get_insight_data` |
| `moods-formatter.ts` | `get_mood_details`, `find_device_in_moods` |
| `logic-variables-formatter.ts` | `get_logic_variables` |
| `zigbee-network-formatter.ts` | `get_zigbee_network` |
| `system-health-formatter.ts` | `get_homey_system_health` |
| `xml-utils.ts` | shared helpers: `escapeXml`, `escapeXmlText`, `xmlAttrs` |

## Usage

```typescript
import { formatHomeStructure } from '../formatters/home-structure-formatter';

const xml = formatHomeStructure(structure);
```

## Guidelines

- A formatter only renders; filtering and calculations belong in `lib/diagnostics/` or the managers.
- Escape every value that comes from Homey (names, texts) with the helpers in `xml-utils.ts`.
- Each output ends with an INSTRUCTIONS block that tells the AI how to read it.
