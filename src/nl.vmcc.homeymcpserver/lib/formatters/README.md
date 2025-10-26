# Formatters Directory

This directory contains response formatting utilities.

## Purpose
Formatters convert data structures (zones, devices, etc.) into presentable formats like XML, JSON, or readable text. This separates presentation logic from business logic.

## Formatters
- `xml-formatter.ts` - XML formatting for MCP responses
- `device-formatter.ts` - Device data formatting
- `zone-formatter.ts` - Zone and hierarchy formatting

## Usage
```typescript
import { XMLFormatter } from './formatters/xml-formatter';

const xml = XMLFormatter.formatHomeStructure(structure);
```

## Benefits
- Reusable formatting logic
- Easy to add new formats (JSON, YAML, etc.)
- Testable in isolation
- Single responsibility
