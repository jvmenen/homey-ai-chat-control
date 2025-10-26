# Parsers Directory

This directory contains parsing utilities for incoming data.

## Purpose
Parsers extract and validate structured information from various sources (Homey flows, parameters, etc.).

## Parsers
- `flow-parser.ts` - Parse Homey flows to extract MCP command info
- `parameter-parser.ts` - Parse parameter definitions from flow descriptions

## Usage
```typescript
import { FlowParser } from './parsers/flow-parser';

const parser = new FlowParser();
const flowInfo = parser.parseFlow(homeyFlow);
```

## Benefits
- Centralized parsing logic
- Eliminates code duplication
- Easy to test
- Consistent error handling
