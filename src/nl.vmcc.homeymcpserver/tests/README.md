# Tests Directory

This directory contains all test files.

## Structure
- `tools/` - Unit tests for tool handlers
- `formatters/` - Unit tests for formatters
- `parsers/` - Unit tests for parsers
- `integration/` - Integration tests for MCP server

## Running Tests
```bash
npm test                    # Run all tests
npm test -- tools/         # Run only tool tests
npm test -- --coverage     # Run with coverage report
```

## Test Naming Convention
- Test files: `*.test.ts`
- Match source file names: `home-structure-tool.test.ts` tests `home-structure-tool.ts`

## Setup (To Do)
```bash
npm install --save-dev jest @types/jest ts-jest
npx ts-jest config:init
```

## Writing Tests
See `refactoring-tasks.md` for test examples and patterns.
