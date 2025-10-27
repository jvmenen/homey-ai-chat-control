# Utils Directory

This directory contains utility classes and helper functions.

## Purpose
Shared utilities used across the application for common operations like logging, error handling, value conversion, etc.

## Utilities
- `errors.ts` - Custom error classes
- `constants.ts` - Application-wide constants
- `capability-value-converter.ts` - Type conversion for device capabilities
- `discovery-logger.ts` - Logging utilities for flow discovery

## Usage
```typescript
import { DeviceNotFoundError } from './utils/errors';
import { MCP_SERVER_CONFIG } from './utils/constants';

throw new DeviceNotFoundError(deviceId);
```

## Benefits
- DRY (Don't Repeat Yourself)
- Consistent behavior
- Easy to maintain
- Type-safe constants
