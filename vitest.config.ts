import { defineConfig } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig(({ mode }) => {
  return {
    plugins: [
      solidPlugin({
        // https://github.com/solidjs/solid-refresh/issues/29
        hot: false,
        solid: { generate: 'dom' },
      }),
    ],
    test: {
      watch: false,
      isolate: true,
      env: {
        NODE_ENV: 'development',
        DEV: '1',
      },
      environment: 'jsdom',
      transformMode: { web: [/\.[jt]sx$/] },
      include: ['**/*.test.{ts,tsx}'],
    },
    resolve: {
      conditions: ['browser', 'development'],
    },
  };
});
