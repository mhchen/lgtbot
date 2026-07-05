import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';

const webRoot = import.meta.dirname;
const repoRoot = path.resolve(webRoot, '..');

const serverOnly = ['bun:sqlite', 'better-sqlite3', 'discord.js'];

function isServerOnly(id: string): boolean {
  return (
    serverOnly.includes(id) ||
    id.startsWith('@discordjs/') ||
    id === 'zlib-sync'
  );
}

export default defineConfig(({ mode }) => {
  for (const [key, value] of Object.entries(loadEnv(mode, repoRoot, ''))) {
    if (process.env[key] == null) process.env[key] = value;
  }

  return {
    root: webRoot,
    server: {
      port: 3001,
      fs: { allow: [repoRoot] },
    },
    ssr: {
      external: serverOnly,
    },
    optimizeDeps: {
      exclude: serverOnly,
    },
    build: {
      rollupOptions: {
        external: (id: string) => isServerOnly(id),
      },
    },
    plugins: [tanstackStart(), viteReact()],
  };
});
