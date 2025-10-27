/**
 * Tool State Manager - Manages shared state for tools
 *
 * Provides a clean, type-safe way to manage mutable state that needs
 * to be shared between the app and tools without resorting to
 * poor man's reference objects like { value: string }
 */
export class ToolStateManager {
  private lastKnownToolsList: string = '';

  /**
   * Get the current tools list
   */
  getToolsList(): string {
    return this.lastKnownToolsList;
  }

  /**
   * Update the tools list
   */
  setToolsList(value: string): void {
    this.lastKnownToolsList = value;
  }

  /**
   * Check if the tools list has changed
   */
  hasChanged(newValue: string): boolean {
    return this.lastKnownToolsList !== newValue;
  }
}
