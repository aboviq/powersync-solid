import { createSignal, createEffect } from 'solid-js';
import { usePowerSync } from './PowerSyncContext';

/**
 * Custom hook that provides access to the current status of PowerSync.
 * @returns The PowerSync Database status.
 * @example
 * const Component = () => {
 *   const status = useStatus();
 *
 *   return <div>
 *     <Show when={status().connected} fallback="wifi-off">wifi</Show>
 *   </div>
 * };
 */
export const useStatus = () => {
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
