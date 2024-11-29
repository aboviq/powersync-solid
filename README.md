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
