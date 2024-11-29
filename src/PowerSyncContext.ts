import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { createContext, useContext } from 'solid-js';

export const PowerSyncContext = createContext<AbstractPowerSyncDatabase>();

/**
 * Custom hook that provides access to the PowerSync context.
 *
 * @returns The PowerSync Database instance.
 * @example
 * const Component = () => {
 *   const db = usePowerSync();
 *   const [lists, setLists] = createSignal([]);
 *
 *   createEffect(() => {
 *     db.getAll('SELECT * from lists').then(setLists)
 *   });
 *
 *   return <ul>
 *     <For each={lists()}>{(list) => <li>{list.name}</li>}</For>
 *   </ul>
 * };
 */
export const usePowerSync = () => {
  const powerSync = useContext(PowerSyncContext);

  if (!powerSync) {
    throw new Error('PowerSync context is not available');
  }

  return powerSync;
};
