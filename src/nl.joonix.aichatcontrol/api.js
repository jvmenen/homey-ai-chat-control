'use strict';

const { MCP_SERVER_CONFIG } = require('./lib/constants');

module.exports = {
  async getSettingsConfig({ homey }) {
    try {
      // Check if we're on Homey Cloud (where getLocalAddress is not supported)
      if (homey.platform === 'cloud') {
        return {
          error: 'This app requires Homey Pro with local network connectivity',
          platform: 'cloud',
        };
      }

      // Get Homey's local IP address
      const localAddress = await homey.cloud.getLocalAddress();

      // Remove port from IP address if present (getLocalAddress may return IP:port)
      const ipAddress = localAddress.split(':')[0];

      return {
        homeyIp: ipAddress,
        port: MCP_SERVER_CONFIG.HTTP_PORT,
        mcpUrl: `http://${ipAddress}:${MCP_SERVER_CONFIG.HTTP_PORT}/mcp`,
      };
    } catch (error) {
      homey.app.error('Failed to get local address:', error);
      throw new Error('Failed to retrieve Homey IP address: ' + error.message);
    }
  },
};
