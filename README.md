# AI Chat Control for Homey

Control your Homey smart home using AI assistants like Claude through natural language conversations.

## Overview

AI Chat Control brings the power of AI to your smart home by connecting your Homey to advanced AI assistants like Claude. Using natural language, you can ask your AI assistant to control devices, trigger flows, and get information about your home - all without navigating through apps or remembering exact commands.

The app uses the Model Context Protocol (MCP) standard, making it compatible with any MCP-enabled AI assistant.

## Features

- **Natural Language Control**: Talk to your AI assistant in plain language to control your smart home
- **Device Management**: View and control all your Homey devices through AI
- **Flow Execution**: Trigger and manage Homey Flows via AI commands
- **Custom Commands**: Create custom Flow triggers that respond to specific AI commands
- **MCP Standard**: Built on the Model Context Protocol for broad AI assistant compatibility
- **Local Network**: Runs securely on your local network

## Requirements

- Homey Pro (2023 or later) with firmware >= 12.4.0
- AI assistant with MCP support (e.g., Claude Desktop)
- Both Homey and your computer must be on the same local network

## Installation

1. Install the app from the Homey App Store
2. Configure your AI assistant (e.g., Claude Desktop) to connect to the MCP server
3. The server will be available at `http://[your-homey-ip]:3000/mcp`

## Usage

### Basic Device Control

Simply ask your AI assistant:
- "Turn on the living room lights"
- "Set the thermostat to 21 degrees"
- "Show me all devices that are currently on"

### Flow Management

- "List all my flows"
- "Trigger the 'Good Morning' flow"
- "What flows are currently running?"

### Custom Commands with Flow Triggers

1. Create a Flow in Homey with the "MCP command received" trigger
2. Specify a command name (e.g., `play_radio`)
3. Optionally define parameters
4. Ask your AI assistant to execute the custom command

Example:
- Command: `play_radio`
- Parameters: `station: string, volume: number`
- Usage: "Play NPR on the radio at volume 50"

## Configuration

### MCP Server Endpoint

The app automatically starts an MCP server on your Homey at:
```
http://[homey-ip]:3000/mcp
```

### Claude Desktop Configuration

Add to your Claude Desktop MCP settings (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "homey": {
      "url": "http://[your-homey-ip]:3000/mcp"
    }
  }
}
```

## Flow Cards

### Triggers

**MCP command received**
- Triggered when the AI assistant sends a custom command
- Tokens: `command`, `value1`, `value2`, `value3`, `value4`, `value5`
- Use case: Create custom voice commands for complex automations

## Network Requirements

⚠️ **Important**: This app requires your AI assistant and Homey to be on the same local network. The app runs a local server and is not accessible from outside your network for security reasons.

## Privacy & Security

- All communication happens locally on your network
- No data is sent to external servers (except your chosen AI assistant)
- The app requires the `homey:manager:api` permission to access device and flow information

## Troubleshooting

### Connection Issues

1. Verify both devices are on the same network
2. Check your Homey's local IP address in the Homey app
3. Ensure port 3000 is not blocked by your firewall
4. Restart the AI Chat Control app if needed

### AI Assistant Not Responding

1. Verify the MCP server URL is correct in your AI assistant settings
2. Check the Homey app logs for any errors
3. Ensure your AI assistant supports MCP

## Technical Details

- **Protocol**: Model Context Protocol (MCP)
- **Server Port**: 3000
- **API Version**: Compatible with Homey API v3
- **Platform**: Local only (no cloud dependency)

## Development

### Building from Source

```bash
cd src/nl.vmcc.homeymcpserver
npm install
homey app build
homey app install
```

### Running Tests

```bash
npm test
```

## Support

For issues, questions, or feature requests, please visit the [Homey Community Forum](https://community.homey.app/).

## Changelog

See [.homeychangelog.json](src/nl.vmcc.homeymcpserver/.homeychangelog.json) for version history.

## License

GPL-3.0 - See [LICENSE](src/nl.vmcc.homeymcpserver/LICENSE) for details.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](src/nl.vmcc.homeymcpserver/CONTRIBUTING.md) before submitting pull requests.

## Author

Jeroen van Menen - [jeroen@vanmenen.nl](mailto:jeroen@vanmenen.nl)

---

Made with ❤️ for the Homey community
