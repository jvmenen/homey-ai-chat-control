/**
 * Interfaces - Core abstractions for dependency injection and testability
 *
 * Purpose: Decouple components from concrete implementations
 * Benefits:
 * - Testability: Easy to mock dependencies
 * - Flexibility: Swap implementations without changing consumers
 * - Clarity: Explicit contracts between components
 */

export { IHomeyClient } from './IHomeyClient';
export { IHomeyApiClient } from './IHomeyApiClient';
export {
  IFlowManager,
  FlowOverviewData,
  FlowOverviewItem,
  FlowCardInfo,
  FlowOverviewOptions,
} from './IFlowManager';
export { IZoneDeviceManager } from './IZoneDeviceManager';
