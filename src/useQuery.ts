import {
  parseQuery,
  type CompilableQuery,
  type ParsedQuery,
  type SQLWatchOptions,
} from '@powersync/common';
import {
  createSignal,
  createEffect,
  onCleanup,
  type ResourceReturn,
  type Resource,
} from 'solid-js';
import { usePowerSync } from './PowerSyncContext';

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
  query: string | CompilableQuery<T>,
  parameters: any[] = [],
  options: AdditionalOptions = { runQueryOnce: false },
): ResourceReturn<T[], undefined> => {
  let parsedQuery: ParsedQuery;
  const powerSync = usePowerSync();
  const [data, setData] = createSignal<T[] | undefined>(undefined);

  try {
    parsedQuery = parseQuery(query, parameters);
  } catch (error) {
    const wrappedError = new Error('PowerSync failed to parse query: ' + (error as Error).message);
    wrappedError.cause = error;

    Object.defineProperties(data, {
      state: { get: () => 'error' },
      error: { get: () => wrappedError },
      loading: { get: () => false },
    });

    return [
      data as Resource<T[]>,
      { refetch: () => Promise.reject(wrappedError), mutate: setData },
    ];
  }

  const { sqlStatement, parameters: queryParameters } = parsedQuery;

  const [error, setError] = createSignal<Error | undefined>(undefined);
  const [isLoading, setIsLoading] = createSignal(true);
  const [isFetching, setIsFetching] = createSignal(true);
  const [tables, setTables] = createSignal<string[]>([]);

  const memoizedParams = () => JSON.stringify(queryParameters);
  // const memoizedOptions = () => JSON.stringify(options);
  let abortController = new AbortController();
  let previousQueryRef = { sqlStatement, memoizedParams: memoizedParams() };

  const shouldFetch = () =>
    previousQueryRef.sqlStatement !== sqlStatement ||
    JSON.stringify(previousQueryRef.memoizedParams) != memoizedParams();

  const handleResult = (result: T[]) => {
    previousQueryRef = { sqlStatement, memoizedParams: memoizedParams() };
    setData(result);
    setIsLoading(false);
    setIsFetching(false);
    setError(undefined);
  };

  const handleError = (e: Error) => {
    previousQueryRef = { sqlStatement, memoizedParams: memoizedParams() };
    setData([]);
    setIsLoading(false);
    setIsFetching(false);
    const wrappedError = new Error('PowerSync failed to fetch data: ' + e.message);
    wrappedError.cause = e;
    setError(wrappedError);
  };

  const fetchData = async () => {
    setIsFetching(true);
    try {
      const result =
        typeof query == 'string'
          ? await powerSync.getAll<T>(sqlStatement, queryParameters)
          : await query.execute();
      handleResult(result);
    } catch (e) {
      handleError(e as Error);
    }
  };

  const fetchTables = async () => {
    try {
      const tablesResult = await powerSync.resolveTables(sqlStatement, queryParameters, options);
      setTables(tablesResult);
    } catch (e) {
      handleError(e as Error);
    }
  };

  createEffect(() => {
    const updateData = async () => {
      await fetchTables();
      await fetchData();
    };
    updateData();
    const l = powerSync.registerListener({
      schemaChanged: updateData,
    });
    onCleanup(() => l());
  });

  createEffect(() => {
    // Abort any previous watches
    abortController.abort();
    abortController = new AbortController();
    if (!options.runQueryOnce) {
      powerSync.onChangeWithCallback(
        {
          onChange: async () => {
            await fetchData();
          },
          onError(e) {
            handleError(e);
          },
        },
        {
          ...options,
          signal: abortController.signal,
          tables: tables(),
        },
      );
    }
    onCleanup(() => {
      abortController.abort();
    });
  });

  Object.defineProperties(data, {
    state: {
      get: () => {
        if (error()) {
          return 'error';
        }

        if (isLoading()) {
          return 'pending';
        }

        if (isFetching()) {
          return 'refreshing';
        }

        return 'ready';
      },
    },
    error: { get: () => error() },
    loading: { get: () => isFetching() || shouldFetch() },
    latest: { get: () => data() },
  });

  return [
    data as Resource<T[]>,
    {
      refetch: async () => {
        await fetchData();

        return data();
      },
      mutate: setData,
    },
  ];
};
