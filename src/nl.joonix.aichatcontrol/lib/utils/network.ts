import type { HomeyInstance } from '../types';

/**
 * Get Homey's local IP address
 * @param homey - Homey instance
 * @returns Local IP address (without port) or null if unable to retrieve
 */
export async function getLocalIpAddress(homey: HomeyInstance): Promise<string | null> {
  try {
    // Check if we're on Homey Cloud (where getLocalAddress is not supported)
    if (homey.platform === 'cloud') {
      return null;
    }

    // Get Homey's local IP address
    const localAddress = await homey.cloud.getLocalAddress();

    // Remove port from IP address if present (getLocalAddress may return IP:port)
    return localAddress.split(':')[0];
  } catch (error) {
    return null;
  }
}
