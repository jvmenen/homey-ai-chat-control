# AI Chat Control for Homey

Control your Homey smart home using AI assistants like Claude through natural language conversations.

## What is this?

AI Chat Control connects your Homey to AI assistants like Claude Desktop. Simply talk to Claude in natural language to control devices, trigger flows, and get information about your home.

**Examples:**

- "Turn on the living room lights"
- "Which windows are open?"
- "Set the thermostat to 21 degrees"
- "What was the temperature in the living room yesterday at 2pm?"
- "Show me the energy consumption of the washing machine this week"
- "Which flows use my bedroom lamp?"

## Quick Start

1. Install the app from the Homey App Store
2. Find your Homey's local IP address
3. Configure Claude Desktop with this config:

```json
{
  "mcpServers": {
    "homey": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://[YOUR-HOMEY-IP]:3000/mcp",
        "--allow-http"
      ]
    }
  }
}
```

4. Restart Claude Desktop and ask: "What devices do I have in Homey?"

## Documentation

**For complete setup instructions, examples, and troubleshooting, see:**
📖 [https://jvmenen.github.io/homey-ai-chat-control/](https://jvmenen.github.io/homey-ai-chat-control/)

The documentation includes:
- Step-by-step installation guide
- How to find your Homey's IP address
- Creating custom AI tools with Flow triggers
- Parameter formatting (ranges, enums, optional parameters)
- Troubleshooting common issues
- Example flows and use cases

## Features

- **Direct Device Control** - Control any device without creating Flows
- **Historical Data Analysis** - Query device history and analyze trends over time
- **Flow Overview & Filtering** - Discover which flows use specific devices or apps
- **AI-Powered Queries** - Ask intelligent questions about your home
- **Custom AI Tools** - Create Flow triggers that appear as tools to Claude
- **Installed Apps Discovery** - View all apps and their capabilities
- **Local & Secure** - All communication stays on your local network
- **MCP Standard** - Compatible with any MCP-enabled AI assistant

## Requirements

- Homey Pro (2023 or later) with firmware >= 12.4.0
- AI assistant with MCP support (e.g., Claude Desktop)
- Both Homey and your computer on the same local network

## Support

Having issues? Check the [documentation](https://jvmenen.github.io/homey-ai-chat-control/) for troubleshooting tips.

## Development

### Building from Source

```bash
cd src/nl.joonix.aichatcontrol
npm install
homey app build
homey app install
```

### Running Tests

```bash
npm test
```

## Changelog

See [.homeychangelog.json](src/nl.joonix.aichatcontrol/.homeychangelog.json) for version history.

## License

GPL-3.0 - See [LICENSE](src/nl.joonix.aichatcontrol/LICENSE) for details.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](src/nl.joonix.aichatcontrol/CONTRIBUTING.md) before submitting pull requests.

## Author

Jeroen van Menen - [jeroen@vanmenen.nl](mailto:jeroen@vanmenen.nl)

---

Made with ❤️ for the Homey community
