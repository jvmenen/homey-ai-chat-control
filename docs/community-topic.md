# [APP][Pro] AI Chat Control - Control your Homey with AI assistants using natural language

![AI Chat Control](https://raw.githubusercontent.com/jvmenen/homey-ai-chat-control/main/src/nl.joonix.aichatcontrol/assets/images/large.png)

Control your Homey with AI assistants like Claude using natural language. This app uses the Model Context Protocol (MCP) to enable seamless communication between AI assistants and your Homey smart home.

---

## Links

- **[Homey App Store](https://homey.app/en-us/app/nl.joonix.aichatcontrol/AI-Chat-Control/)**
- **[Full Documentation](https://jvmenen.github.io/homey-ai-chat-control/)** - Complete setup guide, troubleshooting, and examples
- **[GitHub Repository](https://github.com/jvmenen/homey-ai-chat-control)**
- **[Report Issues](https://github.com/jvmenen/homey-ai-chat-control/issues)**

---

## What is AI Chat Control?

AI Chat Control brings the power of AI to your smart home by connecting your Homey to advanced AI assistants like Claude. Using natural language, you can ask your AI assistant to control devices, trigger flows, and get information about your home - all without navigating through apps or remembering exact commands.

**Key Features:**
- Natural language device control
- Custom Flow triggers with parameters
- AI-powered smart queries ("Which windows are open?")
- Zone control support
- Compatible with any MCP-enabled AI assistant

---

## Quick Start

**Requirements:**
- Homey Pro (2023) or newer (firmware >=12.4.0)
- Computer and Homey on the same local network
- AI assistant with MCP support (e.g., Claude Desktop)

**Installation:**
1. Install the app from the Homey App Store
2. Find your Homey's IP address (Homey app → More → Settings → General → About)
3. Configure your AI assistant (see full documentation for detailed instructions)

**Example Commands:**
- "What devices do I have in my home?"
- "Turn on all lights in the living room"
- "What's the temperature in the bedroom?"
- "Which windows are open right now?"

---

## Creating Custom Commands

The real power comes from creating custom commands using the **"AI Tool call"** Flow trigger card. This card teaches your AI assistant what your Flow does and triggers it with parameters.

**Quick Example:**
1. Create a Flow with the "AI Tool call" trigger
2. Configure: Command `play_radio`, Description "Play a radio station", Parameters `streamUrl: string`
3. Use the `{{Parameter 1}}` token in your Flow actions
4. Ask your AI: "Play BBC1 on the kitchen radio"

For detailed parameter syntax, examples, and troubleshooting, see the **[full documentation](https://jvmenen.github.io/homey-ai-chat-control/)**.

---

## Supported AI Assistants

Currently tested and working with:
- **Claude Desktop** (primary support)
- **N8N**, **Zapier** and dev tools like **Cursor** and **Windsurf**
- Any MCP-compatible AI assistant

---

## Changelog

### v1.0.1 (2025-01-XX)
- Improved readme's and developer info

### v1.0.0 (2025-01-XX)
- Initial release
- MCP server implementation
- Direct device control
- Flow trigger card for custom commands
- Support for Claude Desktop

---

## Support & Feedback

- **Questions?** Ask in this forum topic
- **Bug reports & feature requests**: [GitHub Issues](https://github.com/jvmenen/homey-ai-chat-control/issues)
- **Full documentation**: [jvmenen.github.io/homey-ai-chat-control](https://jvmenen.github.io/homey-ai-chat-control/)

**Support development**: Donations welcome via Bunq: **@HomeyAIChatControl**

---

**Developer:** Jeroen van Menen | [GitHub](https://github.com/jvmenen)

Made for the Homey community 🏠🤖