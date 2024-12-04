import {
  parseQuery,
  runOnSchemaChange,
  type CompilableQuery,
  type ParsedQuery,
  type SQLWatchOptions,
} from '@powersync/common';
import {
  createEffect,
  onCleanup,
  type Accessor,
  type ResourceReturn,
  type Resource,
  type Setter,
} from 'solid-js';
import { createStore } from 'solid-js/store';
import { usePowerSync } from './PowerSyncContext';

type MaybeAccessor<T> = T | Accessor<T>;

const toValue = <T>(value: MaybeAccessor<T>): T =>
  typeof value === 'function' ? (value as () => T)() : value;

export interface AdditionalOptions extends Omit<SQLWatchOptions, 'signal'> {
  runQueryOnce?: boolean;
}

/**
 * A hook to access the results of a watched query.
 *
 * It has the same return type as `createResource` from Solid.
 * It accepts both string queries with parameters or queries created with for instance Kysely.
 *
 * @example
 * export const Component = () => {
 *   const [lists] = useQuery('SELECT * from lists');
 *
 *   return <View>
 *     <For each={lists()>
 *       {(l) => (
 *         <Text key={l.id}>{JSON.stringify(l)}</Text>
 *       )}
 *     </For>
 *   </View>
 * }
 */
export const useQuery = <T = any>(
  query: MaybeAccessor<string | CompilableQuery<T>>,
  parameters: MaybeAccessor<any[]> = [],
  options: AdditionalOptions = { runQueryOnce: false },
): ResourceReturn<T[], undefined> => {
  const powerSync = usePowerSync();

  const [store, setStore] = createStore<{
    data?: T[];
    error?: Error;
    state: 'pending' | 'ready' | 'refreshing';
  }>({
    data: undefined,
    error: undefined,
    state: 'pending',
  });

  const data = (() => store.data) as Resource<T[]>;
  const setStoreData = setStore.bind(null, 'data');
  // @ts-expect-error - The signature is correct
  const setData: Setter<T[] | undefined> = (...args) => {
    setStoreData(...args);
    return store.data;
  };

  Object.defineProperties(data, {
    state: { get: () => (store.error ? 'errored' : store.state) },
    error: { get: () => store.error },
    loading: { get: () => store.state !== 'ready' },
    latest: { get: () => store.data },
  });

  let fetchData: (() => Promise<void>) | undefined;

  const handleResult = (result: T[]) => {
    setStore({ data: result, error: undefined, state: 'ready' });
  };

  const handleError = (e: Error) => {
    const wrappedError = new Error('PowerSync failed to fetch data: ' + e.message);
    wrappedError.cause = e;

    setStore((store) => ({ data: store.data, error: wrappedError, state: 'ready' }));
  };

  const _fetchData = async (executor: () => Promise<T[]>) => {
    setStore('state', (state) => (state === 'pending' ? state : 'refreshing'));

    try {
      const result = await executor();
      handleResult(result);
    } catch (e) {
      handleError(e as Error);
    }
  };

  const watchQuery = async (sql: string, parameters: any[], abortSignal: AbortSignal) => {
    let resolvedTables = [];

    try {
      resolvedTables = await powerSync.resolveTables(sql, parameters, options);
    } catch (e) {
      const wrappedError = new Error('PowerSync failed to parse query: ' + (e as Error).message);
      wrappedError.cause = e;

      handleError(wrappedError);
      return;
    }

    await fetchData?.();

    if (options.runQueryOnce) {
      return;
    }

    powerSync.onChangeWithCallback(
      {
        onChange: async () => {
          await fetchData?.();
        },
        onError: handleError,
      },
      {
        ...options,
        signal: abortSignal,
        tables: resolvedTables,
      },
    );
  };

  createEffect(() => {
    const abortController = new AbortController();
    const { signal } = abortController;

    onCleanup(() => {
      abortController.abort();
    });

    let parsedQuery: ParsedQuery;
    const queryValue = toValue(query);

    try {
      parsedQuery = parseQuery(
        queryValue,
        toValue(parameters).map((parameter) => toValue(parameter)),
      );
    } catch (e) {
      handleError(e as Error);
      return;
    }

    const executor =
      typeof queryValue === 'string'
        ? () => powerSync.getAll<T>(parsedQuery.sqlStatement, parsedQuery.parameters)
        : () => queryValue.execute();
    fetchData = () => _fetchData(executor);

    const updateData = async () => {
      await watchQuery(parsedQuery.sqlStatement, parsedQuery.parameters, signal);
    };

    runOnSchemaChange(updateData, powerSync, { signal });
  });

  return [
    data,
    {
      refetch: async () => {
        await fetchData?.();

        return store.data;
      },
      mutate: setData,
    },
  ];
};
