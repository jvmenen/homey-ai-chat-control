# AI Chat Control for Homey

Control your Homey smart home using AI assistants like Claude through natural language conversations.

## Overview

AI Chat Control brings the power of AI to your smart home by connecting your Homey to advanced AI assistants like Claude. Using natural language, you can ask your AI assistant to control devices, trigger flows, and get information about your home - all without navigating through apps or remembering exact commands.

The app works by running a local server on your Homey that communicates with your AI assistant via the Model Context Protocol (MCP) standard. This means you need to be on the same network as your Homey for the connection to work.

## Features

- **Natural Language Control**: Talk to your AI assistant in plain language to control your smart home
- **Direct Device Control**: Control any Homey device without creating Flows
- **Custom AI Tools**: Create custom Flow triggers that appear as tools to Claude
- **AI-Powered Queries**: Ask intelligent questions about your home (e.g., "Which windows are open?", "What's the average temperature?")
- **MCP Standard**: Built on the Model Context Protocol for broad AI assistant compatibility
- **Local Network**: Runs securely on your local network

## Requirements

- Homey Pro (2023 or later) with firmware >= 12.4.0
- AI assistant with MCP support (e.g., Claude Desktop)
- Both Homey and your computer must be on the same local network

## Installation

### Step 1: Install the App

1. Open the Homey app on your phone
2. Go to **More** → **Apps**
3. Tap the **+** (plus) icon to add a new app
4. Search for **"AI Chat Control"**
5. Tap **Install**

### Step 2: Find Your Homey's IP Address

**Method 1: Via Homey App**
1. Open the Homey app
2. Go to **More** → **Settings**
3. Under System Info, tap **General**
4. Tap **About**
5. Under Connectivity, look for the **Wi-Fi address** value

**Method 2: Via Router**
1. Log in to your router's admin panel
2. Look for connected devices
3. Find "Homey" in the device list

### Step 3: Configure Claude Desktop

1. Locate your Claude Desktop config file:
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. Add the following configuration (replace `[YOUR-HOMEY-IP]` with your actual Homey IP):

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

3. **Completely quit** Claude Desktop (use Task Manager/Activity Monitor to ensure it's fully closed)
4. Start Claude Desktop again

### Step 4: Test the Connection

Ask Claude: **"What devices do I have in Homey?"**

If everything is configured correctly, Claude will list your devices!

## Usage

### Basic Device Control

These commands work out of the box without creating any Flows:
- "Is the attic light on?"
- "Set the thermostat to 18 degrees"
- "What's the temperature in the bedroom?"
- "Turn on the lights in the living room"
- "Turn off all devices in the kitchen"

### AI-Powered Queries

Claude can analyze your Homey data intelligently:
- "Which windows are open right now?"
- "What brands of devices do I have?"
- "Which devices are offline?"
- "What's the average temperature in my home?"
- "Which devices use the most energy?"

### Custom AI Tools with Flow Triggers

Create Flows that Claude can trigger as custom tools:

1. **Create a Flow** with the **"AI Tool call"** trigger card
2. **Configure the trigger**:
   - **Command**: `play_radio` (the command name)
   - **Description**: "Play a radio station on the kitchen radio"
   - **Parameters** (one per line):
     ```
     streamUrl: string - Radio stream URL
     streamName: string - Name of the radio station
     ```
3. **Add Flow actions** using the parameter tokens (`{{Parameter 1}}`, `{{Parameter 2}}`, etc.)
4. **Refresh Claude's flow list**: Ask Claude "Refresh the Homey flows"
5. **Test**: Ask Claude "Start radio station BBC1 on the kitchen radio"

#### Parameter Format

Format: `parameter_name: type - Description`

**Important**: Each parameter must be on its own line!

**Supported types**:
- `string` - Any text
- `number` - Numbers
- `boolean` - true or false

**Optional parameters**: Add `?` after the type
```
volume: number? - Optional volume level
```

**Ranges** (for numbers):
```
temperature: number(16-30) - Temperature in degrees Celsius
brightness: number(0-100) - Brightness percentage
```

**Enums** (for strings):
```
mode: string(on|off|auto) - Operating mode
color: string(red|green|blue) - Light color
```

## Flow Cards

### Triggers

**AI Tool call**
- Triggered when Claude calls a custom tool
- Configuration:
  - **Command**: The command name that triggers this Flow
  - **Description**: Explains to Claude what this command does
  - **Parameters**: Optional parameters (one per line)
- Tokens: `{{Command}}`, `{{Parameter 1}}` through `{{Parameter 5}}`
- Use case: Create custom AI commands for complex automations

## Network Requirements

⚠️ **Important**: This app requires your AI assistant and Homey to be on the same local network. The app runs a local server and is not accessible from outside your network for security reasons.

## Privacy & Security

- All communication happens locally on your network
- No data is sent to external servers (except your chosen AI assistant)
- The app requires the `homey:manager:api` permission to access device and flow information

## Troubleshooting

### Claude Can't Connect to Homey

1. **Check Network**: Verify your computer and Homey are on the same network
2. **Test Connection**: Open `http://[YOUR-HOMEY-IP]:3000/health` in a browser - you should see a JSON response
3. **Verify Configuration**: Double-check the IP address in your Claude config
4. **Restart**: Completely quit and restart Claude Desktop

### Flow Triggers Not Working

1. Check that the command name in your Flow exactly matches what you tell Claude
2. Make sure the Flow is enabled
3. Ask Claude to refresh: "Refresh the Homey flows"

### Commands Not Recognized

- Be specific: "Turn on the living room lights" instead of "lights on"
- Use exact device names as they appear in Homey
- Claude understands natural language - just ask normally

## Documentation

For detailed documentation including step-by-step guides and examples, see the [full documentation](docs/index.html).

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
