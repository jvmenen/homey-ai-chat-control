import { MCP_SERVER_CONFIG } from './lib/constants';
import { getLocalIpAddress } from './lib/utils/network';
import type { HomeyInstance } from './lib/types';

interface SettingsConfigResult {
  error?: string;
  platform?: string;
  homeyIp?: string;
  port?: number;
  mcpUrl?: string;
}

module.exports = {
  async getSettingsConfig({ homey }: { homey: HomeyInstance }): Promise<SettingsConfigResult> {
    try {
      // Check if we're on Homey Cloud (where getLocalAddress is not supported)
      if (homey.platform === 'cloud') {
        return {
          error: 'This app requires Homey Pro with local network connectivity',
          platform: 'cloud',
        };
      }

      // Get Homey's local IP address
      const ipAddress = await getLocalIpAddress(homey);

      if (!ipAddress) {
        throw new Error('Unable to retrieve local IP address');
      }

      return {
        homeyIp: ipAddress,
        port: MCP_SERVER_CONFIG.HTTP_PORT,
        mcpUrl: `http://${ipAddress}:${MCP_SERVER_CONFIG.HTTP_PORT}/mcp`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      homey.app.error('Failed to get local address:', error);
      throw new Error('Failed to retrieve Homey IP address: ' + errorMessage);
    }
  },
};
