import path from 'node:path';
import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';

const webRoot = import.meta.dirname;
const repoRoot = path.resolve(webRoot, '..');

const sqliteDrivers = ['bun:sqlite', 'better-sqlite3'];

export default defineConfig({
  root: webRoot,
  server: {
    port: 3001,
    fs: { allow: [repoRoot] },
  },
  ssr: {
    external: sqliteDrivers,
  },
  optimizeDeps: {
    exclude: sqliteDrivers,
  },
  plugins: [tanstackStart(), viteReact()],
});
