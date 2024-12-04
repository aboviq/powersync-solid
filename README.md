<p>
  <img width="100%" src="https://assets.solidjs.com/banner?type=powersync-solid&background=tiles&project=@Aboviq" alt="@aboviq/powersync-solid">
</p>

# @aboviq/powersync-solid

[![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-cc00ff.svg?style=for-the-badge&logo=pnpm)](https://pnpm.io/)

The `@aboviq/powersync-solid` package provides [SolidJS](https://www.solidjs.com) hooks and helpers for use with the [JavaScript Web SDK](https://github.com/powersync-ja/powersync-js/tree/main/packages/web). These hooks are designed to support reactivity, and can be used to automatically re-render SolidJS components when query results update or to access [PowerSync](https://www.powersync.com) connectivity status changes.

## Quick start

Install it:

```bash
npm i @aboviq/powersync-solid
# or
yarn add @aboviq/powersync-solid
# or
pnpm add @aboviq/powersync-solid
```

### Usage

Follow the instructions in the [JavaScript Web SDK docs](https://docs.powersync.com/client-sdk-references/javascript-web#2-instantiate-the-powersync-database), then setup the `PowerSyncContext` provider:

```tsx
import { PowerSyncContext } from '@aboviq/powersync-solid';
import { db } from './db'; // <- the PowerSync database instance
import ListsView from './ListsView';

export default function App() {
  return (
    <PowerSyncContext.Provider value={db}>
      <ListsView />
    </PowerSyncContext.Provider>
  );
}
```

Then use the hooks and helpers in your components:

```tsx
// ListsView.tsx
import { useQuery } from '@aboviq/powersync-solid';

export default function ListsView() {
  const [lists] = useQuery('SELECT * FROM lists');

  return (
    <div>
      <Show when={lists.loading}>
        <p>Loading...</p>
      </Show>
      <Switch>
        <Match when={lists.error}>
          <span>Error: {lists.error}</span>
        </Match>
        <Match when={lists()}>
          <div>{JSON.stringify(lists())}</div>
        </Match>
      </Switch>
    </div>
  );
}
```

```tsx
// Status.tsx
import { useStatus } from '@aboviq/powersync-solid';

export default function Status() {
  const status = useStatus();

  return (
    <p>
      <Show when={status().connected} fallback="Offline">
        Online
      </Show>{' '}
      (last sync: {status().lastSyncedAt?.toLocaleDateString() ?? 'n/a'})
    </p>
  );
}
```

**Note:** the `useQuery` has the same return type as SolidJS's [`createResource`](https://docs.solidjs.com/guides/fetching-data#using-createresource) hook.

## Watched Queries

The `useQuery` hook is designed to automatically re-render the component when any of the following change:

- PowerSync's connection status (can be easily accessed via the `useStatus` hook)
- The query result changes (e.g. when a new record is inserted, updated, or deleted)
- The query itself changes (e.g. when a query signal is used that is updated with new state)
- The query's parameters change (e.g. when any parameter is a signal and it's updated with new state)

### Example - a reactive query

```tsx
import { useQuery } from '@aboviq/powersync-solid';

export default function ListsView() {
  const [sortOrder, setSortOrder] = createSignal('ASC');
  const [lists] = useQuery(() => `SELECT * FROM lists ORDER BY name ${sortOrder()}`);

  const toggleSortOrder = () => {
    setSortOrder((sortOrder) => (sortOrder === 'ASC' ? 'DESC' : 'ASC'));
  };

  return (
    <div>
      <Show when={lists.loading}>
        <p>Loading...</p>
      </Show>
      <Switch>
        <Match when={lists.error}>
          <span>Error: {lists.error}</span>
        </Match>
        <Match when={lists()}>
          <button onClick={toggleSortOrder}>Toggle sort order</button>
          <div>{JSON.stringify(lists())}</div>
        </Match>
      </Switch>
    </div>
  );
}
```

### Example - reactive parameters

```tsx
import { useQuery } from '@aboviq/powersync-solid';

export default function ListsView() {
  const [page, setPage] = createSignal(1);
  const offet = () => (page() - 1) * 10;
  const [lists] = useQuery('SELECT * FROM lists LIMIT 10 OFFSET ?', [offset]);

  const previousPage = () => {
    setPage((page) => page - 1);
  };

  const nextPage = () => {
    setPage((page) => page + 1);
  };

  return (
    <div>
      <Show when={lists.loading}>
        <p>Loading...</p>
      </Show>
      <Switch>
        <Match when={lists.error}>
          <span>Error: {lists.error}</span>
        </Match>
        <Match when={lists()}>
          <button disabled={page() > 1} onClick={previousPage}>
            Previous page
          </button>
          <button disabled={lists()?.length !== 10} onClick={nextPage}>
            Next page
          </button>
          <div>{JSON.stringify(lists())}</div>
        </Match>
      </Switch>
    </div>
  );
}
```

## Using with an ORM

### Example - using [Kysely](https://kysely.dev/)

Set up the Kysely database instance according to the [PowerSync Kysely ORM docs](https://docs.powersync.com/client-sdk-references/javascript-web/javascript-orm/kysely).

This will also give you automatic TypeScript type inference for your queries.

```tsx
import { useQuery } from '@aboviq/powersync-solid';
import { db } from './db'; // <- the file where you have configured your Kysely instance

export default function ListsView() {
  const [lists] = useQuery(db.selectFrom('lists').selectAll('lists'));

  return (
    <div>
      <Show when={lists.loading}>
        <p>Loading...</p>
      </Show>
      <Switch>
        <Match when={lists.error}>
          <span>Error: {lists.error}</span>
        </Match>
        <Match when={lists()}>
          <div>{JSON.stringify(lists())}</div>
        </Match>
      </Switch>
    </div>
  );
}
```

### Example - using [Kysely](https://kysely.dev/) with reactive parameters

To use reactive parameters with Kysely, you can pass a function that returns the query to `useQuery`.

```tsx
import { useQuery } from '@aboviq/powersync-solid';
import { db } from './db'; // <- the file where you have configured your Kysely instance

export default function ListsView() {
  const [page, setPage] = createSignal(1);
  const [lists] = useQuery(() =>
    db
      .selectFrom('lists')
      .selectAll('lists')
      .limit(10)
      .offset((page() - 1) * 10),
  );

  const previousPage = () => {
    setPage((page) => page - 1);
  };

  const nextPage = () => {
    setPage((page) => page + 1);
  };

  return (
    <div>
      <Show when={lists.loading}>
        <p>Loading...</p>
      </Show>
      <Switch>
        <Match when={lists.error}>
          <span>Error: {lists.error}</span>
        </Match>
        <Match when={lists()}>
          <button disabled={page() > 1} onClick={previousPage}>
            Previous page
          </button>
          <button disabled={lists()?.length !== 10} onClick={nextPage}>
            Next page
          </button>
          <div>{JSON.stringify(lists())}</div>
        </Match>
      </Switch>
    </div>
  );
}
```

## TypeScript types without an ORM

If you're not using an ORM, you can still get TypeScript types for your queries by using the `useQuery` hook with a type parameter.

```tsx
import { useQuery } from '@aboviq/powersync-solid';
import type { ListRecord } from './schema'; // <- the file where you have defined your PowerSync database schema

export default function ListsView() {
  const [lists] = useQuery<ListRecord>('SELECT * FROM lists');

  return (
    <div>
      <Show when={lists.loading}>
        <p>Loading...</p>
      </Show>
      <Switch>
        <Match when={lists.error}>
          <span>Error: {lists.error}</span>
        </Match>
        <Match when={lists()}>
          <div>{JSON.stringify(lists())}</div>
        </Match>
      </Switch>
    </div>
  );
}
```

## License

`powersync-solid` is licensed under the MIT license. See [LICENSE](LICENSE) for the full license text.
