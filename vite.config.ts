import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

const projectRoot = import.meta.dirname;

export default defineConfig(() => {
  return {
    // All frontend code lives in client/; code shared with the server lives in shared/.
    root: path.resolve(projectRoot, 'client'),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(projectRoot, 'client'),
        '@shared': path.resolve(projectRoot, 'shared'),
      },
    },
    build: {
      // Emit the production bundle to <project root>/dist, where server.ts serves static files.
      outDir: path.resolve(projectRoot, 'dist'),
      emptyOutDir: true,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
