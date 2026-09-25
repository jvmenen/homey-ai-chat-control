/**
 * Shared test helpers
 */

import type { HomeyInstance } from '../lib/types';

/** Minimal stand-in for the Homey instance: the Logger only calls log() and error() */
export function fakeHomey(): HomeyInstance {
  return { log() {}, error() {} } as unknown as HomeyInstance;
}

/** Text of the first content item of a tool result */
export function resultText(result: { content: Array<{ text?: string }> }): string {
  return result.content[0]?.text ?? '';
}

export const HOUR = 3600000;
