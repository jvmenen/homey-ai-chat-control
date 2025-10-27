# Tools Directory

This directory contains all MCP tool handler implementations.

## Purpose
Each tool is a self-contained class that implements the `MCPToolHandler` interface. Tools handle specific MCP operations and are registered in the tool registry.

## Structure
- `base-tool.ts` - Base interface and abstract class for all tools
- `tool-registry.ts` - Central registry for managing tools
- Individual tool files (e.g., `home-structure-tool.ts`, `control-device-tool.ts`)

## Creating a New Tool
1. Extend `BaseTool` abstract class
2. Implement `name`, `getDefinition()`, and `execute()` methods
3. Register in `app.ts` during initialization

## Examples
See `set-light-tool.ts` or `home-structure-tool.ts` for examples.
