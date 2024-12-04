import type { AbstractPowerSyncDatabase, CompilableQuery } from '@powersync/common';
import { createEffect, createSignal, type Accessor, type ParentComponent } from 'solid-js';
import { renderHook, testEffect } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi, type MockedObject } from 'vitest';
import { PowerSyncContext } from './PowerSyncContext';
import { useQuery } from './useQuery';

const getFakePowerSync = () => {
  return {
    getAll: vi.fn(),
    resolveTables: vi.fn(),
    onChangeWithCallback: vi.fn(),
    registerListener: vi.fn(() => () => {}),
  } as unknown as MockedObject<AbstractPowerSyncDatabase>;
};

const createPowerSyncWrapper =
  (powerSync: AbstractPowerSyncDatabase): ParentComponent =>
  (props) => (
    <PowerSyncContext.Provider value={powerSync}>{props.children}</PowerSyncContext.Provider>
  );

describe('useQuery', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns a result that is in a pending state initially and the data is undefined', () => {
    const powerSync = getFakePowerSync();
    const wrapper = createPowerSyncWrapper(powerSync);

    const {
      result: [data],
    } = renderHook(useQuery, {
      initialProps: ['SELECT * FROM table'],
      wrapper,
    });

    expect(data.state).toBe('pending');
    expect(data()).toBeUndefined();
  });

  it('returns a result that is in a ready state when the data has been resolved', () => {
    const powerSync = getFakePowerSync();
    const wrapper = createPowerSyncWrapper(powerSync);

    powerSync.resolveTables.mockImplementation(async () => ['table']);
    powerSync.getAll.mockImplementation(async () => [{ a: 1 }]);

    const {
      result: [data],
    } = renderHook(useQuery, {
      initialProps: ['SELECT * FROM table'],
      wrapper,
    });

    return testEffect((done) =>
      createEffect(() => {
        if (data.state !== 'ready') {
          return;
        }

        expect(data()).toEqual([{ a: 1 }]);
        done();
      }),
    );
  });

  it('returns a result that is in an error state when the query parsing throws', () => {
    const powerSync = getFakePowerSync();
    const wrapper = createPowerSyncWrapper(powerSync);

    powerSync.resolveTables.mockImplementation(async () => ['table']);
    powerSync.getAll.mockImplementation(async () => [{ a: 1 }]);

    const query = {
      compile: () => ({ sql: 'SELECT * FROM table', parameters: ['test'] }),
      execute: () => Promise.resolve([]),
    };

    const {
      result: [data],
    } = renderHook(useQuery, {
      initialProps: [query, ['parameter']],
      wrapper,
    });

    return testEffect((done) =>
      createEffect(() => {
        if (data.state !== 'errored') {
          return;
        }

        expect(data.error).toBeDefined();
        expect(data.error?.message).toBe(
          'PowerSync failed to fetch data: You cannot pass parameters to a compiled query.',
        );
        done();
      }),
    );
  });

  it("returns a result that is in an error state when PowerSync's getAll throws", () => {
    const powerSync = getFakePowerSync();
    const wrapper = createPowerSyncWrapper(powerSync);

    powerSync.resolveTables.mockImplementation(async () => ['table']);
    powerSync.getAll.mockImplementation(async () => {
      throw new Error('Test error');
    });

    const {
      result: [data],
    } = renderHook(useQuery, {
      initialProps: ['SELECT * FROM table'],
      wrapper,
    });

    return testEffect((done) =>
      createEffect(() => {
        if (data.state !== 'errored') {
          return;
        }

        expect(data.error).toBeDefined();
        expect(data.error?.message).toBe('PowerSync failed to fetch data: Test error');
        done();
      }),
    );
  });

  it('re-runs the query if the database schema has changed', () => {
    const powerSync = getFakePowerSync();
    const wrapper = createPowerSyncWrapper(powerSync);

    let listener: ((...args: any[]) => void) | undefined;

    powerSync.resolveTables.mockImplementation(async () => ['table']);
    powerSync.getAll.mockImplementation(async () => [{ a: 1 }]);
    powerSync.registerListener.mockImplementation(({ schemaChanged }) => {
      listener = schemaChanged;

      return () => {
        listener = undefined;
      };
    });

    const {
      result: [data],
    } = renderHook(useQuery, {
      initialProps: ['SELECT * FROM table'],
      wrapper,
    });

    setTimeout(() => listener?.(), 0);

    return testEffect((done) =>
      createEffect<string[]>((states) => {
        if (states.length < 3) {
          return [...states, data.state];
        }

        expect([...states, data.state]).toEqual(['pending', 'ready', 'refreshing', 'ready']);
        expect(powerSync.getAll).toHaveBeenCalledTimes(2);
        done();

        return states;
      }, []),
    );
  });

  it('re-runs the query if the data for the tables in the query has changed', () => {
    const powerSync = getFakePowerSync();
    const wrapper = createPowerSyncWrapper(powerSync);

    let listener: ((...args: any[]) => void) | undefined;

    powerSync.resolveTables.mockImplementation(async () => ['table']);
    powerSync.getAll.mockImplementation(async () => [{ a: 1 }]);
    powerSync.onChangeWithCallback.mockImplementation((handlers) => {
      listener = handlers?.onChange;

      return () => {
        listener = undefined;
      };
    });

    const {
      result: [data],
    } = renderHook(useQuery, {
      initialProps: ['SELECT * FROM table'],
      wrapper,
    });

    setTimeout(() => listener?.(), 0);

    return testEffect((done) =>
      createEffect<string[]>((states) => {
        if (states.length < 3) {
          return [...states, data.state];
        }

        expect([...states, data.state]).toEqual(['pending', 'ready', 'refreshing', 'ready']);
        expect(powerSync.getAll).toHaveBeenCalledTimes(2);
        done();

        return states;
      }, []),
    );
  });

  it('does not register a change listener for the tables in the query when runQueryOnce is true', () => {
    const powerSync = getFakePowerSync();
    const wrapper = createPowerSyncWrapper(powerSync);

    powerSync.resolveTables.mockImplementation(async () => ['table']);
    powerSync.getAll.mockImplementation(async () => [{ a: 1 }]);

    const {
      result: [data],
    } = renderHook(useQuery, {
      initialProps: ['SELECT * FROM table', [], { runQueryOnce: true }],
      wrapper,
    });

    return testEffect((done) =>
      createEffect(() => {
        if (data.state === 'ready') {
          expect(powerSync.onChangeWithCallback).not.toHaveBeenCalled();
          done();
        }
      }),
    );
  });

  it('re-runs the query if the query parameters change', () => {
    const powerSync = getFakePowerSync();
    const wrapper = createPowerSyncWrapper(powerSync);

    powerSync.resolveTables.mockImplementation(async () => ['table']);
    powerSync.getAll.mockImplementation(async (_query, parameters) => [{ a: parameters?.[0] }]);

    const [id, setId] = createSignal(1);

    const {
      result: [data],
    } = renderHook(useQuery, {
      initialProps: ['SELECT * FROM table WHERE id = ?', [id]],
      wrapper,
    });

    setTimeout(() => setId(2), 0);

    return testEffect((done) =>
      createEffect<string[]>((states) => {
        if (states.length < 3) {
          return [...states, data.state];
        }

        expect([...states, data.state]).toEqual(['pending', 'ready', 'refreshing', 'ready']);
        expect(powerSync.getAll).toHaveBeenCalledTimes(2);
        expect(data()).toEqual([{ a: 2 }]);
        done();

        return states;
      }, []),
    );
  });

  it('re-runs the query if the query change', () => {
    const powerSync = getFakePowerSync();
    const wrapper = createPowerSyncWrapper(powerSync);

    powerSync.resolveTables.mockImplementation(async () => ['table']);
    powerSync.getAll.mockImplementation(async () => [{ a: 1 }]);

    const [query, setQuery] = createSignal('SELECT * FROM table ORDER BY name');

    const {
      result: [data],
    } = renderHook(useQuery, {
      initialProps: [query],
      wrapper,
    });

    setTimeout(() => setQuery((query) => `${query} DESC`), 0);

    return testEffect((done) =>
      createEffect<string[]>((states) => {
        if (states.length < 3) {
          return [...states, data.state];
        }

        expect([...states, data.state]).toEqual(['pending', 'ready', 'refreshing', 'ready']);
        expect(powerSync.getAll).toHaveBeenCalledTimes(2);
        expect(powerSync.getAll).toHaveBeenLastCalledWith(
          'SELECT * FROM table ORDER BY name DESC',
          [],
        );
        done();

        return states;
      }, []),
    );
  });

  it('re-runs the query if refetch is used', () => {
    const powerSync = getFakePowerSync();
    const wrapper = createPowerSyncWrapper(powerSync);

    powerSync.resolveTables.mockImplementation(async () => ['table']);
    powerSync.getAll.mockImplementation(async () => [{ a: 1 }]);

    const {
      result: [data, { refetch }],
    } = renderHook(useQuery, {
      initialProps: ['SELECT * FROM table'],
      wrapper,
    });

    setTimeout(() => refetch(), 0);

    return testEffect((done) =>
      createEffect<string[]>((states) => {
        if (states.length < 3) {
          return [...states, data.state];
        }

        expect([...states, data.state]).toEqual(['pending', 'ready', 'refreshing', 'ready']);
        expect(powerSync.getAll).toHaveBeenCalledTimes(2);
        done();

        return states;
      }, []),
    );
  });

  it('re-runs compileable queries if they change', () => {
    const powerSync = getFakePowerSync();
    const wrapper = createPowerSyncWrapper(powerSync);

    powerSync.resolveTables.mockImplementation(async () => ['table']);
    powerSync.getAll.mockImplementation(async () => [{ a: 1 }]);

    const execute = vi.fn(() => Promise.resolve([]));

    const [parameter, setParameter] = createSignal('test');

    const query: Accessor<CompilableQuery<string[]>> = () => ({
      compile: () => ({ sql: 'SELECT * FROM table', parameters: [parameter()] }),
      execute,
    });

    const {
      result: [data],
    } = renderHook(useQuery, {
      initialProps: [query],
      wrapper,
    });

    setTimeout(() => setParameter('test2'), 0);

    return testEffect((done) =>
      createEffect<string[]>((states) => {
        if (states.length < 3) {
          return [...states, data.state];
        }

        expect([...states, data.state]).toEqual(['pending', 'ready', 'refreshing', 'ready']);
        expect(powerSync.getAll).not.toHaveBeenCalled();
        expect(execute).toHaveBeenCalledTimes(2);
        done();

        return states;
      }, []),
    );
  });
});
