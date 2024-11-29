import { createSignal, createEffect } from 'solid-js';
import { usePowerSync } from './PowerSyncContext';

/**
 * Custom hook that provides access to the current status of PowerSync.
 * @returns The PowerSync Database status.
 * @example
 * const Component = () => {
 *   const status = usePowerSyncStatus();
 *
 *   return <div>
 *     <Show when={status.connected} fallback="wifi-off">wifi</Show>
 *   </div>
 * };
 */
export const usePowerSyncStatus = () => {
  const powerSync = usePowerSync();
  const [syncStatus, setSyncStatus] = createSignal(powerSync.currentStatus);

  createEffect(() =>
    powerSync.registerListener({
      statusChanged: status => {
        setSyncStatus(status);
      },
    }),
  );

  return syncStatus;
};
