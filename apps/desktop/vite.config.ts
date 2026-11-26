import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

// The shared packages (packages/core): one source for both apps, read from the repo.
const packages = decodeURIComponent(new URL('../../packages', import.meta.url).pathname);
export default defineConfig({
  plugins: [react(), tailwind()],
  resolve: { alias: [{ find: /^@habyss\/core\/(.*)$/, replacement: `${packages}/core/src/$1` }] },
  clearScreen: false,
  server: { strictPort: true, host: '127.0.0.1', port: 1420, fs: { allow: ['.', packages] } },
  build: { target: 'es2022' },
});
